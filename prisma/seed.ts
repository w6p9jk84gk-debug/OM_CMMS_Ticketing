import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import type { PrismaClient } from "@prisma/client";
import {
  getPrismaClient,
  PostgresRepository,
} from "../src/lib/repositories/postgres";

if (existsSync(".env")) loadEnvFile(".env");
let client: PrismaClient | undefined;

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL fehlt. Bitte die lokale PostgreSQL-Verbindung konfigurieren.",
    );
  client = getPrismaClient();
  const repository = new PostgresRepository(client);
  await repository.ensureSeed();
  const data = await repository.read();
  console.log(
    `Stammdaten und Beispieltickets bereit: ${data.locations.length} Standorte, ${data.assets.length} Anlagen, ${data.tickets.length} Tickets.`,
  );
}

main()
  .catch(() => {
    console.error(
      "Datenbank-Seed fehlgeschlagen. Verbindung und Migrationen prüfen. Bestehende Daten bleiben erhalten.",
    );
    process.exitCode = 1;
  })
  .finally(() => client?.$disconnect());
