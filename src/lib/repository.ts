import type { MasterData, Ticket } from "./types";

export interface StoreData extends MasterData {
  tickets: Ticket[];
  nextNumber: number;
}

/** Mutation callbacks run within a serialized write or database transaction. */
export interface TicketRepository {
  read(): Promise<StoreData>;
  mutate<T>(operation: (data: StoreData) => T): Promise<T>;
}
