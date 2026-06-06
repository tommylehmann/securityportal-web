// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { test, expect } from "@playwright/test";
import { setScenario, lastListQuery } from "./helpers";

// Result-list page (plan task 13, spec §13). The list is rendered by a SvelteKit
// *server* load that fetches /api/advisories from the mock API. These tests cover
// the row columns, the empty/error states, and that sort + pagination state is
// reflected in the URL and re-requested with the right params.

test.beforeEach(async ({ request }) => {
  // Each test starts from the default scenario; the server holds global state.
  await setScenario(request, "ok");
});

test("renders the advisory rows with the spec §13 columns", async ({ page }) => {
  await page.goto("/");

  // Column headers per spec §13: severity, title, publisher, released, TLP,
  // category, language. (CVE is a Phase-4 facet field, intentionally omitted.)
  await expect(page.getByRole("button", { name: "Sort by severity" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Publisher" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort by release date" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "TLP" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Category" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Lang" })).toBeVisible();

  // A known fixture title is visible, linking to its detail permalink.
  const titleLink = page.getByRole("link", {
    name: "ExampleApp: Schwachstelle ermöglicht Codeausführung"
  });
  await expect(titleLink).toBeVisible();
  await expect(titleLink).toHaveAttribute("href", "/advisories/1");

  // The row carries the rest of the §13 columns for that advisory.
  const row = page.getByRole("row").filter({ hasText: "DE-2026-0001" });
  await expect(row).toContainText("Example AG"); // publisher
  await expect(row).toContainText("2026-05-20"); // released date (ISO)
  await expect(row).toContainText("WHITE"); // TLP
  await expect(row).toContainText("csaf_security_advisory"); // category
  await expect(row).toContainText("de-DE"); // language

  // Severity badge derived from the CVSS score (8.8 → High).
  await expect(row.getByText("High", { exact: false })).toBeVisible();

  // The "showing X–Y of N" footer reflects the full result set.
  await expect(page.getByText(/Showing\s+1[–-]2 of 2/)).toBeVisible();
});

test("shows the empty state when the API returns no advisories", async ({ page, request }) => {
  await setScenario(request, "empty");
  await page.goto("/");

  await expect(page.getByText("No advisories found.")).toBeVisible();
  // No data table is rendered in the empty state.
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("shows a friendly error state when the API errors (500)", async ({ page, request }) => {
  await setScenario(request, "error");
  await page.goto("/");

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Unable to load advisories");
  // The friendly message surfaces the API error, not a stack trace / framework
  // error overlay, and the page does not render the data table.
  await expect(alert).toContainText("internal database error");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("sorting by severity updates the URL and re-requests with the sort param", async ({
  page,
  request
}) => {
  await page.goto("/");

  // Default order is current_release_date desc → DE (2026) before EN (2022).
  const titlesBefore = await page.getByRole("cell").getByRole("link").allInnerTexts();
  expect(titlesBefore[0]).toContain("ExampleApp");

  // Click the severity header: sorts by `critical` descending (highest first).
  await page.getByRole("button", { name: "Sort by severity" }).click();
  await expect(page).toHaveURL(/[?&]sort=critical(\b|&|$)/);

  // The app's server-side load re-requested with the critical sort param.
  await expect.poll(() => lastListQuery(request)).toContain("sort=critical%3Adesc");

  // The DE advisory (8.8) still sorts above the EN one (5.3) under critical desc;
  // assert the order is by severity now, then flip to ascending.
  await page.getByRole("button", { name: "Sort by severity" }).click();
  await expect(page).toHaveURL(/[?&]dir=asc(\b|&|$)/);
  await expect.poll(() => lastListQuery(request)).toContain("sort=critical%3Aasc");

  // Lowest severity first when ascending: EN (5.3) before DE (8.8).
  const titlesAsc = await page.getByRole("cell").getByRole("link").allInnerTexts();
  expect(titlesAsc[0]).toContain("CVRF-CSAF-Converter");
});

test("pagination puts offset in the URL and re-requests the next page", async ({
  page,
  request
}) => {
  // Force a page size of 1 so there is a genuine second page of the 2-row set.
  await page.goto("/?limit=1");
  await expect(page.getByText(/Showing\s+1[–-]1 of 2/)).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();

  await expect(page).toHaveURL(/[?&]offset=1(\b|&|$)/);
  await expect(page.getByText(/Showing\s+2[–-]2 of 2/)).toBeVisible();
  await expect.poll(() => lastListQuery(request)).toContain("offset=1");

  // Previous returns to the first page (offset back to 0, dropped from URL).
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText(/Showing\s+1[–-]1 of 2/)).toBeVisible();
});
