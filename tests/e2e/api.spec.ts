import { expect, test } from "@playwright/test";
import type { AppState, Ticket } from "../../src/lib/types";

test("API validiert Eingaben und schützt den Abschluss ohne Massnahme", async ({
  request,
}) => {
  const stateResponse = await request.get("/api/state");
  expect(stateResponse.ok()).toBeTruthy();
  const state: AppState = await stateResponse.json();
  const reporter = state.people.find((person) => person.role === "REPORTER")!;
  const technician = state.people.find(
    (person) => person.role === "TECHNICIAN",
  )!;
  const coordinator = state.people.find(
    (person) => person.role === "COORDINATOR",
  )!;
  const asset = state.assets[0];

  const invalid = await request.post("/api/tickets", { data: {} });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toBeTruthy();

  const created = await request.post("/api/tickets", {
    data: {
      title: `API-Test Pumpendichtung ${Date.now()}`,
      description:
        "An der Wellendichtung tritt Kühlwasser aus. Der Bereich wurde abgesperrt.",
      locationId: asset.locationId,
      assetId: asset.id,
      priority: "HIGH",
      reporterId: reporter.id,
    },
  });
  expect(created.status()).toBe(201);
  const ticket: Ticket = await created.json();
  expect(ticket.status).toBe("NEW");
  expect(ticket.number).toMatch(/\d+/);

  const unknownPerson = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "assign",
      actorId: coordinator.id,
      assigneeId: "nicht-vorhanden",
    },
  });
  expect(unknownPerson.status()).toBe(400);

  const assigned = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "assign",
      actorId: coordinator.id,
      assigneeId: technician.id,
    },
  });
  expect(assigned.ok()).toBeTruthy();
  expect((await assigned.json()).status).toBe("ASSIGNED");

  const started = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "status",
      actorId: technician.id,
      status: "IN_PROGRESS",
    },
  });
  expect(started.ok()).toBeTruthy();

  const premature = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "status",
      actorId: technician.id,
      status: "DONE",
    },
  });
  expect(premature.status()).toBe(400);
  expect((await premature.json()).error).toMatch(/Massnahme|Maßnahme/);

  const negativeMinutes = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "work",
      actorId: technician.id,
      measure: "Dichtung erneuert.",
      minutes: -5,
    },
  });
  expect(negativeMinutes.status()).toBe(400);

  const work = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "work",
      actorId: technician.id,
      measure:
        "Gleitringdichtung ersetzt und Dichtheitsprüfung erfolgreich durchgeführt.",
      minutes: 45,
    },
  });
  expect(work.ok()).toBeTruthy();

  const completed = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "status",
      actorId: technician.id,
      status: "DONE",
    },
  });
  expect(completed.ok()).toBeTruthy();
  const result: Ticket = await completed.json();
  expect(result.status).toBe("DONE");
  expect(result.closedAt).toBeTruthy();
  expect(result.workLogs[0].minutes).toBe(45);
  expect(
    result.history.some((event) => event.kind === "ASSIGNMENT"),
  ).toBeTruthy();
  expect(
    result.history.filter((event) => event.kind === "STATUS").length,
  ).toBeGreaterThanOrEqual(2);

  const reloaded: AppState = await (await request.get("/api/state")).json();
  expect(reloaded.tickets.find((item) => item.id === ticket.id)).toEqual(
    result,
  );
});

test("gleichzeitige neue Meldungen erhalten verschiedene Ticketnummern", async ({
  request,
}) => {
  const state: AppState = await (await request.get("/api/state")).json();
  const asset = state.assets[0];
  const reporterId = state.people.find(
    (person) => person.role === "REPORTER",
  )!.id;
  const responses = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      request.post("/api/tickets", {
        data: {
          title: `Parallele Meldung ${Date.now()}-${index}`,
          description:
            "Prüfung der eindeutigen Nummernvergabe bei gleichzeitiger Erfassung.",
          locationId: asset.locationId,
          assetId: asset.id,
          priority: "LOW",
          reporterId,
        },
      }),
    ),
  );
  responses.forEach((response) => expect(response.status()).toBe(201));
  const tickets: Ticket[] = await Promise.all(
    responses.map((response) => response.json()),
  );
  expect(new Set(tickets.map((ticket) => ticket.number)).size).toBe(
    tickets.length,
  );
});
