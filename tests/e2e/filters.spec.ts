// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { test, expect, type Page } from "@playwright/test";
import { setScenario, lastListQuery, lastFacetsQuery } from "./helpers";

// WID-style filter sidebar (plan task 19, spec §13). The home page is rendered by
// a SvelteKit *server* load that fetches /api/advisories AND /api/facets from the
// mock with the SAME filter state (drill-down). Every control writes the filter
// state into the URL via `goto`; the load re-runs and re-fetches both endpoints,
// so the list, the "N advisories" count, the URL, and the sidebar counts always
// agree. These tests drive the richer "facets" corpus (5 rows spanning every
// dimension) so filters actually narrow a varied set.
//
// Corpus served by the "facets" scenario (see tests/mock-api/server.mjs):
//   DE-2026-0001  Example AG     WHITE  csaf_security_advisory   de-DE  8.8 high     2026-05-20
//   ACME-2026-0007 Acme Corp     GREEN  csaf_security_advisory   en-US  9.8 critical 2026-03-10
//   ACME-2026-0011 Acme Corp     AMBER  csaf_informational_advisory en-US 5.0 medium 2026-01-15
//   BETA-2025-0003 Beta GmbH     WHITE  csaf_base                de-DE  —   none     2025-11-02
//   BSI-2022-0001  BSI (full)    WHITE  csaf_security_advisory   en-US  5.3 medium  2022-04-06

test.beforeEach(async ({ request }) => {
  await setScenario(request, "facets");
});

// The filter sidebar lives in the page's <aside>; scope facet queries to it so
// they never collide with the severity badges/columns in the result table.
function sidebar(page: Page) {
  return page.locator("aside");
}

// A facet group is a collapsible <details> whose <summary> carries its title.
// Matched by the summary so an active-count badge next to the title (which makes
// the title node read "Publisher 1") does not break the lookup.
function facetGroup(page: Page, title: string) {
  return sidebar(page)
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: title }) });
}

// The checkbox row for a value inside a facet group: a <label> bearing the value
// text, with the checkbox it wraps.
function facetCheckbox(page: Page, group: string, label: string) {
  return facetGroup(page, group).locator("label").filter({ hasText: label }).getByRole("checkbox");
}

test("renders facet groups with counts from /api/facets", async ({ page }) => {
  await page.goto("/");

  // The default (unfiltered) corpus is 5 advisories.
  await expect(page.getByText("5 advisories")).toBeVisible();

  // Every facet dimension has a group in the sidebar.
  for (const title of [
    "Severity",
    "Publisher",
    "Vendor",
    "Product",
    "Category",
    "TLP",
    "Language"
  ]) {
    await expect(facetGroup(page, title).first()).toBeVisible();
  }

  // Publisher counts come straight from /api/facets: Acme Corp carries two rows.
  const acmeRow = facetGroup(page, "Publisher").locator("label").filter({ hasText: "Acme Corp" });
  await expect(acmeRow).toContainText("2");
  await expect(
    facetGroup(page, "Publisher").locator("label").filter({ hasText: "Beta GmbH" })
  ).toContainText("1");

  // TLP counts (WHITE x3, AMBER, GREEN) and severity bands are surfaced too.
  await expect(facetGroup(page, "TLP").locator("label").filter({ hasText: "WHITE" })).toContainText(
    "3"
  );
  const critical = facetGroup(page, "Severity").locator("label").filter({ hasText: "Critical" });
  await expect(critical).toContainText("1");
});

test("selecting a severity narrows the list, the URL, and the count", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("5 advisories")).toBeVisible();

  await facetCheckbox(page, "Severity", "Critical").check();

  // The filter is reflected in the URL (canonical `severity` param).
  await expect(page).toHaveURL(/[?&]severity=critical(\b|&|$)/);
  // Only the single critical advisory remains; the count updates to singular.
  await expect(page.getByText("1 advisory", { exact: true })).toBeVisible();
  const rows = page.getByRole("row").filter({ hasText: /ACME|DE-|BSI|BETA/ });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("ACME-2026-0007");
});

