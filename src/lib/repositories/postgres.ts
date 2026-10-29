import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createDemoData } from "../fixtures";
import type { StoreData, TicketRepository } from "../repository";
import type { Ticket } from "../types";

const globalDb = globalThis as unknown as { cmmsPrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  globalDb.cmmsPrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2_000,
    }),
  });
  return globalDb.cmmsPrisma;
}

type StoredTicket = Prisma.TicketGetPayload<{
  include: { comments: true; workLogs: true; history: true };
}>;

function groupByTicket<T extends { ticketId: string }>(
  entries: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const group = groups.get(entry.ticketId) ?? [];
    group.push(entry);
    groups.set(entry.ticketId, group);
  }
  return groups;
}

function fromStored(ticket: StoredTicket): Ticket {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    description: ticket.description,
    locationId: ticket.locationId,
    assetId: ticket.assetId,
    priority: ticket.priority,
    status: ticket.status,
    reporterId: ticket.reporterId,
    assigneeId: ticket.assigneeId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    dueAt: ticket.dueAt.toISOString(),
    closedAt: ticket.closedAt?.toISOString() ?? null,
    comments: ticket.comments.map(({ id, authorId, text, createdAt }) => ({
      id,
      authorId,
      text,
      createdAt: createdAt.toISOString(),
    })),
    workLogs: ticket.workLogs.map(
      ({ id, authorId, measure, minutes, createdAt }) => ({
        id,
        authorId,
        measure,
        minutes,
        createdAt: createdAt.toISOString(),
      }),
    ),
    history: ticket.history.map(({ id, actorId, text, kind, createdAt }) => ({
      id,
      actorId,
      text,
      kind,
      createdAt: createdAt.toISOString(),
    })),
  };
}

async function readData(tx: Prisma.TransactionClient): Promise<StoreData> {
  // One PostgreSQL transaction uses one connection; issue its queries sequentially.
  const locations = await tx.location.findMany({ orderBy: { id: "asc" } });
  const assets = await tx.asset.findMany({ orderBy: { id: "asc" } });
  const people = await tx.person.findMany({ orderBy: { id: "asc" } });
  const tickets = await tx.ticket.findMany({
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
  });
  const comments = groupByTicket(
    await tx.comment.findMany({ orderBy: { ordinal: "asc" } }),
  );
  const workLogs = groupByTicket(
    await tx.workLog.findMany({ orderBy: { ordinal: "asc" } }),
  );
  const history = groupByTicket(
    await tx.historyEvent.findMany({ orderBy: { ordinal: "asc" } }),
  );
  const counter = await tx.counter.findUnique({ where: { id: "tickets" } });
  return {
    locations,
    assets,
    people,
    tickets: tickets.map((ticket) =>
      fromStored({
        ...ticket,
        comments: comments.get(ticket.id) ?? [],
        workLogs: workLogs.get(ticket.id) ?? [],
        history: history.get(ticket.id) ?? [],
      }),
    ),
    nextNumber: counter?.nextNumber ?? 1,
  };
}

async function writeData(
  tx: Prisma.TransactionClient,
  data: StoreData,
): Promise<void> {
  await tx.location.createMany({ data: data.locations, skipDuplicates: true });
  await tx.person.createMany({ data: data.people, skipDuplicates: true });
  await tx.asset.createMany({ data: data.assets, skipDuplicates: true });

  for (const ticket of data.tickets) {
    const { comments, workLogs, history, ...fields } = ticket;
    await tx.ticket.upsert({
      where: { id: ticket.id },
      create: fields,
      update: fields,
    });
    // Existing entries are append-only; repeated writes never rewrite audit data.
    await tx.comment.createMany({
      data: comments.map((entry, ordinal) => ({
        ...entry,
        ticketId: ticket.id,
        ordinal,
      })),
      skipDuplicates: true,
    });
    await tx.workLog.createMany({
      data: workLogs.map((entry, ordinal) => ({
        ...entry,
        ticketId: ticket.id,
        ordinal,
      })),
      skipDuplicates: true,
    });
    await tx.historyEvent.createMany({
      data: history.map((entry, ordinal) => ({
        ...entry,
        ticketId: ticket.id,
        ordinal,
      })),
      skipDuplicates: true,
    });
  }

  await tx.counter.upsert({
    where: { id: "tickets" },
    create: { id: "tickets", nextNumber: data.nextNumber },
    update: { nextNumber: data.nextNumber },
  });
}

/** Local pilot repository. A transaction lock serializes writers, including separate processes. */
export class PostgresRepository implements TicketRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  async ensureSeed(): Promise<void> {
    await this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72705514)`;
        const existing = await tx.counter.findUnique({
          where: { id: "tickets" },
        });
        if (!existing) await writeData(tx, createDemoData());
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }

  async read(): Promise<StoreData> {
    return this.client.$transaction(readData, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15_000,
    });
  }

  async mutate<T>(operation: (data: StoreData) => T): Promise<T> {
    return this.client.$transaction(
      async (tx) => {
        // Read after acquiring the lock, so a waiter sees the previous writer's commit.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72705514)`;
        const data = await readData(tx);
        const result = operation(data);
        await writeData(tx, data);
        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 30_000,
        maxWait: 10_000,
      },
    );
  }
}
