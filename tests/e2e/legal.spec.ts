// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { test, expect, type Page } from "@playwright/test";
import { setScenario } from "./helpers";
import en from "../../src/lib/i18n/en.json" with { type: "json" };

// Legal pages (plan task 21, spec §13, OQ-4): the German-required Impressum and
// Datenschutz pages. These ship as deliberate PLACEHOLDERS — the operator must
// complete them before launch — so the tests prove three things: the pages exist
// and are reachable from the footer in both languages, the chrome translates, and
// the placeholder markers are present (we ship stubs, not invented legal text).
// No mock data is involved (the pages are static chrome), but the suite shares the
// server-global scenario state, so reset to a known baseline like the others.

test.beforeEach(async ({ request }) => {
  await setScenario(request, "ok");
});

// The toggle buttons carry the locale code (DE / EN) as their label.
function localeButton(page: Page, code: "DE" | "EN") {
  return page.getByRole("button", { name: code, exact: true });
}

// The footer legal nav holds the two links (scoped so we never match a stray
// occurrence elsewhere on the page).
function footerLegalNav(page: Page) {
  return page.getByRole("contentinfo").getByRole("navigation");
}

test("the Impressum is reachable from the footer and renders", async ({ page }) => {
  await page.goto("/");

  await footerLegalNav(page).getByRole("link", { name: "Imprint" }).click();

  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page.getByRole("heading", { level: 1, name: "Imprint" })).toBeVisible();
  // The German required-section structure is in place.
  await expect(
    page.getByRole("heading", { name: "Information pursuant to § 5 TMG" })
  ).toBeVisible();
});

test("the Datenschutz is reachable from the footer and renders", async ({ page }) => {
  await page.goto("/");

  await footerLegalNav(page).getByRole("link", { name: "Privacy" }).click();

  await expect(page).toHaveURL(/\/datenschutz$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Controller" })).toBeVisible();
});

test("both legal pages carry the operator-must-complete placeholder notice", async ({ page }) => {
  // We ship deliberate stubs, not invented legal details — assert the notice that
  // makes that explicit, plus the "[ tbd ]" markers in the body, are present.
  for (const path of ["/impressum", "/datenschutz"]) {
    await page.goto(path);
    await expect(page.getByRole("note")).toContainText(
      "The operator must replace it with the real legal information before launch."
    );
    // At least one body section still holds the placeholder marker.
    await expect(page.getByText("[ tbd", { exact: false }).first()).toBeVisible();
  }
});

test("the legal pages render in German when the locale is German", async ({ page }) => {
  await page.goto("/");
  // Switch the chrome to German, then navigate via the (now German) footer links.
  await localeButton(page, "DE").click();
  await expect(localeButton(page, "DE")).toHaveAttribute("aria-pressed", "true");

  await footerLegalNav(page).getByRole("link", { name: "Impressum" }).click();
  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page.getByRole("heading", { level: 1, name: "Impressum" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Angaben gemäß § 5 TMG" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText(
    "Der Betreiber muss ihn vor dem Start durch die tatsächlichen rechtlichen Angaben ersetzen."
  );

  await footerLegalNav(page).getByRole("link", { name: "Datenschutz" }).click();
  await expect(page).toHaveURL(/\/datenschutz$/);
  await expect(page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verantwortlicher" })).toBeVisible();
});

// ---------------------------------------------------------------------------
// SSR raw-HTML assertions: prove the pages localize server-side (via the locale
// cookie) and that no untranslated key token leaks on either route in either
// language. Mirrors the absence-of-raw-keys sweep in i18n.spec.ts.
// ---------------------------------------------------------------------------

const CATALOG_KEYS = Object.keys(en);

function visibleText(html: string): string {
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
  test(`legal pages SSR in ${locale} with no raw i18n key tokens`, async ({ request }) => {
    const headers = { Cookie: `locale=${locale}` };
    const langAttr = new RegExp(`<html[^>]*\\blang="${locale}"`);

    const impressum = await request.get("/impressum", { headers });
    expect(impressum.ok()).toBeTruthy();
    const impressumHtml = await impressum.text();
    expect(impressumHtml).toMatch(langAttr);
    assertNoRawKeys(impressumHtml, `impressum (${locale})`);

    const datenschutz = await request.get("/datenschutz", { headers });
    expect(datenschutz.ok()).toBeTruthy();
    const datenschutzHtml = await datenschutz.text();
    expect(datenschutzHtml).toMatch(langAttr);
    assertNoRawKeys(datenschutzHtml, `datenschutz (${locale})`);
  });
}
