import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyPassword, setSessionCookie, hashPassword } from "@/lib/auth/session";
import { checkThrottle, recordFailure, recordSuccess } from "@/lib/auth/rateLimit";
import { MissingSecretError } from "@/lib/auth/secret";

export const dynamic = "force-dynamic";

/**
 * A bcrypt hash of a value nobody knows, compared against when the username does not
 * exist. Without it, an unknown username returns measurably faster than a known one
 * with a wrong password, which tells an attacker which accounts are real.
 */
let decoyHash: string | null = null;
async function getDecoyHash(): Promise<string> {
  if (!decoyHash) {
    decoyHash = await hashPassword("no-such-user-" + Math.random().toString(36));
  }
  return decoyHash;
}

function clientKey(req: NextRequest, username: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  return ip + "|" + username;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) ?? {};

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const normalisedUsername = username.toLowerCase().trim();
    const throttleKey = clientKey(req, normalisedUsername);

    const throttle = checkThrottle(throttleKey);
    if (throttle.blocked) {
      return NextResponse.json(
        {
          error:
            "Too many failed sign-in attempts. Try again in " +
            Math.ceil(throttle.retryAfterSeconds / 60) +
            " minute(s).",
        },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { username: normalisedUsername } });

    // Always spend the same work whether or not the account exists.
    const isValid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, await getDecoyHash());

    if (!user || !isValid) {
      recordFailure(throttleKey);
      // One message for both cases: never confirm that a username exists.
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (!user.isActive) {
      recordFailure(throttleKey);
      return NextResponse.json(
        { error: "This account is deactivated. Contact your manager." },
        { status: 403 }
      );
    }

    const sessionPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };

    await setSessionCookie(sessionPayload);
    recordSuccess(throttleKey);

    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "USER",
          entityId: user.id,
          details: JSON.stringify({ ip: req.headers.get("x-forwarded-for") || "local" }),
        },
      });
    } catch {
      // A failed audit write must not block a cashier from starting their shift.
    }

    return NextResponse.json({ success: true, user: sessionPayload });
  } catch (error) {
    // A missing JWT_SECRET is a setup problem the operator can actually fix, so say so.
    if (error instanceof MissingSecretError) {
      console.error("[auth.login]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("[auth.login]", error);
    return NextResponse.json(
      { error: "Unable to process sign-in. Please try again." },
      { status: 500 }
    );
  }
}
