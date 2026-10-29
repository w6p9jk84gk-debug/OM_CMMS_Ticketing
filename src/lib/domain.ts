import { randomUUID } from "node:crypto";
import {
  PRIORITIES,
  STATUSES,
  statusLabels,
  type HistoryEvent,
  type Person,
  type Priority,
  type Ticket,
  type TicketStatus,
} from "./types";
import type { StoreData } from "./repository";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const dueHours: Record<Priority, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};
const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["ASSIGNED"],
  ASSIGNED: ["NEW", "IN_PROGRESS"],
  IN_PROGRESS: ["ASSIGNED", "DONE"],
  DONE: ["IN_PROGRESS"],
};

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new DomainError(
      "Die Eingaben sind ungültig. Bitte das Formular prüfen.",
    );
  return input as Record<string, unknown>;
}
function text(
  value: unknown,
  field: string,
  label: string,
  max: number,
  fields: Record<string, string>,
): string {
  if (typeof value !== "string" || !value.trim()) {
    fields[field] = `Bitte ${label} angeben.`;
    return "";
  }
  const result = value.trim();
  if (result.length > max)
    fields[field] = `Bitte höchstens ${max} Zeichen eingeben.`;
  return result;
}
function fail(fields: Record<string, string>) {
  if (Object.keys(fields).length)
    throw new DomainError("Bitte die markierten Eingaben prüfen.", fields);
}
function person(data: StoreData, id: unknown, field: string): Person {
  const found = data.people.find((entry) => entry.id === id);
  if (!found)
    throw new DomainError("Bitte eine vorhandene Person auswählen.", {
      [field]: "Die ausgewählte Person ist ungültig.",
    });
  return found;
}
function event(
  ticket: Ticket,
  actorId: string,
  kind: HistoryEvent["kind"],
  eventText: string,
  now: string,
) {
  ticket.history.push({
    id: randomUUID(),
    actorId,
    kind,
    text: eventText,
    createdAt: now,
  });
  ticket.updatedAt = now;
}

export function createTicket(
  input: unknown,
  data: StoreData,
  now = new Date(),
): Ticket {
  const body = object(input);
  const fields: Record<string, string> = {};
  const title = text(body.title, "title", "einen Titel", 160, fields);
  const description = text(
    body.description,
    "description",
    "eine Beschreibung",
    6000,
    fields,
  );
  const location = data.locations.find((entry) => entry.id === body.locationId);
  const asset = data.assets.find((entry) => entry.id === body.assetId);
  if (!location) fields.locationId = "Bitte einen Standort auswählen.";
  if (!asset) fields.assetId = "Bitte eine Anlage auswählen.";
  else if (location && asset.locationId !== location.id)
    fields.assetId = "Die Anlage gehört nicht zum ausgewählten Standort.";
  if (!PRIORITIES.includes(body.priority as Priority))
    fields.priority = "Bitte eine gültige Priorität auswählen.";
  if (!data.people.some((entry) => entry.id === body.reporterId))
    fields.reporterId = "Bitte einen Melder auswählen.";
  fail(fields);
  const priority = body.priority as Priority;
  const timestamp = now.toISOString();
  const ticket: Ticket = {
    id: randomUUID(),
    number: `OM-${now.getUTCFullYear()}-${String(data.nextNumber++).padStart(4, "0")}`,
    title,
    description,
    locationId: location!.id,
    assetId: asset!.id,
    priority,
    status: "NEW",
    reporterId: body.reporterId as string,
    assigneeId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    dueAt: new Date(now.getTime() + dueHours[priority] * 3600000).toISOString(),
    closedAt: null,
    comments: [],
    workLogs: [],
    history: [],
  };
  event(ticket, ticket.reporterId, "CREATED", "Störung erfasst.", timestamp);
  data.tickets.push(ticket);
  return ticket;
}

