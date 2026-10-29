import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyTicketAction,
  createTicket,
  DomainError,
} from "../src/lib/domain";
import { createDemoData } from "../src/lib/fixtures";
import { DemoRepository } from "../src/lib/repositories/demo";

const input = {
  title: "Neue Pumpenstörung",
  description: "Druck fällt im Betrieb ab.",
  locationId: "werk-nord",
  assetId: "pumpe-p101",
  priority: "HIGH",
  reporterId: "thomas",
};
const now = new Date("2026-10-29T08:00:00Z");

test("vollständiger Ablauf bewahrt Historie und erlaubt Abschluss nur mit Massnahme", () => {
  const data = createDemoData(now);
  const ticket = createTicket(input, data, now);
  assert.equal(ticket.status, "NEW");
  assert.equal(ticket.dueAt, "2026-10-30T08:00:00.000Z");
  applyTicketAction(
    ticket,
    { type: "assign", actorId: "anna", assigneeId: "marco" },
    data,
    now,
  );
  assert.equal(ticket.status, "ASSIGNED");
  applyTicketAction(
    ticket,
    { type: "status", actorId: "marco", status: "IN_PROGRESS" },
    data,
    now,
  );
  assert.throws(
    () =>
      applyTicketAction(
        ticket,
        { type: "status", actorId: "marco", status: "DONE" },
        data,
        now,
      ),
    /Massnahme/,
  );
  applyTicketAction(
    ticket,
    { type: "comment", actorId: "thomas", text: "Produktion informiert." },
    data,
    now,
  );
  applyTicketAction(
    ticket,
    {
      type: "work",
      actorId: "marco",
      measure: "Dichtung ersetzt und Probelauf durchgeführt.",
      minutes: 45,
    },
    data,
    now,
  );
  applyTicketAction(
    ticket,
    { type: "status", actorId: "marco", status: "DONE" },
    data,
    now,
  );
  assert.equal(ticket.status, "DONE");
  assert.equal(ticket.closedAt, now.toISOString());
  assert.equal(ticket.workLogs[0].minutes, 45);
  assert.equal(
    ticket.history.filter((entry) => entry.kind === "STATUS").length,
    3,
  );
  assert.equal(ticket.comments[0].authorId, "thomas");
  applyTicketAction(
    ticket,
    { type: "status", actorId: "anna", status: "IN_PROGRESS" },
    data,
    now,
  );
  assert.equal(ticket.closedAt, null);
});

test("Pflichtfelder, Standortzuordnung und Priorität werden serverseitig validiert", () => {
  const data = createDemoData(now);
  assert.throws(
    () =>
      createTicket(
        {
          ...input,
          title: "  ",
          assetId: "lueftung-l401",
          priority: "UNKNOWN",
        },
        data,
        now,
      ),
    (error: unknown) =>
      error instanceof DomainError &&
      !!error.fields.title &&
      !!error.fields.assetId &&
      !!error.fields.priority,
  );
  assert.throws(
    () => createTicket({ ...input, reporterId: "missing" }, data, now),
    DomainError,
  );
});

test("Bearbeitung benötigt passende Demo-Rolle und gültige Minuten", () => {
  const data = createDemoData(now);
  const ticket = createTicket(input, data, now);
  assert.throws(
    () =>
      applyTicketAction(
        ticket,
        { type: "assign", actorId: "thomas", assigneeId: "marco" },
        data,
      ),
    /Demo-Rolle/,
  );
  applyTicketAction(
    ticket,
    { type: "assign", actorId: "anna", assigneeId: "marco" },
    data,
  );
  applyTicketAction(
    ticket,
    { type: "status", actorId: "marco", status: "IN_PROGRESS" },
    data,
  );
  for (const minutes of [0, -1, 1.5, 1441, "30"]) {
    assert.throws(
      () =>
        applyTicketAction(
          ticket,
          { type: "work", actorId: "marco", measure: "Prüfung", minutes },
          data,
        ),
      DomainError,
    );
  }
  assert.throws(
    () =>
      applyTicketAction(
        ticket,
        { type: "assign", actorId: "anna", assigneeId: null },
        data,
      ),
    /Verantwortlichen/,
  );
});

test("Demo-Daten bleiben nach Neuinstanziierung erhalten; parallele Nummern sind eindeutig", async () => {
  const directory = await mkdtemp(join(tmpdir(), "om-cmms-demo-"));
  try {
    const filename = join(directory, "demo.json");
    const repository = new DemoRepository(filename);
    const created = await Promise.all(
      Array.from({ length: 12 }, () =>
        repository.mutate((data) => createTicket(input, data, now)),
      ),
    );
    assert.equal(new Set(created.map((ticket) => ticket.number)).size, 12);
    const reopened = new DemoRepository(filename);
    const state = await reopened.read();
    assert.equal(state.tickets.length, 24);
    assert.ok(state.tickets.some((ticket) => ticket.id === created[0].id));
    await assert.rejects(
      repository.mutate((data) => {
        data.tickets.length = 0;
        throw new Error("Abort");
      }),
      /Abort/,
    );
    assert.equal((await repository.read()).tickets.length, 24);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
