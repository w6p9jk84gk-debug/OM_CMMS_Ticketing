export const STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "DONE"] as const;
export type TicketStatus = (typeof STATUSES)[number];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Role = "REPORTER" | "TECHNICIAN" | "COORDINATOR";
export const statusLabels: Record<TicketStatus, string> = {
  NEW: "Neu",
  ASSIGNED: "Zugewiesen",
  IN_PROGRESS: "In Bearbeitung",
  DONE: "Erledigt",
};
export const priorityLabels: Record<Priority, string> = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  CRITICAL: "Kritisch",
};
export const roleLabels: Record<Role, string> = {
  REPORTER: "Melder",
  TECHNICIAN: "Instandhalter",
  COORDINATOR: "Koordinator",
};
export interface Location {
  id: string;
  name: string;
  description: string;
}
export interface Asset {
  id: string;
  name: string;
  code: string;
  locationId: string;
  category: string;
}
export interface Person {
  id: string;
  name: string;
  role: Role;
  initials: string;
  specialty: string;
}
export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}
export interface WorkLog {
  id: string;
  authorId: string;
  measure: string;
  minutes: number;
  createdAt: string;
}
export interface HistoryEvent {
  id: string;
  actorId: string;
  text: string;
  createdAt: string;
  kind: "CREATED" | "STATUS" | "ASSIGNMENT" | "WORK" | "COMMENT";
}
export interface Ticket {
  id: string;
  number: string;
  title: string;
  description: string;
  locationId: string;
  assetId: string;
  priority: Priority;
  status: TicketStatus;
  reporterId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  closedAt: string | null;
  comments: Comment[];
  workLogs: WorkLog[];
  history: HistoryEvent[];
}
export interface MasterData {
  locations: Location[];
  assets: Asset[];
  people: Person[];
}
export interface AppState extends MasterData {
  tickets: Ticket[];
  mode: "demo" | "postgres";
  modeReason: string;
  now: string;
}
export interface CreateTicketInput {
  title: string;
  description: string;
  locationId: string;
  assetId: string;
  priority: Priority;
  reporterId: string;
}
export type TicketAction =
  | { type: "assign"; actorId: string; assigneeId: string | null }
  | { type: "status"; actorId: string; status: TicketStatus }
  | { type: "comment"; actorId: string; text: string }
  | { type: "work"; actorId: string; measure: string; minutes: number };
export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
