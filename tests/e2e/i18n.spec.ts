// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { test, expect, type Page } from "@playwright/test";
import { setScenario } from "./helpers";
import en from "../../src/lib/i18n/en.json" with { type: "json" };

// Bilingual UI chrome (plan task 20, spec §11, acceptance §14.6). The locale is
// resolved server-side (cookie → Accept-Language → default en) in hooks.server.ts
// and shipped with its catalog through +layout.server.ts, so SSR renders the right
// language with no hydration flash. The DE|EN toggle sets the `locale` cookie and
// invalidates the loads. These tests cover: default/Accept-Language render, the
// toggle round-trip, cookie persistence across navigation + reload, the raw-HTML
// SSR proof (before JS), key string spot-checks, and an absence-of-raw-keys sweep.
//
// The mock API serves the same data regardless of locale (the app does not forward
// Accept-Language to the API); locale only drives the chrome, so no mock changes.

test.beforeEach(async ({ request }) => {
  await setScenario(request, "ok");
});

// A few chrome strings that must visibly differ between EN and DE. Keep this list
// small and load-bearing — the broad parity check lives in the i18n unit tests.
const EN_CHROME = {
  heading: "Security advisories",
  nav: "Advisories",
  filters: "Filters",
  publisher: "Publisher",
  released: "Released",
  next: "Next",
  clearAll: "Clear all",
  fullText: "Full-text"
};
const DE_CHROME = {
  heading: "Sicherheitshinweise",
  nav: "Sicherheitshinweise",
  filters: "Filter",
  publisher: "Herausgeber",
  released: "Veröffentlicht",
  next: "Weiter",
  clearAll: "Alle zurücksetzen",
  fullText: "Volltext"
};
const DE_CHROME_DETAIL_BACK = "Zurück zu den Sicherheitshinweisen";

// The toggle buttons carry the locale code (DE / EN) as their label.
function localeButton(page: Page, code: "DE" | "EN") {
  return page.getByRole("button", { name: code, exact: true });
}

test("renders English chrome by default", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Advisories — SecurityPortal/);
  await expect(page.getByRole("heading", { name: EN_CHROME.heading })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: EN_CHROME.publisher })).toBeVisible();
  await expect(localeButton(page, "EN")).toHaveAttribute("aria-pressed", "true");
  await expect(localeButton(page, "DE")).toHaveAttribute("aria-pressed", "false");
});

test("the toggle switches all visible chrome to German and back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: EN_CHROME.heading })).toBeVisible();

  // EN → DE, in place (no navigation): the cookie is set and the loads are
  // invalidated, so all chrome must follow the switch.
  await localeButton(page, "DE").click();
  await expect(localeButton(page, "DE")).toHaveAttribute("aria-pressed", "true");

  // The layout's OWN chrome (rendered in +layout.svelte, which holds a reactive
  // translator) does switch. This passes today.
  await expect(
    page.getByRole("navigation").getByRole("link", { name: DE_CHROME.nav })
  ).toBeVisible();

  // DEFECT (cross-component locale leak, HIGH): chrome rendered by child route
  // components (+page.svelte, FilterSidebar, ...) does NOT switch on an in-place
  // toggle. Those components destructure `const { t } = getI18n()` once at init,
  // and Svelte context is read once — re-providing it from the layout does not
  // re-run their `t`. So the page heading stays English after the toggle.
  // The correct behaviour is asserted here and currently FAILS.
  await expect(page.getByRole("heading", { name: DE_CHROME.heading })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: DE_CHROME.publisher })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: DE_CHROME.released })).toBeVisible();
  await expect(page.getByRole("button", { name: DE_CHROME.next })).toBeVisible();
  // The English heading must be gone, not merely hidden alongside the German one.
  await expect(page.getByRole("heading", { name: EN_CHROME.heading })).toHaveCount(0);
  await expect(document(page)).toHaveAttribute("lang", "de");

  // DE → EN.
  await localeButton(page, "EN").click();
  await expect(localeButton(page, "EN")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: EN_CHROME.heading })).toBeVisible();
  await expect(page.getByRole("heading", { name: DE_CHROME.heading })).toHaveCount(0);
  await expect(document(page)).toHaveAttribute("lang", "en");
});

