import { expect, test } from "@playwright/test";
import type { AppState, Ticket } from "../../src/lib/types";

test("Störung im Browser erfassen, zuweisen, bearbeiten und mit Massnahme abschliessen", async ({
  page,
  request,
}) => {
  const data: AppState = await (await request.get("/api/state")).json();
  const asset = data.assets[0];
  const technician = data.people.find(
    (person) => person.role === "TECHNICIAN",
  )!;
  const title = `Pumpenleck Browserprüfung ${Date.now()}`;
  const comment = "Druckversorgung abgeschaltet und Arbeitsbereich gesichert.";
  const measure =
    "Flanschdichtung erneuert, Schrauben nachgezogen und Probelauf ohne Leckage durchgeführt.";

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Alles im Blick." }),
  ).toBeVisible();
  await page.screenshot({ path: "work/dashboard-desktop.png", fullPage: true });
  await page.getByLabel("DEMOROLLE · keine Anmeldung").selectOption("REPORTER");
  await page.getByRole("link", { name: "Störung melden", exact: true }).click();
  await page.getByRole("button", { name: "Störung speichern" }).click();
  await expect(
    page.getByText("Bitte geben Sie einen Titel für die Störung ein."),
  ).toBeVisible();
  await expect(page.getByLabel(/^Titel/)).toBeFocused();
  await expect(page.getByLabel(/^Anlage/)).toBeDisabled();

  await page.getByLabel(/^Titel/).fill(title);
  await page
    .getByLabel(/^Beschreibung/)
    .fill(
      "Am Pumpenflansch tropft Kühlwasser. Der Druck fällt unter 1,5 bar und die Produktion läuft eingeschränkt.",
    );
  await page.getByLabel(/^Standort/).selectOption(asset.locationId);
  await page.getByLabel(/^Anlage/).selectOption(asset.id);
  await page.getByLabel(/^Priorität/).selectOption("HIGH");
  await page.getByRole("button", { name: "Störung speichern" }).click();
  await expect(page).toHaveURL(/\/tickets\/[^/?]+\?created=true$/);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Neu");
  await expect(
    page.getByRole("button", { name: "Zuweisung speichern" }),
  ).toHaveCount(0);

  await page
    .getByLabel("DEMOROLLE · keine Anmeldung")
    .selectOption("COORDINATOR");
  await page.getByLabel("Verantwortliche Person").selectOption(technician.id);
  await page.getByRole("button", { name: "Zuweisung speichern" }).click();
  await expect(page.locator('[aria-current="step"]')).toContainText(
    "Zugewiesen",
  );

  await page
    .getByLabel("DEMOROLLE · keine Anmeldung")
    .selectOption("TECHNICIAN");
  await page.getByRole("button", { name: "Bearbeitung starten" }).click();
  await expect(page.locator('[aria-current="step"]')).toContainText(
    "In Bearbeitung",
  );
  await expect(
    page.getByRole("button", { name: "Ticket abschliessen" }),
  ).toBeDisabled();
  await page.getByLabel("Kommentar hinzufügen").fill(comment);
  await page.getByRole("button", { name: "Kommentar senden" }).click();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Massnahme speichern" }).click();
  await expect(
    page.getByText("Bitte beschreiben Sie die durchgeführte Massnahme."),
  ).toBeVisible();
  await page.getByLabel(/^Durchgeführte Massnahme/).fill(measure);
  await page.getByLabel(/^Zeitaufwand \(Minuten\)/).fill("45");
  await page.getByRole("button", { name: "Massnahme speichern" }).click();
  await expect(page.getByText(measure, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ticket abschliessen" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Ticket abschliessen" }).click();
  await expect(page.locator('[aria-current="step"]')).toContainText("Erledigt");
  await expect(
    page.getByText(`Verantwortung an ${technician.name} zugewiesen.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Status von In Bearbeitung auf Erledigt geändert.", {
      exact: true,
    }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator('[aria-current="step"]')).toContainText("Erledigt");
  await expect(page.getByText(measure, { exact: true })).toBeVisible();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await page.screenshot({
    path: "work/ticket-completed-desktop.png",
    fullPage: true,
  });
});

test("Ticketliste sucht Nummer und Titel, kombiniert alle Filter und bietet einen Leerzustand", async ({
  page,
  request,
}) => {
  const data: AppState = await (await request.get("/api/state")).json();
  const asset = data.assets[0];
  const technician = data.people.find(
    (person) => person.role === "TECHNICIAN",
  )!;
  const coordinator = data.people.find(
    (person) => person.role === "COORDINATOR",
  )!;
  const response = await request.post("/api/tickets", {
    data: {
      title: `Filterprüfung Lüfter ${Date.now()}`,
      description:
        "Eintrag zur unabhängigen Prüfung von Suche und kombinierten Filtern.",
      locationId: asset.locationId,
      assetId: asset.id,
      priority: "HIGH",
      reporterId: coordinator.id,
    },
  });
  expect(response.status()).toBe(201);
  const ticket: Ticket = await response.json();
  const assignment = await request.patch(`/api/tickets/${ticket.id}`, {
    data: {
      type: "assign",
      actorId: coordinator.id,
      assigneeId: technician.id,
    },
  });
  expect(assignment.ok()).toBeTruthy();

  await page.goto("/tickets");
  const search = page.getByLabel("Ticketnummer oder Titel suchen");
  await search.fill(ticket.number);
  await expect(
    page.getByRole("link", {
      name: `${ticket.number} ${ticket.title}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await search.fill(ticket.title);
  await page.getByLabel(/^Status/).selectOption("ASSIGNED");
  await page.getByLabel(/^Priorität/).selectOption("HIGH");
  await page.getByLabel(/^Anlage/).selectOption(asset.id);
  await page.getByLabel(/^Verantwortlich/).selectOption(technician.id);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel(/^Status/).selectOption("DONE");
  await expect(
    page.getByRole("heading", { name: "Keine passenden Störungsmeldungen" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Filter zurücksetzen" })
    .first()
    .click();
  await expect(search).toHaveValue("");
  await expect(page.getByLabel(/^Status/)).toHaveValue("");
  await expect(page.getByLabel(/^Priorität/)).toHaveValue("");
  await expect(page.getByLabel(/^Anlage/)).toHaveValue("");
  await expect(page.getByLabel(/^Verantwortlich/)).toHaveValue("");
  await expect(
    page.getByRole("link", {
      name: `${ticket.number} ${ticket.title}`,
      exact: true,
    }),
  ).toBeVisible();
});

test("Smartphone: Navigation, Meldungsformular und Stammdaten passen in den Bildschirm", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const noHorizontalOverflow = async () => {
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  };
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Alles im Blick." }),
  ).toBeVisible();
  await noHorizontalOverflow();
  await page.screenshot({ path: "work/dashboard-mobile.png", fullPage: true });
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("link", { name: /Störungsmeldungen/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Störungsmeldungen", exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow();
  await page.getByRole("link", { name: "Störung melden", exact: true }).click();
  await expect(page.getByLabel(/^Titel/)).toBeVisible();
  await noHorizontalOverflow();
  await page.screenshot({ path: "work/new-ticket-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Abbrechen", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("link", { name: "Stammdaten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Stammdaten", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Er ist keine Anmeldung und bietet keine Zugriffssicherung/),
  ).toBeVisible();
  await noHorizontalOverflow();
});
