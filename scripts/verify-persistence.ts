/** Black-box integration check against two independent production server processes. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import type { AppState, Ticket, TicketAction } from "../src/lib/types";

const port = Number(process.env.PERSISTENCE_TEST_PORT || 3201);
const base = `http://127.0.0.1:${port}`;
let server: ChildProcess | undefined;

async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        DATA_MODE: "postgres",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  server.stdout?.on("data", (data) => {
    log += data.toString();
  });
  server.stderr?.on("data", (data) => {
    log += data.toString();
  });
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Server konnte nicht starten: ${log}`);
    try {
      const response = await fetch(`${base}/api/state`);
      if (response.ok) return (await response.json()) as AppState;
      if (attempt === 89)
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (error) {
      if (attempt === 89) throw error;
    }
    await delay(500);
  }
  throw new Error(`Zeitüberschreitung beim Serverstart: ${log}`);
}

async function stop() {
  if (!server || server.exitCode !== null) return;
  const stopped = once(server, "exit");
  server.kill("SIGTERM");
  const killTimer = setTimeout(() => server?.kill("SIGKILL"), 5000);
  await stopped;
  clearTimeout(killTimer);
  server = undefined;
}

async function main() {
  assert.ok(
    process.env.DATABASE_URL,
    "DATABASE_URL muss auf eine lokale Testdatenbank zeigen.",
  );
  const state = await start();
  assert.equal(state.mode, "postgres");
  const reporter = state.people.find((p) => p.role === "REPORTER")!;
  const tech = state.people.find((p) => p.role === "TECHNICIAN")!;
  const coordinator = state.people.find((p) => p.role === "COORDINATOR")!;
  const asset = state.assets[0];
  const response = await fetch(`${base}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `Persistenzprüfung ${new Date().toISOString()}`,
      description:
        "Automatisierte Prüfung: Dichtung an der Kühlwasserpumpe und vollständiger Ticketablauf.",
      locationId: asset.locationId,
      assetId: asset.id,
      priority: "HIGH",
      reporterId: reporter.id,
    }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  let ticket = (await response.json()) as Ticket;
  async function action(body: TicketAction, expected = 200) {
    const result = await fetch(`${base}/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(result.status, expected, await result.clone().text());
    if (result.ok) ticket = (await result.json()) as Ticket;
  }
  await action({
    type: "assign",
    actorId: coordinator.id,
    assigneeId: tech.id,
  });
  await action({ type: "status", actorId: tech.id, status: "IN_PROGRESS" });
  const blocked = await fetch(`${base}/api/tickets/${ticket.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "status", actorId: tech.id, status: "DONE" }),
  });
  assert.ok(
    blocked.status === 400 || blocked.status === 422,
    "Abschluss ohne Massnahme muss scheitern.",
  );
  await action({
    type: "comment",
    actorId: tech.id,
    text: "Anlage gesichert, Dichtung wird geprüft.",
  });
  await action({
    type: "work",
    actorId: tech.id,
    measure:
      "Gleitringdichtung ersetzt und Probelauf ohne Leckage durchgeführt.",
    minutes: 45,
  });
  await action({ type: "status", actorId: tech.id, status: "DONE" });
  assert.equal(ticket.status, "DONE");
  const expected = ticket;
  await stop();
  const after = await start();
  const persisted = after.tickets.find((item) => item.id === expected.id);
  assert.deepEqual(
    persisted,
    expected,
    "Ticket, Kommentare, Massnahme, Zeit und Historie müssen einen Neustart überstehen.",
  );
  console.log(
    `PASS: ${ticket.number} – vollständiger PostgreSQL-Ablauf und unveränderte Daten nach Serverneustart.`,
  );
  console.log(
    `Ticket-ID für optionale Datenbank-Neustartprüfung: ${ticket.id}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stop);
