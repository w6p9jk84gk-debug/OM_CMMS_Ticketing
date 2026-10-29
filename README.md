# OM CMMS · Störungsmanagement

Lokal lauffähiger Pilot für **Störung erfassen → zuweisen → bearbeiten → Massnahme dokumentieren → abschliessen**. Deutsche Oberfläche mit responsivem Dashboard, Ticketliste, Detailansicht und lesbaren Stammdaten. Geplante Wartung ist ausdrücklich nicht enthalten.

![Dashboard mit deutschen Beispieldaten](docs/dashboard.png)

[Smartphone-Vorschau](docs/mobile.png)

## Schnellstart: Demo ohne Datenbank

Voraussetzung: **Node.js 22 oder neuer** und npm. Die Installation benötigt Zugriff auf die kostenlose npm-Registrierung. Im Betrieb benötigt die Anwendung keine externen Dienste, Schriften oder APIs.

```bash
npm ci
npm run db:generate
npm run dev
```

Öffnen: **http://localhost:3000**. Ohne `DATABASE_URL` startet der gekennzeichnete Demo-Modus automatisch. Es ist keine `.env` notwendig.

Alternativ `cp .env.example .env` ausführen und `DATA_MODE=demo` beibehalten. Der Demo-Modus legt beim ersten Zugriff deutsche Beispieldaten in `.data/demo.json` an und speichert Änderungen dort. Ein Neustart erhält diese Daten. Zum Zurücksetzen bei **gestopptem Server** nur diese Datei löschen; der nächste Start legt die Beispiele neu an. `DEMO_DATA_PATH` erlaubt eine separate Datei für Tests. Demo-Dateien und lokale Konfiguration sind in `.gitignore` ausgeschlossen.

Die Demo-Datei ist für **einen lokalen Serverprozess** vorgesehen. Für mehrere Instanzen PostgreSQL verwenden. Demo- und Datenbankbestand sind getrennt; es gibt keinen automatischen Datenabgleich.

## PostgreSQL mit Prisma

Voraussetzung zusätzlich: Docker mit Compose, alternativ eine eigene lokale PostgreSQL-Instanz. Compose bindet Port 5432 ausschliesslich an localhost und erhält die Daten in einem benannten Volume.

```bash
cp .env.example .env
npm run db:up
```

In `.env` einstellen:

```dotenv
DATA_MODE=postgres
DATABASE_URL="postgresql://om_cmms:om_cmms_local@localhost:5432/om_cmms?schema=public"
```

Dann:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`db:seed` initialisiert einen leeren Datenbestand mit Beispieldaten und überschreibt vorhandene Tickets nicht. Die Compose-Zugangsdaten sind bewusst öffentliche **lokale Beispielwerte**, keine produktiven Geheimnisse. Eigene Zugangsdaten ausschliesslich in lokaler `.env` oder Prozessvariablen hinterlegen.

```bash
npm run db:down        # stoppt DB, erhält das Volume
npm run db:up          # startet DB mit vorhandenem Bestand
```

`docker compose down -v` würde den Datenbestand löschen und ist für den normalen Neustart nicht erforderlich.

Prisma 6 nutzt für den Datenzugriff den offiziellen PostgreSQL-JavaScript-Adapter. Die Client-Erzeugung verwendet die experimentelle WASM-Schema-Konfiguration aus `prisma.config.ts`, sodass keine plattformspezifischen Downloads von `binaries.prisma.sh` erforderlich sind. Dieser Host war in der Prüfumgebung gesperrt. `prisma migrate deploy` ist mit dieser Prisma-6-Adapterkonfiguration wegen eines Katalogtyp-Problems nicht nutzbar. Deshalb wendet `npm run db:migrate` die versionierten SQL-Dateien mit einem kleinen PostgreSQL-Migrationsskript an: transaktional, mit Sperre, SHA-256-Prüfsummen und der üblichen `_prisma_migrations`-Tabelle. Bereits angewendete Migrationen dürfen nicht verändert werden; neue Änderungen erhalten einen neuen Migrationsordner. Die experimentelle Prisma-Konfiguration sollte vor einem produktiven Ausbau erneut bewertet werden.

### Betriebsarten

| Einstellung | Verhalten |
| --- | --- |
| `DATA_MODE=demo` | Immer lokale Beispieldaten; keine Datenbank erforderlich. |
| `DATA_MODE=postgres` | PostgreSQL zwingend. Verbindungs-/Schemafehler werden angezeigt. Kein Wechsel auf Demo. |
| `DATA_MODE=auto` oder nicht gesetzt | Ohne DB-Konfiguration Demo. Mit DB-Konfiguration wird die Datenbank beim ersten Zugriff geprüft; ist sie nicht nutzbar, erscheint der gekennzeichnete Demo-Modus mit Begründung. |

