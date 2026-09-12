import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma configuration.
 *
 * Replaces the deprecated `prisma` key in package.json, which Prisma 7 removes.
 *
 * A config file stops the CLI loading .env on its own, so dotenv is imported here to
 * keep DATABASE_URL available to `prisma migrate` and `prisma generate`.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