test("the German choice persists across navigation and a reload (cookie)", async ({ page }) => {
  await page.goto("/");
  // Pick German. The toggle writes the `locale` cookie; the in-place chrome update
  // is covered (and its defect documented) by the toggle test above, so here we
  // prove the *persistence* contract: a fresh SSR render after the choice is made
  // comes back fully German, across both a client navigation and a hard reload.
  await localeButton(page, "DE").click();
  await expect(localeButton(page, "DE")).toHaveAttribute("aria-pressed", "true");

  // Navigate to a detail permalink. The freshly-mounted detail component reads the
  // (now German) layout context, so the back link is German. (NB: `<html lang>` is
  // NOT re-applied on a client navigation — see the html-lang defect test below —
  // so we assert the document language only after a full SSR load.)
  await page
    .getByRole("link", { name: "ExampleApp: Schwachstelle ermöglicht Codeausführung" })
    .click();
  // 2-segment publisher-scoped permalink (ADR-0016).
  await expect(page).toHaveURL(/\/advisories\/Example%20AG\/DE-2026-0001$/);
  await expect(page.getByRole("link", { name: DE_CHROME_DETAIL_BACK })).toBeVisible();

  // Back to the list, then a full reload — the cookie keeps the SSR in German, and
  // a fresh document carries the correct `<html lang>`.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: DE_CHROME.heading })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: DE_CHROME.heading })).toBeVisible();
  await expect(document(page)).toHaveAttribute("lang", "de");
  await expect(localeButton(page, "DE")).toHaveAttribute("aria-pressed", "true");
});

// ---------------------------------------------------------------------------
// SSR raw-HTML assertions (before JS): prove there is no flash of the wrong
// language. We hit the app server directly with the `request` fixture (it shares
// the app baseURL) and assert on the unhydrated markup. Accept-Language drives
// one path; the `locale` cookie drives the other (cookie wins over the header).
// ---------------------------------------------------------------------------

test("SSR serves German markup for Accept-Language: de (no JS, no flash)", async ({ request }) => {
  const res = await request.get("/", { headers: { "Accept-Language": "de-DE,de;q=0.9" } });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();

  expect(html).toMatch(/<html[^>]*\blang="de"/);
  expect(html).toContain(DE_CHROME.heading);
  expect(html).toContain(DE_CHROME.publisher);
  expect(html).toContain(DE_CHROME.released);
  // The English equivalents must not appear as chrome in the served markup.
  expect(html).not.toContain("Security advisories");
});

test("SSR serves English markup for Accept-Language: en", async ({ request }) => {
  const res = await request.get("/", { headers: { "Accept-Language": "en-US,en;q=0.9" } });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();

  expect(html).toMatch(/<html[^>]*\blang="en"/);
  expect(html).toContain(EN_CHROME.heading);
  expect(html).toContain("Advisories — SecurityPortal");
});

test("SSR cookie wins over Accept-Language", async ({ request }) => {
  // Cookie says en, header says de → English chrome (cookie is the source of truth).
  const res = await request.get("/", {
    headers: { "Accept-Language": "de-DE,de;q=0.9", Cookie: "locale=en" }
  });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();

  expect(html).toMatch(/<html[^>]*\blang="en"/);
  expect(html).toContain(EN_CHROME.heading);
  expect(html).not.toContain(DE_CHROME.heading);
});

test("SSR honours a German locale cookie for the detail permalink", async ({ request }) => {
  // 2-segment publisher-scoped permalink (ADR-0016).
  const res = await request.get("/advisories/Example%20AG/DE-2026-0001", {
    headers: { Cookie: "locale=de" }
  });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();

  expect(html).toMatch(/<html[^>]*\blang="de"/);
  expect(html).toContain(DE_CHROME_DETAIL_BACK);
});

