import { NextResponse } from "next/server";
import { DomainError } from "./domain";

export function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message, fields: error.fields },
      { status: error.status },
    );
  // Never include connection strings, SQL, or local paths in API responses or logs.
  console.error(
    "[OM-CMMS] Datenzugriff fehlgeschlagen:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    {
      error:
        "Die Daten konnten nicht gespeichert oder geladen werden. Bitte Verbindung und Server prüfen und erneut versuchen.",
    },
    { status: 503 },
  );
}
export async function readJson(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Local pilot: mutations only from its own browser origin. This is not authentication.
  if (origin) {
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      throw new DomainError(
        "Diese Anfrage stammt nicht von der Anwendung.",
        {},
        403,
      );
    }
    // Next dev may reconstruct request.url with localhost while the browser uses
    // 127.0.0.1. Host is the actual incoming authority; do not trust forwarded hosts.
    if (originUrl.host !== (request.headers.get("host") || url.host))
      throw new DomainError(
        "Diese Anfrage stammt nicht von der Anwendung.",
        {},
        403,
      );
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("Bitte die Eingaben als JSON senden.", {}, 415);
  const content = await request.text();
  if (Buffer.byteLength(content, "utf8") > 65536)
    throw new DomainError(
      "Die Eingabe ist zu gross. Bitte Text kürzen.",
      {},
      413,
    );
  try {
    return JSON.parse(content);
  } catch {
    throw new DomainError(
      "Die Eingaben konnten nicht gelesen werden. Bitte erneut versuchen.",
    );
  }
}