Nach Auswahl der Datenbank führt ein späterer Verbindungsfehler **nicht** zu einem stillen Wechsel des Datenbestands. Änderungen am Betriebsmodus erfordern einen Serverneustart. Für verlässlichen Datenbankbetrieb `postgres` explizit setzen.

## Build und lokaler Betrieb

```bash
npm run build
npm start
```

Auch der optimierte Server läuft unter http://localhost:3000 und bindet standardmässig nur localhost. Entwicklungsserver und Produktionsserver nicht gleichzeitig mit demselben Port oder demselben `.next`-Verzeichnis betreiben. „Produktionsbuild“ bezeichnet die Next.js-Buildart; der Pilot besitzt noch keine produktive Zugriffssicherung.

## Web-Zugriff über Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/w6p9jk84gk-debug/OM_CMMS_Ticketing)

`render.yaml` beschreibt einen Web-Service (Node 22) und eine PostgreSQL-17-Datenbank in Frankfurt. Nach Klick auf den Button und Bestätigung im Render-Konto ist die Anwendung unter `https://om-cmms-ticketing.onrender.com` (bzw. der von Render vergebenen Adresse) erreichbar. Migration und Seed laufen beim Start automatisch.

Hinweise: Der Pilot hat **keine Anmeldung** – jede Person mit dem Link kann Tickets anlegen und ändern; nur fiktive Daten verwenden. Im kostenlosen Render-Plan schläft der Dienst nach Inaktivität (erster Aufruf dauert dann rund eine Minute), und die kostenlose Datenbank läuft nach 30 Tagen ab.

## Bedienung und Geschäftsregeln

- **Dashboard:** Offene Tickets (alle ausser Erledigt), davon in Bearbeitung, überfällige Tickets und neueste Meldungen. Kennzahlen führen zu passenden Listenfiltern.
- **Ticketliste:** Suche nach Ticketnummer/Titel und kombinierbare Filter nach Status, Priorität, Anlage und Verantwortlichem.
- **Störung melden:** Titel, Beschreibung, Standort, passende Anlage, Priorität und Melder. Serverzeit und eindeutige Nummer werden beim Speichern vergeben; anschliessend öffnet sich die Detailansicht.
- **Bearbeitung:** Eine Zuweisung setzt neue Tickets auf Zugewiesen. In Bearbeitung ist nur mit Verantwortlichem möglich. Kommentare, Massnahmen und Minuten werden mit Person und Zeit gespeichert. Abschliessen ist nur nach dokumentierter Massnahme möglich. Erledigte Tickets können wieder geöffnet werden.
- **Historie:** Erfassung, Statuswechsel, Zuweisungen, Kommentare und Arbeitsnachweise bleiben nachvollziehbar.
- **Stammdaten:** Beispielstandorte, Pumpen, Förder- und Lüftungsanlagen sowie Personen; keine Stammdatenverwaltung.

Der sichtbare Rollenwechsel demonstriert **Melder**, **Instandhalter** und **Koordinator**. Die Person wird vom Client gewählt. Dies ist **keine Anmeldung, Identitätsprüfung oder Zugriffssicherung**; auch die serverseitigen Rollenprüfungen demonstrieren lediglich den Ablauf.

Überfällig bedeutet: Zieltermin überschritten und Status nicht Erledigt. Die einfachen Pilot-Zielfristen ab Erfassung sind Kritisch **4 Stunden**, Hoch **24 Stunden**, Mittel **72 Stunden**, Niedrig **168 Stunden**. Das sind durchgehende Stunden ohne Schicht-/Feiertagskalender und ohne zugesicherte SLA. Zeitstempel werden als UTC gespeichert und in der Oberfläche für Europe/Zurich angezeigt. „Massnahme“ und „Minuten“ sind Pflichtangaben je Arbeitsnachweis (1–1440 ganze Minuten).

## Prüfung

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium  # einmalig, falls noch kein Browser vorhanden
npm run test:e2e
```

Die E2E-Prüfung startet einen isolierten Demo-Server auf Port 3100 und verwendet `work/e2e-demo.json`. Ein vorhandenes Chromium kann mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` verwendet werden. Mit `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` lassen sich dieselben Prüfungen gegen einen bereits laufenden Server ausführen; sie erzeugen dort Testtickets.

