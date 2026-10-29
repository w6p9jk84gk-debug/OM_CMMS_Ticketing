"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  ClipboardList,
  Clock3,
  Database,
  Factory,
  LayoutDashboard,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  PRIORITIES,
  STATUSES,
  priorityLabels,
  roleLabels,
  statusLabels,
  type ApiError,
  type AppState,
  type CreateTicketInput,
  type Person,
  type Priority,
  type Role,
  type Ticket,
  type TicketAction,
  type TicketStatus,
} from "@/lib/types";

type View = "dashboard" | "tickets" | "new" | "detail" | "master";
type Notice = { text: string; kind: "success" | "error" } | null;
const dateFormat = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Zurich",
});
const timeFormat = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});
const dayFormat = new Intl.DateTimeFormat("de-CH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Zurich",
});
const formatDate = (date: string) => dateFormat.format(new Date(date));
const formatTime = (date: string) => timeFormat.format(new Date(date));
const isOverdue = (ticket: Ticket, now: string) =>
  ticket.status !== "DONE" &&
  new Date(ticket.dueAt).getTime() < new Date(now).getTime();
const personName = (data: AppState, id: string | null) =>
  data.people.find((person) => person.id === id)?.name ??
  "Noch nicht zugewiesen";
const assetName = (data: AppState, id: string) =>
  data.assets.find((asset) => asset.id === id)?.name ?? "Unbekannte Anlage";
const locationName = (data: AppState, id: string) =>
  data.locations.find((location) => location.id === id)?.name ??
  "Unbekannter Standort";