// ---------------------------------------------------------------------------
// Key string spot-checks: a result-count, a facet group label, "Clear all", and
// "Back to advisories" each render in the active language.
// ---------------------------------------------------------------------------

test("spot-checks German strings: count, facet label, clear-all, back link", async ({
  page,
  request
}) => {
  // The richer facet corpus has 5 advisories so the pluralised count is exercised.
  await setScenario(request, "facets");
  await page.goto("/");
  // Choose German, then reload so SSR re-renders the child chrome in German (the
  // working persistence path; the broken in-place toggle is covered above).
  await localeButton(page, "DE").click();
  await page.reload();

  // Result-count line (plural form, interpolated): "5 Sicherheitshinweise".
  await expect(page.getByText("5 Sicherheitshinweise")).toBeVisible();

  // A facet group label and the full-text field label, scoped to the sidebar.
  const aside = page.locator("aside");
  await expect(aside.getByText("Herausgeber", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel(DE_CHROME.fullText)).toBeVisible();

  // "Clear all" only renders when a filter is active; load a filtered URL so the
  // control is present, and assert its German label.
  await page.goto("/?publisher=Acme%20Corp");
  await expect(page.getByRole("button", { name: DE_CHROME.clearAll })).toBeVisible();

  // "Back to advisories" → German on the detail page.
  // Use the 2-segment permalink (ADR-0016).
  await page.goto("/advisories/Example%20AG/DE-2026-0001");
  await expect(page.getByRole("link", { name: DE_CHROME_DETAIL_BACK })).toBeVisible();
});

test("spot-checks the singular German count form", async ({ page, request }) => {
  await setScenario(request, "ok");
  // Narrowing to the single German advisory makes total == 1, exercising the
  // singular plural branch ("home.count.one") in German. Choose German then reload
  // so the SSR render carries the German count line.
  await page.goto("/?lang=de-DE");
  await localeButton(page, "DE").click();
  await page.reload();
  await expect(page.getByText("1 Sicherheitshinweis", { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// No untranslated key tokens leak (e.g. a raw `home.title` / `filter.section.x`)
// on the main routes in either language. A forgotten string surfaces verbatim
// because the translator returns the key itself for a missing entry (see
// createTranslator). We assert no catalog key appears as visible body text —
// using the real key set, so CSAF content like `www.bsi.bund.de` never trips it.
// ---------------------------------------------------------------------------

// The literal key set every chrome string is keyed by (source of truth).
const CATALOG_KEYS = Object.keys(en);

function visibleText(html: string): string {
  // Drop <head> (asset paths, module specifiers) and inline script/JSON payloads
  // (the SSR data blob carries the catalog keys legitimately), then strip tags so
  // only rendered text content remains.
  const body = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  return body.replace(/<[^>]+>/g, " ");
}

function assertNoRawKeys(html: string, where: string) {
  const text = visibleText(html);
  const leaked = CATALOG_KEYS.filter((key) => text.includes(key));
  expect(leaked, `untranslated key token(s) leaked in ${where}`).toEqual([]);
}

for (const locale of ["en", "de"] as const) {
  test(`no raw i18n key tokens on the main routes (${locale})`, async ({ request }) => {
    const headers = { Cookie: `locale=${locale}` };

    const list = await request.get("/", { headers });
    expect(list.ok()).toBeTruthy();
    assertNoRawKeys(await list.text(), `list (${locale})`);

    // 2-segment publisher-scoped permalink (ADR-0016).
    const detail = await request.get("/advisories/Example%20AG/DE-2026-0001", { headers });
    expect(detail.ok()).toBeTruthy();
    assertNoRawKeys(await detail.text(), `detail (${locale})`);

    const notFound = await request.get("/advisories/Unknown%20Publisher/DOES-NOT-EXIST", {
      headers
    });
    expect(notFound.status()).toBe(404);
    assertNoRawKeys(await notFound.text(), `not-found (${locale})`);
  });
}

// Helper: the served document element, for `<html lang>` assertions after hydration.
function document(page: Page) {
  return page.locator("html");
}
