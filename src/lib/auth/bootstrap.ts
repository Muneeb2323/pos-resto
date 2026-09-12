import prisma from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/session";
import { Role } from "@prisma/client";

/**
 * First-run administrator provisioning.
 *
 * Creates the administrator account from `.env` when - and only when - the database
 * has no administrator at all. It deliberately does *not* run on every sign-in and
 * does not reset an existing password, because doing so meant:
 *
 *   - a bcrypt hash on every sign-in attempt, including failed ones;
 *   - every other administrator account being deleted on each sign-in;
 *   - a typo in `.env` silently locking the real administrator out.
 *
 * To change the administrator password afterwards, edit `.env` and run
 * `npm run admin:reset`, which is explicit and logged.
 */

const PLACEHOLDER_PASSWORDS = new Set(["password123", "admin123", "changeme", "password"]);

let bootstrapPromise: Promise<void> | null = null;

function readAdminConfig() {
  return {
    username: (process.env.ADMIN_USERNAME || "admin").toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME || "Administrator",
  };
}

/** Create the first administrator if the installation has none. Safe to call often. */
export async function ensureAdminExists(): Promise<void> {
  // One attempt per server process; the result is shared by concurrent callers.
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      // Allow a later request to retry, e.g. after the database comes up.
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

async function runBootstrap(): Promise<void> {
  const existingAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (existingAdmin) return;

  const { username, password, name } = readAdminConfig();

  if (!password) {
    console.error(
      "[bootstrap] No administrator exists and ADMIN_PASSWORD is not set in .env. " +
        "Set it and restart to create the first administrator."
    );
    return;
  }
  if (PLACEHOLDER_PASSWORDS.has(password.toLowerCase())) {
    console.warn(
      "[bootstrap] ADMIN_PASSWORD is a well-known placeholder. Change it in .env and " +
        "run `npm run admin:reset` before this terminal handles real trade."
    );
  }

  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: await hashPassword(password),
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log('[bootstrap] Created the first administrator account ("' + username + '") from .env.');
}

/**
 * Reset the administrator password from `.env`.
 *
 * Used by `npm run admin:reset` for password recovery. Unlike the previous behaviour,
 * this never deletes other administrators - it updates the named account, or creates
 * it if it is absent.
 */
export async function resetAdminFromEnv(): Promise<{ username: string; created: boolean }> {
  const { username, password, name } = readAdminConfig();

  if (!password) {
    throw new Error("ADMIN_PASSWORD is not set in .env - nothing to reset to.");
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, passwordHash, role: Role.ADMIN, isActive: true },
    });
    return { username, created: false };
  }

  await prisma.user.create({
    data: { username, name, passwordHash, role: Role.ADMIN, isActive: true },
  });
  return { username, created: true };
}
