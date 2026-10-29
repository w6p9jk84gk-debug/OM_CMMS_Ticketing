import { applyTicketAction, createTicket, DomainError } from "./domain";
import type { TicketRepository } from "./repository";
import type { AppState, Ticket } from "./types";
import { DemoRepository } from "./repositories/demo";

interface Selection {
  repository: TicketRepository;
  mode: AppState["mode"];
  modeReason: string;
}
const globalStore = globalThis as typeof globalThis & {
  cmmsRepository?: Promise<Selection>;
};

async function selectRepository(): Promise<Selection> {
  const requested = process.env.DATA_MODE || "auto";
  if (!["auto", "demo", "postgres"].includes(requested))
    throw new DomainError(
      "DATA_MODE muss auto, demo oder postgres sein.",
      {},
      503,
    );
  if (
    requested === "demo" ||
    (requested === "auto" && !process.env.DATABASE_URL)
  ) {
    return {
      repository: new DemoRepository(),
      mode: "demo",
      modeReason:
        "Beispieldaten · Änderungen werden lokal in der Demo-Datei gespeichert.",
    };
  }
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
    const { PostgresRepository } = await import("./repositories/postgres");
    const repository = new PostgresRepository();
    await repository.ensureSeed();
    return {
      repository,
      mode: "postgres",
      modeReason:
        "Lokale PostgreSQL-Datenbank · Änderungen werden dauerhaft gespeichert.",
    };
  } catch {
    if (requested === "postgres")
      throw new DomainError(
        "Die PostgreSQL-Datenbank ist nicht erreichbar oder noch nicht eingerichtet. Bitte Verbindung und Migration prüfen.",
        {},
        503,
      );
    return {
      repository: new DemoRepository(),
      mode: "demo",
      modeReason:
        "Datenbank nicht verfügbar · Demo-Daten werden separat lokal gespeichert. Zum Datenbankwechsel den Server neu starten.",
    };
  }
}

export async function getRepository(): Promise<Selection> {
  if (!globalStore.cmmsRepository) {
    globalStore.cmmsRepository = selectRepository().catch((error: unknown) => {
      delete globalStore.cmmsRepository;
      throw error;
    });
  }
  return globalStore.cmmsRepository;
}
export async function getAppState(): Promise<AppState> {
  const { repository, mode, modeReason } = await getRepository();
  const { tickets, locations, assets, people } = await repository.read();
  return {
    tickets: tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    locations,
    assets,
    people,
    mode,
    modeReason,
    now: new Date().toISOString(),
  };
}
export async function reportTicket(input: unknown): Promise<Ticket> {
  const { repository } = await getRepository();
  return repository.mutate((data) => createTicket(input, data));
}
export async function updateTicket(
  id: string,
  input: unknown,
): Promise<Ticket> {
  const { repository } = await getRepository();
  return repository.mutate((data) => {
    const ticket = data.tickets.find((entry) => entry.id === id);
    if (!ticket)
      throw new DomainError("Dieses Ticket wurde nicht gefunden.", {}, 404);
    return applyTicketAction(ticket, input, data);
  });
}
