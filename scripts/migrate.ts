import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import pg from "pg";

if (existsSync(".env")) loadEnvFile(".env");

async function migrate() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL fehlt. Bitte die lokale .env konfigurieren.");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Standard Prisma migration metadata allows inspection with conventional tooling.
    await client.query("SELECT pg_advisory_xact_lock(684321901)");
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);
    const root = join(process.cwd(), "prisma", "migrations");
    const migrations = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of migrations) {
      const sql = await readFile(join(root, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = await client.query<{
        checksum: string;
        finished_at: Date | null;
      }>(
        'SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',
        [name],
      );
      if (previous.rows.length) {
        if (
          previous.rows.some(
            (row) => !row.finished_at || row.checksum !== checksum,
          )
        )
          throw new Error(
            `Migration ${name} wurde verändert oder nicht abgeschlossen. Bitte manuell prüfen.`,
          );
        console.log(`Bereits angewendet: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)',
        [randomUUID(), checksum, name],
      );
      console.log(`Angewendet: ${name}`);
    }
    await client.query("COMMIT");
    console.log("Datenbankschema ist aktuell.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  // Never print connection URLs, stack traces or credentials.
  console.error(
    "Migration fehlgeschlagen:",
    error instanceof Error ? error.message : "Unbekannter Datenbankfehler.",
  );
  process.exitCode = 1;
});
