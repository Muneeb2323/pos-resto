/**
 * Route guards.
 *
 * Middleware proves only that a caller holds a valid session. Every API route that
 * reads or writes restaurant data states its own role requirement here, so authority
 * is declared next to the handler rather than inferred from the URL.
 */
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { canAccessModule, type AppModule } from "@/lib/auth/permissions";
import { MoneyError } from "@/lib/money";

export type Guard =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

function deny(message: string, status: number): Guard {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/** Requires any signed-in, active user. */
export async function requireSession(): Promise<Guard> {
  const session = await getSession();
  if (!session) return deny("Sign in to continue", 401);
  return { ok: true, session };
}

/** Requires one of the given roles. */
export async function requireRole(...roles: Role[]): Promise<Guard> {
  const guard = await requireSession();
  if (!guard.ok) return guard;
  if (!roles.includes(guard.session.role)) {
    return deny("You do not have permission to perform this action", 403);
  }
  return guard;
}

/** Requires access to a module as defined by the role permission matrix. */
export async function requireModule(module: AppModule): Promise<Guard> {
  const guard = await requireSession();
  if (!guard.ok) return guard;
  if (!canAccessModule(guard.session.role, module)) {
    return deny("You do not have permission to access this area", 403);
  }
  return guard;
}

/**
 * Turn a thrown error into a response.
 *
 * Validation failures (`MoneyError`) are the caller's fault and are echoed back;
 * anything else is logged server-side and reported generically, so internal details
 * and SQL never reach the terminal.
 */
export function routeError(context: string, error: unknown, fallback: string): NextResponse {
  if (error instanceof MoneyError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
