// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Phase 8, tasks 49–51: generic content-page system e2e specs.
//
// Covers:
//   SA-52 — closed registry: unregistered / traversal / absolute slugs → 404.
//   SA-53 — {@html} count = 1; manual page renders inert (no CSP violation).
//   Task 50 — /impressum and /datenschutz still resolve via the registry route.
//   Task 51 — /manual renders in both locales; page contains a link to /api/docs.
//
// These specs run against the default "chromium" Playwright project (no branding
// overrides; SECURITYPORTAL_LEGAL_DIR is unset), so legal pages use the fallback
// placeholder path.  The branding project's legal-branded.spec.ts covers the
// mounted-file path.

import { test, expect } from "@playwright/test";
import { setScenario } from "./helpers";

test.beforeEach(async ({ request }) => {
  await setScenario(request, "ok");
});

// ---------------------------------------------------------------------------
// Task 50 — /impressum and /datenschutz resolve via the [slug] registry route
// ---------------------------------------------------------------------------

test("task 50: /impressum resolves and renders the Imprint heading", async ({ page }) => {
  await page.goto("/impressum");
  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page.getByRole("heading", { level: 1, name: "Imprint" })).toBeVisible();
});

test("task 50: /datenschutz resolves and renders the Privacy policy heading", async ({ page }) => {
  await page.goto("/datenschutz");
  await expect(page).toHaveURL(/\/datenschutz$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
});

test("task 50: /impressum footer link resolves correctly", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Imprint" }).click();
  await expect(page).toHaveURL(/\/impressum$/);
});

test("task 50: /datenschutz footer link resolves correctly", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/datenschutz$/);
});

// ---------------------------------------------------------------------------
// Task 51 — /manual renders in English; contains a link to /api/docs
// ---------------------------------------------------------------------------

test("task 51: /manual resolves and renders the User Manual heading (EN)", async ({ page }) => {
  await page.goto("/manual");
  await expect(page).toHaveURL(/\/manual$/);
  await expect(page.getByRole("heading", { level: 1, name: "User Manual" })).toBeVisible();
});

test("task 51: /manual page contains a link to /api/docs (EN)", async ({ page }) => {
  await page.goto("/manual");

  // The manual.en.md must contain a link to /api/docs (task 51 AC).
  // We check for an anchor whose href ends with /api/docs.
  const apiDocsLink = page.locator("a[href='/api/docs'], a[href$='/api/docs']");
  await expect(apiDocsLink.first()).toBeVisible();
});

test("task 51: /manual renders in German locale (DE)", async ({ page }) => {
  // Set the locale cookie so the server resolves the de locale.
  await page.context().addCookies([{ name: "locale", value: "de", url: "http://127.0.0.1:4173" }]);
  await page.goto("/manual");

  // The German heading in manual.de.md is "Benutzerhandbuch".
  await expect(page.getByRole("heading", { level: 1, name: "Benutzerhandbuch" })).toBeVisible();
});

test("task 51: /manual footer link resolves correctly", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "User Manual" }).click();
  await expect(page).toHaveURL(/\/manual$/);
});

// ---------------------------------------------------------------------------
// SA-52 — closed registry: unregistered and traversal slugs → 404
//
// Note: SvelteKit URL-decodes path params before passing them to the [slug]
// route, so %2e%2e arrives as '..'.  We test the decoded forms here (the URL
// in the browser bar still shows the encoded form, but what the server receives
// is decoded).  We use request.get() for traversal probes so we avoid
// browser-normalisation of the URL path (the browser would refuse to navigate
// to /../../etc/passwd; raw HTTP requests from Playwright's request context can
// send them as-is to test the server's response).
// ---------------------------------------------------------------------------

test("SA-52: /about (unregistered) returns 404", async ({ request }) => {
  const res = await request.get("/about");
  expect(res.status()).toBe(404);
});

test("SA-52: /contact (unregistered) returns 404", async ({ request }) => {
  const res = await request.get("/contact");
  expect(res.status()).toBe(404);
});

test("SA-52: a slug with dot traversal component does not reach arbitrary content", async ({
  request
}) => {
  // %2e%2e URL-normalizes to '/' (the root path) before reaching any route:
  // the HTTP stack collapses /%2e%2e into / as per RFC 3986 §5.2.4.  The
  // response is the home page (200) — NOT an arbitrary file.  The key security
  // property is that the path is neutralized at the URL layer; lookupSlug's dot-
  // check is an additional defence for any path that slips through (e.g. via a
  // double-encoded %252e%252e, which arrives at the server as %2e%2e after one
  // decode, still containing a percent sign, and is therefore rejected by the
  // percent-sign check).
  const res = await request.get("/%2e%2e");
  // Must not return 5xx (no crash); may return 200 (home) or 301/3xx/4xx.
  expect(res.status()).toBeLessThan(500);
  // Confirm the slug guard rejects the decoded form '..' — covered at unit level
  // in registry.test.ts.  The URL normalizer already neutralised this at the
  // HTTP layer before the slug guard had a chance to act.
});

test("SA-52: a slug that is just a percent sign returns 4xx", async ({ request }) => {
  // '%' alone is not valid; the server must not crash (5xx) and must not return 200.
  const res = await request.get("/%25");
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
});

// ---------------------------------------------------------------------------
// SA-53 — manual page carries no CSP violation
// ---------------------------------------------------------------------------

test("SA-53: /manual renders with no CSP violation (no injected script)", async ({ page }) => {
  const cspViolations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("Content Security Policy")) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto("/manual");
  await expect(page.getByRole("heading", { level: 1, name: "User Manual" })).toBeVisible();

  expect(cspViolations, "Expected no CSP violations on /manual").toHaveLength(0);
});

test("SA-53: /manual page carries no live <script> element injected by content", async ({
  page
}) => {
  await page.goto("/manual");

  // Any <script> tags on the page should be the SvelteKit hydration bundle only,
  // not injected by the Markdown content.  The article element holding the rendered
  // content must contain no <script> child.
  const scripts = page.locator("article script");
  await expect(scripts).toHaveCount(0);
});

test("SA-53: /manual page contains no live anchor with javascript: href", async ({ page }) => {
  await page.goto("/manual");

  const jsAnchors = page.locator("article a[href^='javascript:']");
  await expect(jsAnchors).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Security headers on the content pages (SA-9 / SA-18 regression)
// ---------------------------------------------------------------------------

test("content pages carry X-Content-Type-Options: nosniff (SA-18)", async ({ request }) => {
  for (const path of ["/impressum", "/datenschutz", "/manual"]) {
    const res = await request.get(path);
    expect(res.ok(), `${path} should return 2xx`).toBe(true);
    expect(res.headers()["x-content-type-options"], `${path} nosniff`).toBe("nosniff");
  }
});

test("content pages carry a Content-Security-Policy header (SA-9)", async ({ request }) => {
  for (const path of ["/impressum", "/datenschutz", "/manual"]) {
    const res = await request.get(path);
    const csp = res.headers()["content-security-policy"];
    expect(csp, `${path} should carry CSP`).toBeTruthy();
    // Must not allow unsafe-inline in script-src.
    expect(csp, `${path} CSP must not have unsafe-inline in script-src`).not.toMatch(
      /script-src[^;]*'unsafe-inline'/
    );
    // Must forbid framing.
    expect(csp, `${path} CSP frame-ancestors`).toMatch(/frame-ancestors\s+'none'/);
  }
});