export function applyTicketAction(
  ticket: Ticket,
  input: unknown,
  data: StoreData,
  now = new Date(),
): Ticket {
  const body = object(input);
  const actor = person(data, body.actorId, "actorId");
  const timestamp = now.toISOString();
  if (
    typeof body.type !== "string" ||
    !["assign", "status", "comment", "work"].includes(body.type)
  )
    throw new DomainError("Diese Ticketaktion ist nicht verfügbar.");
  // These role checks demonstrate workflow only: actorId is client-selectable, not authentication.
  if (body.type !== "comment" && actor.role === "REPORTER")
    throw new DomainError(
      "Für die Bearbeitung bitte zur Demo-Rolle Instandhalter oder Koordinator wechseln.",
      {},
      403,
    );
  if (body.type === "assign") {
    if (ticket.status === "DONE")
      throw new DomainError(
        "Das Ticket ist erledigt. Vor einer neuen Zuweisung bitte wieder in Bearbeitung nehmen.",
      );
    const assignee =
      body.assigneeId === null
        ? null
        : person(data, body.assigneeId, "assigneeId");
    if (assignee?.role === "REPORTER")
      throw new DomainError(
        "Bitte einen Instandhalter oder Koordinator zuweisen.",
        { assigneeId: "Melder können keine Tickets übernehmen." },
      );
    if (!assignee && ticket.status === "IN_PROGRESS")
      throw new DomainError(
        "Ein Ticket in Bearbeitung benötigt einen Verantwortlichen. Bitte zuerst auf Zugewiesen zurücksetzen.",
      );
    if (ticket.assigneeId === (assignee?.id ?? null)) return ticket;
    ticket.assigneeId = assignee?.id ?? null;
    event(
      ticket,
      actor.id,
      "ASSIGNMENT",
      assignee
        ? `Verantwortung an ${assignee.name} zugewiesen.`
        : "Zuweisung aufgehoben.",
      timestamp,
    );
    const nextStatus =
      assignee && ticket.status === "NEW"
        ? "ASSIGNED"
        : !assignee && ticket.status === "ASSIGNED"
          ? "NEW"
          : ticket.status;
    if (nextStatus !== ticket.status) {
      event(
        ticket,
        actor.id,
        "STATUS",
        `Status von ${statusLabels[ticket.status]} auf ${statusLabels[nextStatus]} geändert.`,
        timestamp,
      );
      ticket.status = nextStatus;
    }
  }
  if (body.type === "status") {
    if (!STATUSES.includes(body.status as TicketStatus))
      throw new DomainError("Bitte einen gültigen Status auswählen.", {
        status: "Der Status ist ungültig.",
      });
    const status = body.status as TicketStatus;
    if (status === ticket.status) return ticket;
    if (!transitions[ticket.status].includes(status))
      throw new DomainError(
        `Der Wechsel von ${statusLabels[ticket.status]} auf ${statusLabels[status]} ist nicht möglich. Bitte den Bearbeitungsablauf einhalten.`,
        { status: "Dieser Statuswechsel ist nicht möglich." },
      );
    if (
      (status === "ASSIGNED" || status === "IN_PROGRESS") &&
      !ticket.assigneeId
    )
      throw new DomainError("Bitte zuerst einen Verantwortlichen zuweisen.", {
        assigneeId: "Für diesen Status ist eine Zuweisung erforderlich.",
      });
    if (
      status === "DONE" &&
      !ticket.workLogs.some((entry) => entry.measure.trim())
    )
      throw new DomainError(
        "Zum Abschliessen muss mindestens eine Massnahme dokumentiert sein.",
        { measure: "Bitte zuerst eine Massnahme dokumentieren." },
      );
    if (status === "NEW" && ticket.assigneeId)
      throw new DomainError(
        "Bitte die Zuweisung aufheben, um das Ticket auf Neu zu setzen.",
      );
    event(
      ticket,
      actor.id,
      "STATUS",
      `Status von ${statusLabels[ticket.status]} auf ${statusLabels[status]} geändert.`,
      timestamp,
    );
    ticket.status = status;
    ticket.closedAt = status === "DONE" ? timestamp : null;
  }
  if (body.type === "comment") {
    const fields: Record<string, string> = {};
    const commentText = text(
      body.text,
      "text",
      "einen Kommentar",
      4000,
      fields,
    );
    fail(fields);
    ticket.comments.push({
      id: randomUUID(),
      authorId: actor.id,
      text: commentText,
      createdAt: timestamp,
    });
    event(ticket, actor.id, "COMMENT", "Kommentar hinzugefügt.", timestamp);
  }
  if (body.type === "work") {
    if (ticket.status === "DONE")
      throw new DomainError(
        "Das Ticket ist erledigt. Für weitere Massnahmen bitte wieder in Bearbeitung nehmen.",
      );
    if (ticket.status !== "IN_PROGRESS")
      throw new DomainError("Bitte das Ticket zuerst in Bearbeitung nehmen.");
    const fields: Record<string, string> = {};
    const measure = text(
      body.measure,
      "measure",
      "eine Massnahme",
      6000,
      fields,
    );
    if (
      typeof body.minutes !== "number" ||
      !Number.isInteger(body.minutes) ||
      body.minutes < 1 ||
      body.minutes > 1440
    )
      fields.minutes =
        "Bitte einen Zeitaufwand von 1 bis 1440 ganzen Minuten angeben.";
    fail(fields);
    ticket.workLogs.push({
      id: randomUUID(),
      authorId: actor.id,
      measure,
      minutes: body.minutes as number,
      createdAt: timestamp,
    });
    event(
      ticket,
      actor.id,
      "WORK",
      `Massnahme dokumentiert (${body.minutes} Min.).`,
      timestamp,
    );
  }
  return ticket;
}
