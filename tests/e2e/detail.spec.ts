// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { test, expect } from "@playwright/test";
import { setScenario } from "./helpers";

// Advisory detail page (plan task 14, spec §10, ADR-0001). The server load fetches
// the verbatim CSAF JSON from /api/documents/:id (served by the mock from the real
// DE + EN fixtures), then the page runs convertToDocModel → appStore → <Webview>.

test.beforeEach(async ({ request }) => {
  await setScenario(request, "ok");
});

test("navigates from the list to the detail permalink and renders the Webview", async ({
  page
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "ExampleApp: Schwachstelle ermöglicht Codeausführung" })
    .click();

  await expect(page).toHaveURL(/\/advisories\/1$/);

  // The vendored Webview's General section renders the advisory title + publisher
  // (the publisher name also appears in the product tree, hence .first()).
  await expect(
    page.getByText("ExampleApp: Schwachstelle ermöglicht Codeausführung").first()
  ).toBeVisible();
  await expect(page.getByText("Example AG").first()).toBeVisible();
  // A known section is present (the vulnerability's CVE id).
  await expect(page.getByText("CVE-2026-12345")).toBeVisible();

  await expect(page.getByRole("link", { name: "Back to advisories" })).toBeVisible();
});

test("renders the German sample document with its sections", async ({ page }) => {
  await page.goto("/advisories/1");

  await expect(
    page.getByText("ExampleApp: Schwachstelle ermöglicht Codeausführung").first()
  ).toBeVisible();
  await expect(page.getByText("Example AG").first()).toBeVisible();
  // The document-level summary note lives behind the Notes tab.
  await page.getByRole("tab", { name: "Notes" }).click();
  await expect(page.getByText("Eine kritische Schwachstelle wurde").first()).toBeVisible();
});

test("renders the English sample document with its sections", async ({ page }) => {
  await page.goto("/advisories/2");

  await expect(
    page.getByText("CVRF-CSAF-Converter: XML External Entities Vulnerability").first()
  ).toBeVisible();
  await expect(
    page.getByText("Bundesamt für Sicherheit in der Informationstechnik").first()
  ).toBeVisible();
  await expect(page.getByText("CVE-2022-27193")).toBeVisible();
});

test("preserves line breaks in free-text notes and escapes embedded markup (ADR-0001)", async ({
  page
}) => {
  await page.goto("/advisories/1");
  // The document-level summary note lives behind the Notes tab.
  await page.getByRole("tab", { name: "Notes" }).click();

  // The DE summary note has author line breaks (\n) that must be preserved.
  const noteText = "Eine kritische Schwachstelle wurde";
  const note = page.locator(".csaf-free-text", { hasText: noteText }).first();
  await expect(note).toBeVisible();

  // ADR-0001: rendered with white-space: pre-wrap so author breaks survive.
  await expect(note).toHaveCSS("white-space", "pre-wrap");

  // Both halves of the multi-line note are present (line break not collapsed away).
  await expect(note).toContainText(
    "Eine kritische Schwachstelle wurde in der ExampleApp gefunden."
  );
  await expect(note).toContainText("Bitte aktualisieren Sie umgehend");

  // The raw text actually contains the newline characters (not collapsed to spaces).
  const raw = await note.textContent();
  expect(raw).toContain("\n");
});

test("escapes HTML markup inside free-text rather than injecting elements (ADR-0001)", async ({
  page
}) => {
  await page.goto("/advisories/1");
  // The document-level notes (incl. the markup-probe note) live behind the Notes tab.
  await page.getByRole("tab", { name: "Notes" }).click();

  // The DE fixture's second note carries embedded markup. ADR-0001 requires it to
  // render as escaped plain text: the literal "<img ...>" / "<b>" must appear as
  // text, and no real element may be injected into the DOM.
  const note = page.locator(".csaf-free-text", { hasText: "Markup-Probe" }).first();
  await expect(note).toBeVisible();
  await expect(note).toContainText("<img src=x onerror=alert(1)>");
  await expect(note).toContainText("<b>kein Fettdruck</b>");

  // No element from the note text was actually injected anywhere in the document.
  await expect(page.locator("img[src='x']")).toHaveCount(0);
  const injected = page.locator(".csaf-free-text img, .csaf-free-text b, .csaf-free-text script");
  await expect(injected).toHaveCount(0);
});

test("shows a friendly not-found page for an unknown advisory id", async ({ page }) => {
  const response = await page.goto("/advisories/999");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("heading", { name: "Advisory not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to advisories" })).toBeVisible();
  // A friendly page, not a raw framework error / stack trace.
  await expect(page.locator("body")).not.toContainText("Internal Error");
});
