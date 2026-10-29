import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

if (existsSync(".env")) loadEnvFile(".env");
const databaseUrl = process.env.DATABASE_URL;
// Prisma inspects the datasource even for client generation. This value is never
// used for a connection; the adapter below requires an explicitly configured URL.
process.env.DATABASE_URL ??=
  "postgresql://generation-only:unused@127.0.0.1:5432/generation-only";

// JavaScript/WASM engines keep setup independent of platform-specific engine downloads.
export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () => {
    if (!databaseUrl)
      throw new Error(
        "DATABASE_URL fehlt. Für Datenbankbefehle bitte .env konfigurieren.",
      );
    return new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
    });
  },
});
