import type { StoreData } from "./repository";
import type { Priority, Ticket, TicketStatus } from "./types";
import { dueHours } from "./domain";

/** Dates are relative to first initialization, making a fresh pilot meaningful. */
export function createDemoData(now = new Date()): StoreData {
  const locations = [
    {
      id: "werk-nord",
      name: "Werk Nord",
      description: "Produktion · Halle 1 und 2",
    },
    {
      id: "logistik",
      name: "Logistikzentrum",
      description: "Wareneingang und Versand",
    },
    {
      id: "technik",
      name: "Technikgebäude",
      description: "Versorgung und Gebäudetechnik",
    },
  ];
  const assets = [
    {
      id: "pumpe-p101",
      name: "Kühlwasserpumpe P-101",
      code: "P-101",
      locationId: "werk-nord",
      category: "Pumpe",
    },
    {
      id: "foerderer-f201",
      name: "Förderanlage F-201",
      code: "F-201",
      locationId: "werk-nord",
      category: "Fördertechnik",
    },
    {
      id: "kompressor-k102",
      name: "Druckluftkompressor K-102",
      code: "K-102",
      locationId: "werk-nord",
      category: "Druckluft",
    },
    {
      id: "foerderer-f301",
      name: "Rollenförderer F-301",
      code: "F-301",
      locationId: "logistik",
      category: "Fördertechnik",
    },
    {
      id: "lueftung-l401",
      name: "Lüftungsanlage L-401",
      code: "L-401",
      locationId: "technik",
      category: "Lüftung",
    },
    {
      id: "pumpe-p402",
      name: "Heizungspumpe P-402",
      code: "P-402",
      locationId: "technik",
      category: "Pumpe",
    },
  ];
  const people: StoreData["people"] = [
    {
      id: "anna",
      name: "Anna Keller",
      role: "COORDINATOR",
      initials: "AK",
      specialty: "Koordination Instandhaltung",
    },
    {
      id: "marco",
      name: "Marco Weber",
      role: "TECHNICIAN",
      initials: "MW",
      specialty: "Mechanik und Fördertechnik",
    },
    {
      id: "sarah",
      name: "Sarah Meier",
      role: "TECHNICIAN",
      initials: "SM",
      specialty: "Elektrik und Gebäudetechnik",
    },
    {
      id: "thomas",
      name: "Thomas Berger",
      role: "REPORTER",
      initials: "TB",
      specialty: "Schichtleitung Produktion",
    },
    {
      id: "lena",
      name: "Lena Fischer",
      role: "REPORTER",
      initials: "LF",
      specialty: "Logistik und Versand",
    },
  ];
  const examples: Array<{
    title: string;
    description: string;
    assetId: string;
    priority: Priority;
    status: TicketStatus;
    age: number;
    assigneeId: string | null;
    reporterId?: string;
  }> = [
    {
      title: "Kühlwasserpumpe verliert Druck",
      description:
        "Der Druck am Manometer fällt im Betrieb von 3,2 auf 1,4 bar. Am Flansch ist Feuchtigkeit sichtbar. Produktion läuft aktuell mit reduzierter Leistung.",
      assetId: "pumpe-p101",
      priority: "CRITICAL",
      status: "NEW",
      age: 1,
      assigneeId: null,
    },
    {
      title: "Förderband stoppt unregelmässig",
      description:
        "Das Förderband in Halle 2 bleibt nach wenigen Minuten stehen. Am Bedienpanel erscheint Fehler E-24. Anlage wurde angehalten und gegen Wiedereinschalten gesichert.",
      assetId: "foerderer-f201",
      priority: "HIGH",
      status: "IN_PROGRESS",
      age: 29,
      assigneeId: "marco",
    },
    {
      title: "Lüftung: ungewöhnlich starke Vibrationen",
      description:
        "An der Zuluftanlage sind seit der Frühschicht starke Vibrationen und ein metallisches Geräusch feststellbar. Bitte Lager und Befestigungen prüfen.",
      assetId: "lueftung-l401",
      priority: "HIGH",
      status: "ASSIGNED",
      age: 3,
      assigneeId: "sarah",
    },
    {
      title: "Lichtschranke am Warenausgang erkennt Paletten nicht",
      description:
        "Paletten werden am Übergabepunkt sporadisch nicht erkannt. Die Linse wurde bereits gereinigt; der Fehler tritt weiterhin auf.",
      assetId: "foerderer-f301",
      priority: "HIGH",
      status: "NEW",
      age: 5,
      assigneeId: null,
      reporterId: "lena",
    },
    {
      title: "Druckluftleck am Anschlussstutzen",
      description:
        "Deutlich hörbares Zischen am Anschluss des Druckluftbehälters. Der Kompressor schaltet häufiger als üblich ein.",
      assetId: "kompressor-k102",
      priority: "MEDIUM",
      status: "ASSIGNED",
      age: 16,
      assigneeId: "marco",
    },
    {
      title: "Heizungspumpe zeigt Störung am Frequenzumrichter",
      description:
        "Display meldet Überstrom beim Anlauf. Die Reservepumpe übernimmt derzeit die Versorgung. Fehlercode und Betriebszustand sind am Schaltschrank notiert.",
      assetId: "pumpe-p402",
      priority: "HIGH",
      status: "IN_PROGRESS",
      age: 18,
      assigneeId: "sarah",
    },
    {
      title: "Schutzabdeckung am Förderer locker",
      description:
        "Die seitliche Abdeckung an Station 3 vibriert im Betrieb. Eine Befestigungsschraube fehlt. Der Bereich wurde abgesperrt.",
      assetId: "foerderer-f201",
      priority: "MEDIUM",
      status: "NEW",
      age: 78,
      assigneeId: null,
    },
    {
      title: "Temperaturanzeige der Lüftung ohne Funktion",
      description:
        "Die Anzeige am Bediengerät bleibt dunkel. Die Lüftung selbst läuft. Bitte Spannungsversorgung und Anzeige prüfen.",
      assetId: "lueftung-l401",
      priority: "LOW",
      status: "NEW",
      age: 22,
      assigneeId: null,
    },
    {
      title: "Rollenförderer läuft seitlich an",
      description:
        "Im Kurvenbereich schleifen Transportbehälter an der Führung. Abrieb ist sichtbar. Keine Beschädigung der Behälter festgestellt.",
      assetId: "foerderer-f301",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      age: 48,
      assigneeId: "marco",
      reporterId: "lena",
    },
    {
      title: "Kondensatablass am Kompressor undicht",
      description:
        "Unter dem Kondensatablass sammelt sich Flüssigkeit. Auffangwanne aufgestellt und Boden gereinigt.",
      assetId: "kompressor-k102",
      priority: "MEDIUM",
      status: "ASSIGNED",
      age: 32,
      assigneeId: "sarah",
    },
    {
      title: "Beschriftung am Pumpenschaltschrank beschädigt",
      description:
        "Die Kennzeichnung des Hauptschalters ist kaum noch lesbar. Ersatzbeschriftung für die sichere Zuordnung erforderlich.",
      assetId: "pumpe-p101",
      priority: "LOW",
      status: "NEW",
      age: 50,
      assigneeId: null,
    },
    {
      title: "Heizungspumpe meldet Trockenlauf",
      description:
        "Die Pumpe schaltet nach kurzer Laufzeit ab. Druck im Heizkreis wurde geprüft; Entlüftung ist erforderlich.",
      assetId: "pumpe-p402",
      priority: "HIGH",
      status: "DONE",
      age: 72,
      assigneeId: "sarah",
    },
  ];
  const tickets: Ticket[] = examples.map((example, index) => {
    const asset = assets.find((entry) => entry.id === example.assetId)!;
    const createdAt = new Date(
      now.getTime() - example.age * 3600000,
    ).toISOString();
    const activityAt = new Date(
      new Date(createdAt).getTime() + 20 * 60000,
    ).toISOString();
    const reporterId = example.reporterId ?? "thomas";
    const ticket: Ticket = {
      id: `demo-ticket-${1042 + index}`,
      number: `OM-${now.getUTCFullYear()}-${1042 + index}`,
      title: example.title,
      description: example.description,
      assetId: example.assetId,
      locationId: asset.locationId,
      priority: example.priority,
      status: example.status,
      reporterId,
      assigneeId: example.assigneeId,
      createdAt,
      updatedAt: createdAt,
      dueAt: new Date(
        new Date(createdAt).getTime() + dueHours[example.priority] * 3600000,
      ).toISOString(),
      closedAt: null,
      comments: [],
      workLogs: [],
      history: [
        {
          id: `seed-created-${index}`,
          actorId: reporterId,
          text: "Störung erfasst.",
          createdAt,
          kind: "CREATED",
        },
      ],
    };
    if (example.assigneeId) {
      const assignee = people.find((entry) => entry.id === example.assigneeId)!;
      ticket.history.push({
        id: `seed-assigned-${index}`,
        actorId: "anna",
        text: `Verantwortung an ${assignee.name} zugewiesen.`,
        createdAt: activityAt,
        kind: "ASSIGNMENT",
      });
      ticket.history.push({
        id: `seed-status-assigned-${index}`,
        actorId: "anna",
        text: "Status von Neu auf Zugewiesen geändert.",
        createdAt: activityAt,
        kind: "STATUS",
      });
      ticket.updatedAt = activityAt;
    }
    if (example.status === "IN_PROGRESS" || example.status === "DONE") {
      ticket.history.push({
        id: `seed-progress-${index}`,
        actorId: example.assigneeId!,
        text: "Status von Zugewiesen auf In Bearbeitung geändert.",
        createdAt: activityAt,
        kind: "STATUS",
      });
      ticket.comments.push({
        id: `seed-comment-${index}`,
        authorId: example.assigneeId!,
        text: "Anlage vor Ort geprüft. Abstimmung mit der Schichtleitung erfolgt.",
        createdAt: activityAt,
      });
      ticket.history.push({
        id: `seed-comment-event-${index}`,
        actorId: example.assigneeId!,
        text: "Kommentar hinzugefügt.",
        createdAt: activityAt,
        kind: "COMMENT",
      });
    }
    if (example.status === "DONE") {
      const closedAt = new Date(
        new Date(createdAt).getTime() + 75 * 60000,
      ).toISOString();
      ticket.workLogs.push({
        id: `seed-work-${index}`,
        authorId: "sarah",
        measure:
          "Heizkreis entlüftet, Anlagendruck auf 2,0 bar eingestellt und Funktionsprüfung durchgeführt. Pumpe läuft störungsfrei.",
        minutes: 45,
        createdAt: closedAt,
      });
      ticket.history.push({
        id: `seed-work-event-${index}`,
        actorId: "sarah",
        text: "Massnahme dokumentiert (45 Min.).",
        createdAt: closedAt,
        kind: "WORK",
      });
      ticket.history.push({
        id: `seed-done-${index}`,
        actorId: "sarah",
        text: "Status von In Bearbeitung auf Erledigt geändert.",
        createdAt: closedAt,
        kind: "STATUS",
      });
      ticket.closedAt = closedAt;
      ticket.updatedAt = closedAt;
    }
    return ticket;
  });
  return { locations, assets, people, tickets, nextNumber: 1054 };
}