test("selecting a publisher narrows correctly and is reflected in the URL", async ({ page }) => {
  await page.goto("/");

  await facetCheckbox(page, "Publisher", "Acme Corp").check();

  await expect(page).toHaveURL(/[?&]publisher=Acme(\+|%20)Corp(\b|&|$)/);
  await expect(page.getByText("2 advisories")).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Gateway/ })).toBeVisible();
  // A non-Acme advisory is gone.
  await expect(page.getByRole("link", { name: /ExampleApp/ })).toHaveCount(0);
});

test("selecting a TLP narrows correctly and is reflected in the URL", async ({ page }) => {
  await page.goto("/");

  await facetCheckbox(page, "TLP", "WHITE").check();

  await expect(page).toHaveURL(/[?&]tlp=WHITE(\b|&|$)/);
  // Three WHITE advisories (DE-2026-0001, BETA-2025-0003, BSI-2022-0001).
  await expect(page.getByText("3 advisories")).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toHaveCount(0);
});

test("selecting a language narrows correctly and is reflected in the URL", async ({ page }) => {
  await page.goto("/");

  await facetCheckbox(page, "Language", "de-DE").check();

  await expect(page).toHaveURL(/[?&]lang=de-DE(\b|&|$)/);
  // Two German advisories (ExampleApp, BetaSuite).
  await expect(page.getByText("2 advisories")).toBeVisible();
  await expect(page.getByRole("link", { name: /ExampleApp/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BetaSuite/ })).toBeVisible();
});

