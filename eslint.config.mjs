import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  // Ignore first, so third-party and generated trees are never parsed.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Bundled portable PostgreSQL + pgAdmin, and the live database cluster.
    // These are third-party sources and binary data, not this project's code.
    "pgsql/**",
    "data/**",

    // Generated and vendored output.
    "node_modules/**",
    "prisma/migrations/**",
  ]),
  ...nextVitals,
]);

export default eslintConfig;
