/**
 * Resets the administrator account to the credentials in .env.
 *
 * Usage: npm run admin:reset
 */
import { resetAdminFromEnv } from "../src/lib/auth/bootstrap";
import prisma from "../src/lib/db/prisma";

async function main() {
  const { username, created } = await resetAdminFromEnv();
  console.log(
    created
      ? `Created administrator "${username}" with the password from .env.`
      : `Reset administrator "${username}" to the password from .env.`
  );
}

main()
  .catch((error) => {
    console.error("Admin reset failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