test("typing in the free-text box filters the list", async ({ page }) => {
  await page.goto("/");

  await sidebar(page).getByPlaceholder("Search advisories").fill("router");
  // The free-form controls apply on submit (Enter / Apply button).
  await sidebar(page).getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/[?&]q=router(\b|&|$)/);
  await expect(page.getByText("1 advisory", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toBeVisible();
});

test("entering a date range filters the list", async ({ page }) => {
  await page.goto("/");

  // 2026-03-01 .. 2026-12-31 keeps the two 2026 advisories (ExampleApp, Acme Router).
  await sidebar(page).getByLabel("From").fill("2026-03-01");
  await sidebar(page).getByLabel("To").fill("2026-12-31");
  await sidebar(page).getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/[?&]from=2026-03-01(\b|&|$)/);
  await expect(page).toHaveURL(/[?&]to=2026-12-31(\b|&|$)/);
  await expect(page.getByText("2 advisories")).toBeVisible();
  await expect(page.getByRole("link", { name: /ExampleApp/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toBeVisible();
});

test("combining two filters ANDs them", async ({ page }) => {
  await page.goto("/");

  // Publisher Acme Corp (2 rows) ∧ severity critical (1 row) → 1 row.
  await facetCheckbox(page, "Publisher", "Acme Corp").check();
  await expect(page.getByText("2 advisories")).toBeVisible();

  await facetCheckbox(page, "Severity", "Critical").check();

  await expect(page).toHaveURL(/[?&]publisher=Acme(\+|%20)Corp(\b|&|$)/);
  await expect(page).toHaveURL(/[?&]severity=critical(\b|&|$)/);
  await expect(page.getByText("1 advisory", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toBeVisible();
});

test("drill-down: facet counts shrink after a filter is applied", async ({ page, request }) => {
  await page.goto("/");

  // Unfiltered, the language facet shows three English advisories.
  await expect(
    facetGroup(page, "Language").locator("label").filter({ hasText: "en-US" })
  ).toContainText("3");

  // Apply the Acme Corp publisher: the facets are re-requested with the active
  // filter state (drill-down), so the language counts now describe just the two
  // Acme advisories (both en-US).
  await facetCheckbox(page, "Publisher", "Acme Corp").check();
  await expect(page.getByText("2 advisories")).toBeVisible();

  // The mock received the publisher filter on the /api/facets call too.
  await expect.poll(() => lastFacetsQuery(request)).toMatch(/publisher=Acme(\+|%20)Corp/);

  // The drilled-down language count reflects the narrowed set.
  await expect(
    facetGroup(page, "Language").locator("label").filter({ hasText: "en-US" })
  ).toContainText("2");
});

test("clear all resets the filters, the URL, and the list", async ({ page }) => {
  await page.goto("/?severity=critical&publisher=Acme+Corp");

  // Deep-linked filters are active: one matching advisory, a "Clear all" control.
  await expect(page.getByText("1 advisory", { exact: true })).toBeVisible();
  const clearAll = sidebar(page).getByRole("button", { name: "Clear all" });
  await expect(clearAll).toBeVisible();

  await clearAll.click();

  // Filters cleared: clean URL (no filter params), full corpus back, no "Clear all".
  await expect(page).not.toHaveURL(/severity=|publisher=/);
  await expect(page.getByText("5 advisories")).toBeVisible();
  await expect(sidebar(page).getByRole("button", { name: "Clear all" })).toHaveCount(0);
});

test("changing a filter resets pagination to page 1", async ({ page }) => {
  // Force a page size of 1 and jump to a later page so there is a real offset.
  await page.goto("/?limit=1&offset=3");
  await expect(page.getByText(/Showing\s+4[–-]4 of 5/)).toBeVisible();

  // Selecting a filter must drop the offset (return to the first page).
  await facetCheckbox(page, "TLP", "WHITE").check();

  await expect(page).toHaveURL(/[?&]tlp=WHITE(\b|&|$)/);
  await expect(page).not.toHaveURL(/[?&]offset=/);
  // First page of the 3 WHITE advisories (page size 1 is preserved).
  await expect(page.getByText(/Showing\s+1[–-]1 of 3/)).toBeVisible();
});

test("a shared URL with filter params loads pre-filtered (deep-link)", async ({
  page,
  request
}) => {
  await page.goto("/?publisher=Acme+Corp&severity=critical");

  // The page renders already narrowed, without any interaction.
  await expect(page.getByText("1 advisory", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toBeVisible();

  // The deep-linked checkboxes render checked from the URL state.
  await expect(facetCheckbox(page, "Publisher", "Acme Corp")).toBeChecked();
  await expect(facetCheckbox(page, "Severity", "Critical")).toBeChecked();

  // Both the list and the facets were fetched server-side with the deep-linked
  // filter state, so the sidebar counts match the narrowed set.
  await expect.poll(() => lastListQuery(request)).toMatch(/publisher=Acme(\+|%20)Corp/);
  await expect.poll(() => lastListQuery(request)).toContain("severity=critical");
  await expect.poll(() => lastFacetsQuery(request)).toMatch(/publisher=Acme(\+|%20)Corp/);
});

test("the free-text query round-trips into the search box on a deep link", async ({ page }) => {
  await page.goto("/?q=router");

  await expect(sidebar(page).getByPlaceholder("Search advisories")).toHaveValue("router");
  await expect(page.getByText("1 advisory", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Router/ })).toBeVisible();
});

test("a capped facet surfaces the 'most frequent values' notice", async ({ page, request }) => {
  // The capped corpus has more distinct publishers than the API's FacetCap, so
  // /api/facets returns the publisher group truncated with capped:true.
  await setScenario(request, "capped");
  await page.goto("/");

  // The publisher group renders the cap notice; the value list is bounded.
  const publisher = facetGroup(page, "Publisher");
  await expect(publisher.getByText(/most frequent values/i)).toBeVisible();
  await expect(publisher.getByRole("checkbox")).toHaveCount(50);

  // Severity is a fixed-size dimension and is never capped (no notice).
  await expect(facetGroup(page, "Severity").getByText(/most frequent values/i)).toHaveCount(0);
});
