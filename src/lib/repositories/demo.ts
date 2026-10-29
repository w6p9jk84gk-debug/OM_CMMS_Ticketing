import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createDemoData } from "../fixtures";
import type { StoreData, TicketRepository } from "../repository";

/** One local Node process; intentionally not a shared multi-instance store. */
export class DemoRepository implements TicketRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private data: StoreData | undefined;
  constructor(
    private readonly filename = resolve(
      process.env.DEMO_DATA_PATH || ".data/demo.json",
    ),
  ) {}

  private async load(): Promise<StoreData> {
    if (this.data) return this.data;
    try {
      const parsed = JSON.parse(
        await readFile(this.filename, "utf8"),
      ) as StoreData;
      if (
        !Array.isArray(parsed.tickets) ||
        !Array.isArray(parsed.assets) ||
        !Array.isArray(parsed.people) ||
        !Array.isArray(parsed.locations) ||
        !Number.isSafeInteger(parsed.nextNumber)
      )
        throw new Error(
          "Ungültige Demo-Datendatei. Bitte sichern und den Demo-Modus neu initialisieren.",
        );
      this.data = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const initial = createDemoData();
      await this.persist(initial);
      this.data = initial;
    }
    return this.data;
  }
  private async persist(data: StoreData) {
    await mkdir(dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, this.filename);
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  read(): Promise<StoreData> {
    return this.serial(async () => structuredClone(await this.load()));
  }
  mutate<T>(operation: (data: StoreData) => T): Promise<T> {
    return this.serial(async () => {
      const next = structuredClone(await this.load());
      const result = operation(next);
      await this.persist(next);
      this.data = next;
      return structuredClone(result);
    });
  }
}