class RequestError extends Error {
  fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.fields = fields;
  }
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
      cache: "no-store",
    });
  } catch {
    throw new RequestError(
      "Der Server ist nicht erreichbar. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as ApiError | null;
    throw new RequestError(
      error?.error ??
        "Die Aktion konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      error?.fields,
    );
  }
  return body as T;
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const Icon =
    status === "DONE"
      ? CheckCircle2
      : status === "IN_PROGRESS"
        ? Wrench
        : status === "ASSIGNED"
          ? Users
          : Circle;
  return (
    <span className={`status-badge ${status.toLowerCase()}`}>
      <Icon size={13} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon =
    priority === "CRITICAL"
      ? CircleAlert
      : priority === "HIGH"
        ? ArrowUpRight
        : priority === "LOW"
          ? ArrowDown
          : SlidersHorizontal;
  return (
    <span className={`priority-badge ${priority.toLowerCase()}`}>
      <Icon size={14} aria-hidden="true" />
      {priorityLabels[priority]}
    </span>
  );
}
function Loading() {
  return (
    <main className="loading-screen" aria-live="polite">
      <Loader2 className="spinner" size={28} />
      <p>Störungsmanagement wird geladen …</p>
    </main>
  );
}
export function CmmsApp(props: { view: View; ticketId?: string }) {
  return (
    <Suspense fallback={<Loading />}>
      <AppContent {...props} />
    </Suspense>
  );
}

function AppContent({ view, ticketId }: { view: View; ticketId?: string }) {
  const [data, setData] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [role, setRole] = useState<Role>("COORDINATOR");
  const [notice, setNotice] = useState<Notice>(null);
  const load = useCallback(async () => {
    try {
      const next = await request<AppState>("/api/state");
      setData(next);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Daten konnten nicht geladen werden.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
    const saved = localStorage.getItem("om-cmms-role");
    if (
      saved === "REPORTER" ||
      saved === "TECHNICIAN" ||
      saved === "COORDINATOR"
    )
      setRole(saved);
  }, [load]);
  const changeRole = (value: Role) => {
    setRole(value);
    localStorage.setItem("om-cmms-role", value);
    setNotice(null);
  };
  if (!data) {
    if (loadError)
      return (
        <main className="standalone-state">
          <CircleAlert size={32} />
          <h1>Verbindung nicht verfügbar</h1>
          <p role="alert">{loadError}</p>
          <button className="button primary" onClick={() => void load()}>
            Erneut versuchen
          </button>
        </main>
      );
    return <Loading />;
  }
  const person =
    data.people.find((item) => item.role === role) ?? data.people[0];
  const active = view === "new" || view === "detail" ? "tickets" : view;
  const ticket = data.tickets.find((item) => item.id === ticketId);
  const pageLabel =
    view === "dashboard"
      ? "Dashboard"
      : view === "master"
        ? "Stammdaten"
        : "Störungsmeldungen";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="OM CMMS Dashboard">
          <span className="brand-mark">
            <Factory size={25} strokeWidth={1.7} />
          </span>
          <span className="brand-name">
            OM <strong>CMMS</strong>
            <small>OPERATIONS & MAINTENANCE</small>
          </span>
        </Link>
        <div className="sidebar-label">ARBEITSPLATZ</div>
        <nav aria-label="Hauptnavigation">
          <Link
            className={`nav-link ${active === "dashboard" ? "active" : ""}`}
            href="/"
            aria-current={active === "dashboard" ? "page" : undefined}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </Link>
          <Link
            className={`nav-link ${active === "tickets" ? "active" : ""}`}
            href="/tickets"
            aria-current={active === "tickets" ? "page" : undefined}
          >
            <ClipboardList size={19} />
            <span>Störungsmeldungen</span>
            <span className="nav-count">
              {data.tickets.filter((item) => item.status !== "DONE").length}
            </span>
          </Link>
          <Link
            className={`nav-link ${active === "master" ? "active" : ""}`}
            href="/stammdaten"
            aria-current={active === "master" ? "page" : undefined}
          >
            <Database size={19} />
            <span>Stammdaten</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-label">
            <span className="pilot-dot" />
            PILOT · VERSION 1.0
          </div>
          <p>
            Störungen im Blick.
            <br />
            Instandhaltung im Griff.
          </p>
          <div className="sidebar-footnote">Lokaler Arbeitsplatz</div>
        </div>
      </aside>
      <div className="workspace-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Arbeitsplatz</span>
            <ChevronRight size={14} />
            <span>{pageLabel}</span>
            {view === "new" && (
              <>
                <ChevronRight size={14} />
                <strong>Neue Meldung</strong>
              </>
            )}
            {view === "detail" && ticket && (
              <>
                <ChevronRight size={14} />
                <strong>{ticket.number}</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <div className="role-control">
              <label htmlFor="demo-role">DEMOROLLE · keine Anmeldung</label>
              <select
                id="demo-role"
                value={role}
                onChange={(event) => changeRole(event.target.value as Role)}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="avatar" title={person?.name}>
              {person?.initials ?? "OM"}
            </div>
          </div>
        </header>
        <main className="main-content" id="main-content">
          <div
            className={`demo-banner ${data.mode === "postgres" ? "database-mode" : ""}`}
          >
            <span className="demo-tag">
              <Database size={14} />
              {data.mode === "demo" ? "DEMO-MODUS" : "LOKALE DATENBANK"}
            </span>
            <span>
              {data.mode === "demo"
                ? "Beispieldaten · Änderungen werden lokal gespeichert."
                : "PostgreSQL · Änderungen werden dauerhaft gespeichert."}{" "}
              <span className="demo-explanation">
                Rollenwechsel dient nur zur Demonstration.
              </span>
            </span>
          </div>
          {data.modeReason && (
            <details className="mode-details">
              <summary>Information zum Datenbetrieb</summary>
              <p>{data.modeReason}</p>
            </details>
          )}
          {loadError && (
            <div className="notice error" role="alert">
              {loadError}
              <button className="link-button" onClick={() => void load()}>
                Erneut laden
              </button>
            </div>
          )}
          {notice && (
            <div
              className={`notice ${notice.kind}`}
              role={notice.kind === "error" ? "alert" : "status"}
            >
              {notice.kind === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <CircleAlert size={18} />
              )}
              <span>{notice.text}</span>
              <button
                className="icon-button"
                aria-label="Hinweis schliessen"
                onClick={() => setNotice(null)}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {view === "dashboard" && <Dashboard data={data} person={person} />}
          {view === "tickets" && <TicketList data={data} />}
          {view === "new" && <NewTicket data={data} person={person} />}
          {view === "detail" &&
            (ticket ? (
              <TicketDetail
                data={data}
                ticket={ticket}
                person={person}
                reload={load}
                setNotice={setNotice}
              />
            ) : (
              <div className="empty-state panel">
                <ClipboardList size={34} />
                <h1>Ticket nicht gefunden</h1>
                <p>
                  Diese Störungsmeldung ist im aktuellen Datenbetrieb nicht
                  verfügbar.
                </p>
                <Link className="button primary" href="/tickets">
                  Zur Ticketliste
                </Link>
              </div>
            ))}
          {view === "master" && <MasterData data={data} />}
          <footer className="content-footer">
            <span>OM CMMS · Pilot für Störungsmanagement</span>
            <span>Alle Zeitangaben: Europe/Zurich</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
function TicketTable({ tickets, data }: { tickets: Ticket[]; data: AppState }) {
  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <thead>
          <tr>
            <th scope="col">Störungsmeldung</th>
            <th scope="col">Status</th>
            <th scope="col">Priorität</th>
            <th scope="col">Verantwortlich</th>
            <th scope="col">Erfasst</th>
            <th scope="col">
              <span className="sr-only">Öffnen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <Link href={`/tickets/${ticket.id}`} className="ticket-title">
                  <span className="ticket-number">{ticket.number}</span>
                  <strong>{ticket.title}</strong>
                </Link>
                <span className="location-line">
                  {assetName(data, ticket.assetId)} ·{" "}
                  {locationName(data, ticket.locationId)}
                </span>
              </td>
              <td>
                <StatusBadge status={ticket.status} />
              </td>
              <td>
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td>
                <div className="assignee">
                  {ticket.assigneeId ? (
                    <>
                      <span className="avatar small">
                        {
                          data.people.find(
                            (person) => person.id === ticket.assigneeId,
                          )?.initials
                        }
                      </span>
                      <span>{personName(data, ticket.assigneeId)}</span>
                    </>
                  ) : (
                    <span className="muted">Nicht zugewiesen</span>
                  )}
                </div>
              </td>
              <td>
                <span className="table-date">
                  {formatDate(ticket.createdAt)}
                </span>
                {isOverdue(ticket, data.now) && (
                  <span className="overdue">
                    <Clock3 size={12} />
                    Überfällig
                  </span>
                )}
              </td>
              <td>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="icon-button table-open"
                  aria-label={`${ticket.number} öffnen`}
                >
                  <ChevronRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ data, person }: { data: AppState; person: Person }) {
  const open = data.tickets.filter((ticket) => ticket.status !== "DONE");
  const processing = data.tickets.filter(
    (ticket) => ticket.status === "IN_PROGRESS",
  );
  const overdue = data.tickets.filter((ticket) => isOverdue(ticket, data.now));
  const unassigned = open.filter((ticket) => !ticket.assigneeId);
  const latest = [...data.tickets]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const urgent = [...open]
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 3);
  const done = data.tickets.filter((ticket) => ticket.status === "DONE");
  return (
    <>
      <PageHeading
        eyebrow="BETRIEBSÜBERSICHT"
        title="Alles im Blick."
        description={`Guten Tag, ${person.name.split(" ")[0]}. Hier ist der aktuelle Stand Ihrer Störungsmeldungen.`}
      >
        <Link className="button primary" href="/tickets/new">
          <Plus size={19} />
          Störung melden
        </Link>
      </PageHeading>
      <div className="dashboard-date">
        <span className="live-dot" />
        Aktueller Überblick<span>{dayFormat.format(new Date(data.now))}</span>
      </div>
      <div className="stats-grid">
        <Link href="/tickets?status=open" className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Offene Tickets</span>
            <span className="stat-icon">
              <ClipboardList size={20} />
            </span>
          </div>
          <div className="stat-value">
            {open.length.toString().padStart(2, "0")}
          </div>
          <div className="stat-bottom">
            <span className="stat-note">
              Alle noch nicht erledigten Meldungen
            </span>
            <ArrowUpRight className="stat-arrow" size={19} />
          </div>
        </Link>
        <Link href="/tickets?status=IN_PROGRESS" className="stat-card">
          <div className="stat-top">
            <span className="stat-label">In Bearbeitung</span>
            <span className="stat-icon teal">
              <Wrench size={20} />
            </span>
          </div>
          <div className="stat-value">
            {processing.length.toString().padStart(2, "0")}
          </div>
          <div className="stat-bottom">
            <span className="stat-note">Aktuell in der Instandhaltung</span>
            <ArrowUpRight className="stat-arrow" size={19} />
          </div>
        </Link>
        <Link href="/tickets?overdue=true" className="stat-card attention">
          <div className="stat-top">
            <span className="stat-label">Überfällig</span>
            <span className="stat-icon orange">
              <Clock3 size={20} />
            </span>
          </div>
          <div className="stat-value">
            {overdue.length.toString().padStart(2, "0")}
          </div>
          <div className="stat-bottom">
            <span className="stat-note">Zieltermin überschritten</span>
            <ArrowUpRight className="stat-arrow" size={19} />
          </div>
        </Link>
        <Link
          href="/tickets?assignee=unassigned&status=open"
          className="stat-card"
        >
          <div className="stat-top">
            <span className="stat-label">Noch zuzuweisen</span>
            <span className="stat-icon violet">
              <Users size={20} />
            </span>
          </div>
          <div className="stat-value">
            {unassigned.length.toString().padStart(2, "0")}
          </div>
          <div className="stat-bottom">
            <span className="stat-note">Verantwortliche Person fehlt</span>
            <ArrowUpRight className="stat-arrow" size={19} />
          </div>
        </Link>
      </div>
      <div className="dashboard-grid">
        <section className="panel latest-panel">
          <div className="panel-heading">
            <div>
              <h2>Neueste Störungsmeldungen</h2>
              <p>Die zuletzt erfassten Meldungen im Betrieb</p>
            </div>
            <Link href="/tickets" className="link-button">
              Alle anzeigen
              <ArrowRight size={16} />
            </Link>
          </div>
          {latest.length ? (
            <TicketTable tickets={latest} data={data} />
          ) : (
            <EmptyTickets />
          )}
          <div className="panel-footer">
            <span>{data.tickets.length} Meldungen insgesamt</span>
            <span>
              <CheckCheck size={15} />
              {done.length} erledigt
            </span>
          </div>
        </section>
        <aside className="dashboard-aside">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <span className="heading-icon">
                    <CircleAlert size={18} />
                  </span>
                  Jetzt im Fokus
                </h2>
                <p>Offene Meldungen nach Zieltermin</p>
              </div>
            </div>
            <div className="focus-list">
              {urgent.length ? (
                urgent.map((ticket) => (
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="focus-ticket"
                    key={ticket.id}
                  >
                    <div className="focus-heading">
                      <span className="ticket-number">{ticket.number}</span>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <h3>{ticket.title}</h3>
                    <p>{assetName(data, ticket.assetId)}</p>
                    <div className="focus-meta">
                      <span
                        className={
                          isOverdue(ticket, data.now) ? "text-danger" : ""
                        }
                      >
                        <Clock3 size={13} />
                        {isOverdue(ticket, data.now)
                          ? "Überfällig"
                          : `Ziel: ${formatDate(ticket.dueAt)}`}
                      </span>
                      <ChevronRight size={16} />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="empty-state">
                  <CheckCircle2 size={26} />
                  <p>Alle Meldungen sind erledigt.</p>
                </div>
              )}
            </div>
          </section>
          <section className="quick-card">
            <span className="quick-icon">
              <ShieldCheck size={23} />
            </span>
            <h2>Ein klarer Ablauf.</h2>
            <p>
              Erfassen, zuweisen, bearbeiten und mit dokumentierter Massnahme
              abschliessen.
            </p>
            <Link href="/tickets/new" className="link-button">
              Neue Störung erfassen
              <ArrowRight size={16} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="overview-strip">
        <div>
          <Building2 size={20} />
          <span>
            <strong>{data.locations.length} Standorte</strong>
            <small>im Pilotbetrieb</small>
          </span>
        </div>
        <div>
          <Factory size={20} />
          <span>
            <strong>{data.assets.length} Anlagen</strong>
            <small>in den Stammdaten</small>
          </span>
        </div>
        <div>
          <Users size={20} />
          <span>
            <strong>{data.people.length} Personen</strong>
            <small>im Beispielteam</small>
          </span>
        </div>
        <Link href="/stammdaten">
          Stammdaten ansehen
          <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}

function EmptyTickets({ reset }: { reset?: () => void }) {
  return (
    <div className="empty-state">
      <Search size={32} />
      <h3>
        {reset
          ? "Keine passenden Störungsmeldungen"
          : "Noch keine Störungsmeldungen"}
      </h3>
      <p>
        {reset
          ? "Passen Sie Ihre Suche oder die Filter an."
          : "Erfassen Sie die erste Störung für Ihren Betrieb."}
      </p>
      {reset ? (
        <button className="button secondary" onClick={reset}>
          Filter zurücksetzen
        </button>
      ) : (
        <Link className="button primary" href="/tickets/new">
          Störung melden
        </Link>
      )}
    </div>
  );
}
function TicketList({ data }: { data: AppState }) {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [priority, setPriority] = useState(params.get("priority") ?? "");
  const [asset, setAsset] = useState(params.get("asset") ?? "");
  const [assignee, setAssignee] = useState(params.get("assignee") ?? "");
  const [overdue, setOverdue] = useState(params.get("overdue") === "true");
  const reset = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setAsset("");
    setAssignee("");
    setOverdue(false);
  };
  const hasFilters = Boolean(
    search || status || priority || asset || assignee || overdue,
  );
  const filtered = data.tickets
    .filter((ticket) => {
      const q = search.trim().toLocaleLowerCase("de");
      return (
        (!q ||
          `${ticket.number} ${ticket.title}`
            .toLocaleLowerCase("de")
            .includes(q)) &&
        (!status ||
          (status === "open"
            ? ticket.status !== "DONE"
            : ticket.status === status)) &&
        (!priority || ticket.priority === priority) &&
        (!asset || ticket.assetId === asset) &&
        (!assignee ||
          (assignee === "unassigned"
            ? !ticket.assigneeId
            : ticket.assigneeId === assignee)) &&
        (!overdue || isOverdue(ticket, data.now))
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeading
        eyebrow="STÖRUNGSMANAGEMENT"
        title="Störungsmeldungen"
        description="Alle Meldungen zentral erfassen, priorisieren und bearbeiten."
      >
        <Link className="button primary" href="/tickets/new">
          <Plus size={19} />
          Störung melden
        </Link>
      </PageHeading>
      <section
        className="panel filter-panel"
        aria-label="Tickets suchen und filtern"
      >
        <div className="filter-top">
          <div className="search-field">
            <Search size={19} />
            <input
              aria-label="Ticketnummer oder Titel suchen"
              placeholder="Ticketnummer oder Titel suchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Suche löschen"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(event) => setOverdue(event.target.checked)}
            />
            Nur überfällige
          </label>
        </div>
        <div className="filters-grid">
          <label className="filter-field">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Alle Status</option>
              <option value="open">Alle offenen</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Priorität
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="">Alle Prioritäten</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {priorityLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Anlage
            <select
              value={asset}
              onChange={(event) => setAsset(event.target.value)}
            >
              <option value="">Alle Anlagen</option>
              {data.assets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Verantwortlich
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Alle Personen</option>
              <option value="unassigned">Nicht zugewiesen</option>
              {data.people
                .filter((person) => person.role !== "REPORTER")
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            Ticketübersicht{" "}
            <span className="count-pill">{filtered.length}</span>
          </h2>
          {hasFilters && (
            <button className="link-button" onClick={reset}>
              <X size={15} />
              Filter zurücksetzen
            </button>
          )}
        </div>
        {filtered.length ? (
          <TicketTable tickets={filtered} data={data} />
        ) : (
          <EmptyTickets reset={hasFilters ? reset : undefined} />
        )}
        <div className="panel-footer">
          <span>
            {filtered.length} von {data.tickets.length} Meldungen
          </span>
          <span>Neueste zuerst</span>
        </div>
      </section>
    </>
  );
}

function FieldError({
  errors,
  name,
}: {
  errors: Record<string, string>;
  name: string;
}) {
  return errors[name] ? (
    <span className="field-error" id={`${name}-error`}>
      {errors[name]}
    </span>
  ) : null;
}
function NewTicket({ data, person }: { data: AppState; person: Person }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    locationId: "",
    assetId: "",
    priority: "MEDIUM" as Priority,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (name: string, value: string) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "locationId" ? { assetId: "" } : {}),
    }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fields: Record<string, string> = {};
    if (!form.title.trim())
      fields.title = "Bitte geben Sie einen Titel für die Störung ein.";
    if (!form.description.trim())
      fields.description = "Bitte beschreiben Sie die Störung.";
    if (!form.locationId)
      fields.locationId = "Bitte wählen Sie einen Standort.";
    if (!form.assetId)
      fields.assetId = "Bitte wählen Sie die betroffene Anlage.";
    setErrors(fields);
    if (Object.keys(fields).length) {
      document.getElementById(Object.keys(fields)[0])?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload: CreateTicketInput = { ...form, reporterId: person.id };
      const ticket = await request<Ticket>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/tickets/${ticket.id}?created=true`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Die Meldung konnte nicht gespeichert werden.",
      );
      if (caught instanceof RequestError && caught.fields)
        setErrors(caught.fields);
      setSaving(false);
    }
  }
  const attributes = (name: string) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  return (
    <>
      <Link href="/tickets" className="back-link">
        <ArrowRight size={16} />
        Zurück zur Übersicht
      </Link>
      <PageHeading
        eyebrow="NEUE STÖRUNGSMELDUNG"
        title="Was ist passiert?"
        description="Beschreiben Sie die Störung. Ihr Team übernimmt die nächsten Schritte."
      />
      <div className="form-layout">
        <form className="panel form-panel" onSubmit={submit} noValidate>
          <div className="panel-heading">
            <div>
              <h2>Angaben zur Störung</h2>
              <p>Mit * gekennzeichnete Felder sind Pflichtfelder.</p>
            </div>
            <ClipboardList size={23} className="muted" />
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <label className="field full" htmlFor="title">
                Titel *
                <input
                  id="title"
                  name="title"
                  maxLength={160}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="z. B. Kühlwasserpumpe verliert Druck"
                  {...attributes("title")}
                />
                <FieldError errors={errors} name="title" />
              </label>
              <label className="field full" htmlFor="description">
                Beschreibung *
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  maxLength={5000}
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  placeholder="Was wurde beobachtet? Seit wann besteht die Störung? Welche Auswirkungen hat sie auf den Betrieb?"
                  {...attributes("description")}
                />
                <FieldError errors={errors} name="description" />
                <span className="field-help">
                  Konkrete Beobachtungen helfen bei der schnellen Bearbeitung.
                </span>
              </label>
              <label className="field" htmlFor="locationId">
                Standort *
                <select
                  id="locationId"
                  name="locationId"
                  value={form.locationId}
                  onChange={(event) => update("locationId", event.target.value)}
                  {...attributes("locationId")}
                >
                  <option value="">Standort wählen</option>
                  {data.locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <FieldError errors={errors} name="locationId" />
              </label>
              <label className="field" htmlFor="assetId">
                Anlage *
                <select
                  id="assetId"
                  name="assetId"
                  value={form.assetId}
                  onChange={(event) => update("assetId", event.target.value)}
                  disabled={!form.locationId}
                  {...attributes("assetId")}
                >
                  <option value="">
                    {form.locationId
                      ? "Anlage wählen"
                      : "Zuerst Standort wählen"}
                  </option>
                  {data.assets
                    .filter((item) => item.locationId === form.locationId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.name}
                      </option>
                    ))}
                </select>
                <FieldError errors={errors} name="assetId" />
              </label>
              <label className="field full" htmlFor="priority">
                Priorität *
                <select
                  id="priority"
                  name="priority"
                  value={form.priority}
                  onChange={(event) => update("priority", event.target.value)}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabels[priority]}
                      {priority === "CRITICAL"
                        ? " · Stillstand / sofortiger Handlungsbedarf"
                        : priority === "HIGH"
                          ? " · Betrieb stark beeinträchtigt"
                          : priority === "MEDIUM"
                            ? " · Betrieb eingeschränkt"
                            : " · Geringe Beeinträchtigung"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <div className="notice error" role="alert">
                <CircleAlert size={18} />
                {error}
              </div>
            )}
          </div>
          <div className="form-actions">
            <Link href="/tickets" className="button secondary">
              Abbrechen
            </Link>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? (
                <Loader2 size={18} className="spinner" />
              ) : (
                <Plus size={18} />
              )}
              {saving ? "Wird gespeichert …" : "Störung speichern"}
            </button>
          </div>
        </form>
        <aside>
          <section className="panel info-panel">
            <div className="panel-heading">
              <h2>Ihre Meldung</h2>
            </div>
            <div className="panel-body">
              <div className="reporter-block">
                <span className="avatar">{person.initials}</span>
                <div>
                  <strong>{person.name}</strong>
                  <p>{roleLabels[person.role]} · Demorolle</p>
                </div>
              </div>
              <dl className="info-list">
                <div>
                  <dt>Erfassungszeit</dt>
                  <dd>Automatisch beim Speichern</dd>
                </div>
                <div>
                  <dt>Startstatus</dt>
                  <dd>
                    <StatusBadge status="NEW" />
                  </dd>
                </div>
                <div>
                  <dt>Ticketnummer</dt>
                  <dd>Wird automatisch vergeben</dd>
                </div>
              </dl>
            </div>
          </section>
          <section className="quick-card">
            <MessageSquare size={25} />
            <h2>
              Gut beschrieben.
              <br />
              Schneller behoben.
            </h2>
            <p>
              Nennen Sie auffällige Geräusche, Fehlermeldungen oder betroffene
              Anlagenteile.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

function TicketDetail({
  data,
  ticket,
  person,
  reload,
  setNotice,
}: {
  data: AppState;
  ticket: Ticket;
  person: Person;
  reload: () => Promise<void>;
  setNotice: (notice: Notice) => void;
}) {
  const params = useSearchParams();
  const [busy, setBusy] = useState("");
  const [assignee, setAssignee] = useState(ticket.assigneeId ?? "");
  const [comment, setComment] = useState("");
  const [measure, setMeasure] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [workError, setWorkError] = useState("");
  const [commentError, setCommentError] = useState("");
  useEffect(() => setAssignee(ticket.assigneeId ?? ""), [ticket.assigneeId]);
  const canEdit = person.role !== "REPORTER";
  const done = ticket.status === "DONE";
  const totalMinutes = ticket.workLogs.reduce(
    (sum, item) => sum + item.minutes,
    0,
  );
  async function act(action: TicketAction, key: string, success: string) {
    setBusy(key);
    setNotice(null);
    try {
      await request<Ticket>(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify(action),
      });
      await reload();
      setNotice({ text: success, kind: "success" });
      return true;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Die Änderung konnte nicht gespeichert werden.",
        kind: "error",
      });
      return false;
    } finally {
      setBusy("");
    }
  }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) {
      setCommentError("Bitte geben Sie einen Kommentar ein.");
      return;
    }
    setCommentError("");
    if (
      await act(
        { type: "comment", actorId: person.id, text: comment },
        "comment",
        "Kommentar hinzugefügt.",
      )
    )
      setComment("");
  }
  async function addWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!measure.trim()) {
      setWorkError("Bitte beschreiben Sie die durchgeführte Massnahme.");
      return;
    }
    if (
      !Number.isInteger(Number(minutes)) ||
      Number(minutes) < 1 ||
      Number(minutes) > 1440
    ) {
      setWorkError(
        "Bitte geben Sie einen Zeitaufwand zwischen 1 und 1440 Minuten ein.",
      );
      return;
    }
    setWorkError("");
    if (
      await act(
        { type: "work", actorId: person.id, measure, minutes: Number(minutes) },
        "work",
        "Massnahme und Zeitaufwand dokumentiert.",
      )
    ) {
      setMeasure("");
      setMinutes("30");
    }
  }
  const steps: TicketStatus[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "DONE"];
  const currentStep = steps.indexOf(ticket.status);
  const asset = data.assets.find((item) => item.id === ticket.assetId);
  return (
    <>
      <Link href="/tickets" className="back-link">
        <ArrowRight size={16} />
        Zurück zur Übersicht
      </Link>
      {params.get("created") === "true" && (
        <div className="notice success" role="status">
          <CheckCircle2 size={18} />
          Die Störung wurde als {ticket.number} erfasst.
        </div>
      )}
      <PageHeading
        eyebrow={ticket.number}
        title={ticket.title}
        description={`${assetName(data, ticket.assetId)} · ${locationName(data, ticket.locationId)}`}
      >
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </PageHeading>
      <div className="workflow-steps" aria-label="Bearbeitungsfortschritt">
        {steps.map((status, index) => (
          <div
            key={status}
            className={`workflow-step ${index < currentStep ? "is-complete" : ""} ${index === currentStep ? "is-current" : ""}`}
            aria-current={index === currentStep ? "step" : undefined}
          >
            <span className="step-number">
              {index < currentStep ? <Check size={16} /> : index + 1}
            </span>
            <span>{statusLabels[status]}</span>
            {index < steps.length - 1 && (
              <ChevronRight className="step-chevron" size={17} />
            )}
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel">
            <div className="panel-heading">
              <h2>Störungsbeschreibung</h2>
              <ClipboardList size={20} className="muted" />
            </div>
            <div className="panel-body">
              <p className="description">{ticket.description}</p>
              <div className="meta-grid">
                <div className="meta-item">
                  <span>Standort</span>
                  <strong>
                    <MapPin size={15} />
                    {locationName(data, ticket.locationId)}
                  </strong>
                </div>
                <div className="meta-item">
                  <span>Anlage</span>
                  <strong>
                    {asset?.code} · {asset?.name}
                  </strong>
                </div>
                <div className="meta-item">
                  <span>Gemeldet von</span>
                  <strong>{personName(data, ticket.reporterId)}</strong>
                </div>
                <div className="meta-item">
                  <span>Erfasst am</span>
                  <strong>{formatTime(ticket.createdAt)}</strong>
                </div>
              </div>
            </div>
          </section>
          <section className="panel" id="massnahmen">
            <div className="panel-heading">
              <div>
                <h2>Massnahmen & Zeitaufwand</h2>
                <p>Dokumentation der durchgeführten Arbeiten</p>
              </div>
              <span className="count-pill">
                <Clock3 size={14} />
                {totalMinutes} Min.
              </span>
            </div>
            <div className="panel-body">
              {ticket.workLogs.length ? (
                <div className="work-list">
                  {ticket.workLogs.map((work) => (
                    <article className="work-entry" key={work.id}>
                      <div className="comment-header">
                        <strong>
                          <Wrench size={15} />
                          {personName(data, work.authorId)}
                        </strong>
                        <span>
                          {formatTime(work.createdAt)} · {work.minutes} Min.
                        </span>
                      </div>
                      <p className="comment-content">{work.measure}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted empty-inline">
                  Noch keine Massnahme dokumentiert.
                </p>
              )}
              {canEdit && ticket.status !== "IN_PROGRESS" && !done && (
                <div className="notice info compact">
                  Starten Sie die Bearbeitung, um Massnahmen und Zeitaufwand zu
                  dokumentieren.
                </div>
              )}
              {canEdit && ticket.status === "IN_PROGRESS" && (
                <form onSubmit={addWork} className="inline-form" noValidate>
                  <label className="field" htmlFor="measure">
                    Durchgeführte Massnahme *
                    <textarea
                      id="measure"
                      rows={3}
                      maxLength={5000}
                      value={measure}
                      onChange={(event) => setMeasure(event.target.value)}
                      placeholder="Was wurde geprüft, repariert oder ausgetauscht?"
                      aria-invalid={Boolean(workError)}
                      aria-describedby={workError ? "work-error" : undefined}
                    />
                  </label>
                  <div className="work-form-bottom">
                    <label className="field minutes-field" htmlFor="minutes">
                      Zeitaufwand (Minuten) *
                      <input
                        id="minutes"
                        type="number"
                        min="1"
                        max="1440"
                        step="1"
                        value={minutes}
                        onChange={(event) => setMinutes(event.target.value)}
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={Boolean(busy)}
                      type="submit"
                    >
                      {busy === "work" ? (
                        <Loader2 size={17} className="spinner" />
                      ) : (
                        <Plus size={17} />
                      )}
                      Massnahme speichern
                    </button>
                  </div>
                  {workError && (
                    <p className="field-error" id="work-error" role="alert">
                      {workError}
                    </p>
                  )}
                </form>
              )}
              {done && (
                <div className="notice success compact">
                  <CheckCircle2 size={17} />
                  Bearbeitung abgeschlossen am{" "}
                  {formatTime(ticket.closedAt ?? ticket.updatedAt)}.
                </div>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                Kommentare{" "}
                <span className="count-pill">{ticket.comments.length}</span>
              </h2>
              <MessageSquare size={20} className="muted" />
            </div>
            <div className="panel-body">
              <div className="comment-list">
                {ticket.comments.length ? (
                  ticket.comments.map((item) => (
                    <article className="comment" key={item.id}>
                      <span className="avatar small">
                        {
                          data.people.find(
                            (entry) => entry.id === item.authorId,
                          )?.initials
                        }
                      </span>
                      <div>
                        <div className="comment-header">
                          <strong>{personName(data, item.authorId)}</strong>
                          <span>{formatTime(item.createdAt)}</span>
                        </div>
                        <p className="comment-content">{item.text}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted empty-inline">
                    Noch keine Kommentare. Ergänzen Sie eine Beobachtung oder
                    Rückfrage.
                  </p>
                )}
              </div>
              <form onSubmit={addComment} className="inline-form" noValidate>
                <label className="field" htmlFor="comment">
                  Kommentar hinzufügen
                  <textarea
                    id="comment"
                    rows={3}
                    maxLength={3000}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Informationen für das Team …"
                    aria-invalid={Boolean(commentError)}
                    aria-describedby={
                      commentError ? "comment-error" : undefined
                    }
                  />
                </label>
                {commentError && (
                  <p className="field-error" id="comment-error" role="alert">
                    {commentError}
                  </p>
                )}
                <div className="comment-actions">
                  <span className="muted">Als {person.name}</span>
                  <button
                    className="button secondary"
                    disabled={Boolean(busy)}
                    type="submit"
                  >
                    {busy === "comment" ? (
                      <Loader2 size={17} className="spinner" />
                    ) : (
                      <MessageSquare size={17} />
                    )}
                    Kommentar senden
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <div className="panel-heading">
              <h2>Bearbeitung</h2>
              <Wrench size={20} className="muted" />
            </div>
            <div className="panel-body">
              {canEdit ? (
                <>
                  <label className="field" htmlFor="assignee">
                    Verantwortliche Person
                    <select
                      id="assignee"
                      value={assignee}
                      onChange={(event) => setAssignee(event.target.value)}
                      disabled={done || Boolean(busy)}
                    >
                      <option
                        value=""
                        disabled={ticket.status === "IN_PROGRESS"}
                      >
                        Nicht zugewiesen
                      </option>
                      {data.people
                        .filter((item) => item.role !== "REPORTER")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!done && (
                    <button
                      className="button secondary full-width"
                      disabled={
                        Boolean(busy) || assignee === (ticket.assigneeId ?? "")
                      }
                      onClick={() =>
                        void act(
                          {
                            type: "assign",
                            actorId: person.id,
                            assigneeId: assignee || null,
                          },
                          "assign",
                          "Zuweisung gespeichert.",
                        )
                      }
                    >
                      <Users size={17} />
                      Zuweisung speichern
                    </button>
                  )}
                </>
              ) : (
                <div className="meta-item">
                  <span>Verantwortliche Person</span>
                  <strong>{personName(data, ticket.assigneeId)}</strong>
                </div>
              )}
              <dl className="info-list">
                <div>
                  <dt>Aktueller Status</dt>
                  <dd>
                    <StatusBadge status={ticket.status} />
                  </dd>
                </div>
                <div>
                  <dt>Zieltermin</dt>
                  <dd
                    className={isOverdue(ticket, data.now) ? "text-danger" : ""}
                  >
                    {formatTime(ticket.dueAt)}
                    {isOverdue(ticket, data.now) && (
                      <span className="overdue">
                        <Clock3 size={12} />
                        Überfällig
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Letzte Änderung</dt>
                  <dd>{formatTime(ticket.updatedAt)}</dd>
                </div>
              </dl>
              {canEdit && !done && (
                <div className="status-actions">
                  {ticket.status !== "IN_PROGRESS" && (
                    <>
                      <button
                        className="button primary full-width"
                        disabled={Boolean(busy) || !ticket.assigneeId}
                        onClick={() =>
                          void act(
                            {
                              type: "status",
                              actorId: person.id,
                              status: "IN_PROGRESS",
                            },
                            "status",
                            "Bearbeitung gestartet.",
                          )
                        }
                      >
                        <Wrench size={17} />
                        Bearbeitung starten
                      </button>
                      {!ticket.assigneeId && (
                        <p className="field-help">
                          Weisen Sie zuerst eine verantwortliche Person zu.
                        </p>
                      )}
                    </>
                  )}
                  {ticket.status === "IN_PROGRESS" && (
                    <button
                      className="button secondary full-width"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void act(
                          {
                            type: "status",
                            actorId: person.id,
                            status: "ASSIGNED",
                          },
                          "status",
                          "Ticket auf Zugewiesen zurückgesetzt.",
                        )
                      }
                    >
                      <Users size={17} />
                      Auf Zugewiesen zurücksetzen
                    </button>
                  )}
                  <button
                    className="button primary full-width"
                    disabled={
                      Boolean(busy) ||
                      !ticket.workLogs.length ||
                      ticket.status !== "IN_PROGRESS"
                    }
                    onClick={() =>
                      void act(
                        { type: "status", actorId: person.id, status: "DONE" },
                        "status",
                        "Störung erfolgreich abgeschlossen.",
                      )
                    }
                  >
                    <CheckCheck size={18} />
                    Ticket abschliessen
                  </button>
                  {(!ticket.workLogs.length ||
                    ticket.status !== "IN_PROGRESS") && (
                    <p className="field-help">
                      Zum Abschluss muss die Bearbeitung gestartet und
                      mindestens eine Massnahme dokumentiert sein.
                    </p>
                  )}
                </div>
              )}
              {!canEdit && (
                <div className="notice info compact">
                  In der Demorolle Melder können Sie Kommentare ergänzen.
                  Wechseln Sie zur Bearbeitung oben zu Instandhalter oder
                  Koordinator.
                </div>
              )}
              {done && (
                <>
                  <div className="notice success compact">
                    <CheckCircle2 size={18} />
                    Diese Störung ist erledigt.
                  </div>
                  {canEdit && (
                    <button
                      className="button secondary full-width"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void act(
                          {
                            type: "status",
                            actorId: person.id,
                            status: "IN_PROGRESS",
                          },
                          "status",
                          "Ticket wieder zur Bearbeitung geöffnet.",
                        )
                      }
                    >
                      <Wrench size={17} />
                      Ticket wieder öffnen
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Verlauf</h2>
                <p>Änderungen nachvollziehbar dokumentiert</p>
              </div>
            </div>
            <ol className="timeline">
              {[...ticket.history]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((event) => (
                  <li className="timeline-item" key={event.id}>
                    <span
                      className={`timeline-marker ${event.kind.toLowerCase()}`}
                    >
                      {event.kind === "STATUS" ? (
                        <Check size={12} />
                      ) : event.kind === "ASSIGNMENT" ? (
                        <Users size={12} />
                      ) : event.kind === "WORK" ? (
                        <Wrench size={12} />
                      ) : event.kind === "COMMENT" ? (
                        <MessageSquare size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                    </span>
                    <div className="timeline-content">
                      <strong>{event.text}</strong>
                      <span>{personName(data, event.actorId)}</span>
                      <time dateTime={event.createdAt}>
                        {formatTime(event.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

function MasterData({ data }: { data: AppState }) {
  return (
    <>
      <PageHeading
        eyebrow="BETRIEBLICHE GRUNDLAGEN"
        title="Stammdaten"
        description="Standorte, Anlagen und Personen für den Pilotbetrieb. Die Übersicht ist schreibgeschützt."
      />
      <div className="section-heading">
        <h2>Standorte & Anlagen</h2>
        <span className="muted">
          {data.locations.length} Standorte · {data.assets.length} Anlagen
        </span>
      </div>
      <div className="asset-grid">
        {data.locations.map((location) => (
          <section key={location.id} className="panel asset-card">
            <div className="panel-heading">
              <div>
                <span className="asset-icon">
                  <Building2 size={24} />
                </span>
                <h2>{location.name}</h2>
                <p>{location.description}</p>
              </div>
            </div>
            <div className="asset-details">
              {data.assets
                .filter((asset) => asset.locationId === location.id)
                .map((asset) => (
                  <div className="asset-item" key={asset.id}>
                    <Factory size={19} />
                    <div>
                      <strong>{asset.name}</strong>
                      <span>
                        {asset.code} · {asset.category}
                      </span>
                    </div>
                    <Link
                      className="icon-button"
                      href={`/tickets?asset=${asset.id}`}
                      aria-label={`Tickets für ${asset.name} anzeigen`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
      <div className="section-heading">
        <h2>Team & Demorollen</h2>
        <span className="muted">{data.people.length} Personen</span>
      </div>
      <div className="people-grid">
        {data.people.map((person) => (
          <article className="panel person-card" key={person.id}>
            <span className="avatar">{person.initials}</span>
            <div>
              <h3>{person.name}</h3>
              <span className="person-role">{roleLabels[person.role]}</span>
              <p>{person.specialty}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="notice info">
        <ShieldCheck size={20} />
        <span>
          Der Rollenwechsel oben dient zur Demonstration der Arbeitsabläufe. Er
          ist keine Anmeldung und bietet keine Zugriffssicherung.
        </span>
      </div>
    </>
  );
}