Die PostgreSQL-Prüfung benötigt migrierte und befüllte **Testdaten** sowie einen fertigen Build:

```bash
DATABASE_URL="postgresql://om_cmms:om_cmms_local@localhost:5432/om_cmms?schema=public" npm run test:persistence
```

Diese Prüfung startet zwei aufeinanderfolgende Serverprozesse auf Port 3201, durchläuft den Ticketablauf, prüft den verbotenen Abschluss ohne Massnahme und vergleicht Ticket, Kommentare, Massnahmen und Historie nach dem Neustart. Sie erzeugt ein gekennzeichnetes Prüfticket. Port bei Bedarf über `PERSISTENCE_TEST_PORT` ändern. Unter PowerShell Umgebungsvariablen mit `$env:NAME="Wert"` setzen.

### Tatsächlich geprüft am 29. Oktober 2026

- Produktionsbuild mit Next.js 16.4.3 und TypeScript-Prüfung erfolgreich.
- Vier Fachlogik-/Repositorytests erfolgreich, inklusive Abschlussregel, Validierung und zwölf parallelen Meldungen mit eindeutigen Nummern.
- Fünf Playwright-Prüfungen sowohl im Demo-Modus als auch im PostgreSQL-Produktionsbuild erfolgreich: API-Validierung, parallele Nummern, vollständiger Browserablauf mit Rollenwechsel, kombinierte Listenfilter sowie Smartphone-Navigation und Formular bei 390 px Breite.
- PostgreSQL 17: Schema angelegt, Seed ausgeführt, vollständiger Ticketablauf und exakter Datenvergleich nach Neustart des App-Servers erfolgreich.
- Datenbankausfall geprüft: `auto` zeigt ausdrücklich Demo mit Begründung; `postgres` antwortet mit verständlichem Fehler (HTTP 503).
- Migration und Seed erneut ausgeführt: vorhandene Daten bleiben erhalten.
- PostgreSQL-Container zusätzlich neu gestartet: erledigtes Prüfticket mit Massnahme und sieben Historieneinträgen unverändert vorhanden.

Die Prüfungen verwenden fiktive Daten. Echte Anmeldung, produktiver Lastbetrieb, Ausfallwiederherstellung aus Backups sowie weitere Browser wurden nicht geprüft.

## Aufbau

| Bereich | Verantwortung |
| --- | --- |
| `src/app`, `src/components` | Next.js-Routen und responsive Oberfläche |
| `src/app/api` | HTTP-Verträge, Eingaben und Fehlerantworten |
| `src/lib/types.ts` | Gemeinsame fachliche Typen und deutsche Bezeichnungen |
| `src/lib/domain.ts` | Validierung, Statusübergänge, Abschlussregeln und Historie |
| `src/lib/repository.ts` | Austauschbarer Datenzugriffsvertrag |
| `src/lib/repositories` | Dateibasierte Demo und transaktionales PostgreSQL mit Prisma |
| `src/lib/fixtures.ts` | Deutsche Beispieldaten |
| `prisma` | Relationales Schema, Migrationen und idempotentes Seeding |
| `tests`, `scripts/verify-persistence.ts` | Fachliche, Browser- und Persistenzprüfungen |

## Grenzen und nächste Schritte

Der Pilot ist für lokale Demonstration und fachliche Erprobung vorgesehen. Vor einem produktiven Einsatz fehlen insbesondere echte Anmeldung und serverseitige Autorisierung, abgestimmte Rechte/Datenschutz-/Aufbewahrungsregeln, Backup- und Wiederherstellungstests, Betriebsüberwachung, abgesicherte Bereitstellung mit TLS, Rate-Limits und belastbare Last-/Parallelitätsprüfungen. Historie und Arbeitsnachweise sind fachlich nachvollziehbar, aber kein revisionssicheres Audit-System.

Die Datenzugriffe laden im Pilot den vollständigen Bestand; für grosse Datenmengen sind serverseitige Filter, Pagination und gezielte Änderungen erforderlich. Die Oberfläche aktualisiert nach eigenen Aktionen und beim Seitenaufruf; es gibt keine Live-Synchronisierung zwischen mehreren Benutzern. Die Demo-Datei bietet keine Mehrprozess-Sicherheit. PostgreSQL serialisiert Schreibvorgänge für konsistente Nummern und Historie.

Nicht enthalten: geplante Wartung, Ersatzteillager/Einkauf, ERP-Anbindung, KI, produktive Benachrichtigungen, externe Automatisierungen und produktive Benutzerverwaltung.
