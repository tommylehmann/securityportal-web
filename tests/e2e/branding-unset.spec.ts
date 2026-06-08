// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Phase 7, tasks 27-30: default (unset) branding behaviour.
//
// These specs run against the default "chromium" Playwright project, which
// starts the app server WITHOUT any SECURITYPORTAL_* environment variables.
// They prove the unset behaviour:
//
//   - Header shows the default brand name from i18n ("SecurityPortal").
//   - No inline --sp-primary-* style attribute on the root element.
//   - Header renders the built-in shield glyph, NOT an <img>.
//   - /branding/logo returns 404 (LOGO_PATH unset).
//   - SECURITYPORTAL_LEGAL_DIR unset → fallback amber banner on legal pages.

import { test, expect } from "@playwright/test";
import { setScenario } from "./helpers";

test.beforeEach(async ({ request }) => {
  await setScenario(request, "ok");
});

// ---------------------------------------------------------------------------
// Default brand name (task 29)
// ---------------------------------------------------------------------------

test("header shows the default brand name when BRAND_NAME is unset (task 29)", async ({ page }) => {
  await page.goto("/");

  // The default brand name comes from the i18n key nav.brand = "SecurityPortal".
  const header = page.getByRole("banner");
  await expect(header).toContainText("SecurityPortal");
});

// ---------------------------------------------------------------------------
// No theme override (task 28 + 29)
// ---------------------------------------------------------------------------

test("root element has no inline --sp-primary-* style when THEME_PRIMARY is unset (task 29)", async ({
  page
}) => {
  await page.goto("/");

  const rootDiv = page.locator("div.flex.min-h-screen").first();
  const styleAttr = await rootDiv.getAttribute("style");

  // When no theme is configured, the style attribute should be absent or empty.
  // The layout only emits style={themeVars || undefined}; an undefined style
  // attribute means SvelteKit does not render the attribute at all.
  if (styleAttr !== null) {
    // If the attribute is present for some other reason, it must not contain
    // the theme override variables.
    expect(styleAttr).not.toContain("--sp-primary-");
  }
  // Either absent (null) or present without --sp-primary-* — both are correct.
});

// ---------------------------------------------------------------------------
// Built-in glyph, no logo img (task 30)
// ---------------------------------------------------------------------------

test("header shows the built-in shield glyph when LOGO_PATH is unset (task 30)", async ({
  page
}) => {
  await page.goto("/");

  // The shield-quarter glyph must be visible in the header.
  const glyph = page.getByRole("banner").locator("i.bx-shield-quarter");
  await expect(glyph).toHaveCount(1);
});

test("header does NOT render <img src='/branding/logo'> when LOGO_PATH is unset (task 30)", async ({
  page
}) => {
  await page.goto("/");

  const logoImg = page.locator("img[src='/branding/logo']");
  await expect(logoImg).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// /branding/logo → 404 when LOGO_PATH is unset (task 30, SA-20)
// ---------------------------------------------------------------------------

test("/branding/logo returns 404 when SECURITYPORTAL_LOGO_PATH is unset (task 30)", async ({
  request
}) => {
  const res = await request.get("/branding/logo");
  expect(res.status()).toBe(404);
});

// ---------------------------------------------------------------------------
// Legal pages → fallback with amber banner when LEGAL_DIR is unset (task 32)
// ---------------------------------------------------------------------------

test("impressum shows the amber placeholder banner when LEGAL_DIR is unset (task 32)", async ({
  page
}) => {
  await page.goto("/impressum");

  // The amber banner (role=note) must be present when no Markdown file is mounted.
  await expect(page.getByRole("note")).toBeVisible();

  // The placeholder notice text must be present (English default).
  await expect(page.getByRole("note")).toContainText(
    "The operator must replace it with the real legal information before launch."
  );
});

test("datenschutz shows the amber placeholder banner when LEGAL_DIR is unset (task 32)", async ({
  page
}) => {
  await page.goto("/datenschutz");

  await expect(page.getByRole("note")).toBeVisible();
});

test("impressum with LEGAL_DIR unset does NOT render a file-based heading (task 32)", async ({
  page
}) => {
  await page.goto("/impressum");

  // The fixture headings ("Test Imprint", "Test Impressum") must NOT appear —
  // no Markdown file is mounted, so only the i18n placeholder renders.
  await expect(page.getByRole("heading", { name: "Test Imprint" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Test Impressum" })).toHaveCount(0);
});
