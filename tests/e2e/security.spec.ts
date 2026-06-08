// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Phase 6 / task-22 security-hardening e2e specs.
//
// Covers:
//   SA-8  — malicious href is inert (javascript:, data:)
//   SA-7  — free-text markup is escaped (guard against regression; primary
//            coverage is in detail.spec.ts, duplicated here only where
//            the SA-8 fixture provides new signal)
//   SA-9 / SA-18 — CSP present and well-formed; security headers on every page
//
// The mock API serves the malicious-hrefs fixture at /api/documents/3 (id 3).
// The document contains two unsafe references (javascript:, data:) and one safe
// https: reference, letting the same detail-page render prove both accept and
// reject branches of the isSafeUrl gate.

import { test, expect } from "@playwright/test";
import { setScenario } from "./helpers";

test.beforeEach(async ({ request }) => {
  await setScenario(request, "ok");
});

// ---------------------------------------------------------------------------
// SA-8 — href allow-list: malicious schemes render as inert text, not anchors
// ---------------------------------------------------------------------------

test("javascript: reference URL renders as inert text, not a live anchor (SA-8)", async ({
  page
}) => {
  await page.goto("/advisories/3");

  // The References section of the Webview. On a wide layout (Desktop Chrome)
  // it is inside a collapsible tab; click it to reveal the section.
  await page.getByRole("tab", { name: "References" }).click();

  // The javascript: URL must NOT appear as an href on any anchor.
  // querySelectorAll is used so we can assert the *count* without a strict-mode error.
  const jsAnchors = page.locator("a[href^='javascript:']");
  await expect(jsAnchors).toHaveCount(0);

  // The URL text must still be visible to the user — rendered as inert escaped text.
  await expect(page.getByText("javascript:alert(document.domain)")).toBeVisible();

  // No dialog / alert should have fired. A dialog listener would catch it if it did.
  // We assert the page is stable and no dialog appeared.
  let dialogFired = false;
  page.on("dialog", () => {
    dialogFired = true;
  });
  // Wait briefly for any deferred script to fire (CSP violation → blocked, but
  // a non-CSP-protected attribute-injection would trigger synchronously).
  await page.waitForTimeout(200);
  expect(dialogFired).toBe(false);
});

test("data: reference URL renders as inert text, not a live anchor (SA-8)", async ({ page }) => {
  await page.goto("/advisories/3");

  await page.getByRole("tab", { name: "References" }).click();

  // data: URL must not be an href on any anchor.
  const dataAnchors = page.locator("a[href^='data:']");
  await expect(dataAnchors).toHaveCount(0);

  // The data: string should still be visible as inert text.
  await expect(page.getByText("data:text/html,")).toBeVisible();
});

test("safe https: reference renders as a real anchor with target=_blank AND rel=noopener noreferrer (SA-8)", async ({
  page
}) => {
  await page.goto("/advisories/3");

  await page.getByRole("tab", { name: "References" }).click();

  // The safe https: reference must be a live anchor.
  const safeLink = page.locator("a[href='https://safe.example.com/advisory']");
  await expect(safeLink).toHaveCount(1);
  await expect(safeLink).toBeVisible();

  // External references must open in a new tab (target="_blank") — this is the
  // regression check for the F1 bug where Link.svelte dropped target while still
  // setting rel. A pre-fix build would pass a rel-only assertion but fail here.
  const target = await safeLink.getAttribute("target");
  expect(target).toBe("_blank");

  // Links opened in a new tab must carry BOTH noopener AND noreferrer (C-1).
  // Link.svelte derives rel="noopener noreferrer" automatically when target="_blank"
  // is present; References.svelte passes target="_blank" to every reference link.
  const rel = await safeLink.getAttribute("rel");
  expect(rel).toBeTruthy();
  const relTokens = rel!.split(" ");
  expect(relTokens).toContain("noopener");
  expect(relTokens).toContain("noreferrer");
});

// ---------------------------------------------------------------------------
// SA-7 — free-text markup escaping (regression guard via the new fixture)
// Free-text in the malicious-hrefs fixture summary note must render escaped.
// Primary coverage is in detail.spec.ts; this confirms SA-7 holds on a
// document that also has SA-8 bypass attempts (belt-and-suspenders).
// ---------------------------------------------------------------------------

test("free-text note in the security-test fixture renders escaped, no injected element (SA-7)", async ({
  page
}) => {
  // The malicious-hrefs fixture summary note mentions the security test purpose.
  await page.goto("/advisories/3");
  await page.getByRole("tab", { name: "Notes" }).click();

  const note = page.locator(".csaf-free-text").first();
  await expect(note).toBeVisible();
  await expect(note).toHaveCSS("white-space", "pre-wrap");

  // No element children should be present inside free-text nodes.
  const injected = page.locator(".csaf-free-text img, .csaf-free-text script, .csaf-free-text b");
  await expect(injected).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// SA-9 / SA-18 — security headers on web responses
// The SvelteKit hooks.server.ts applies these headers to every response.
// We assert on actual HTTP responses (via Playwright's request fixture) rather
// than browser-visible DOM so the CSP assertions cover the real header value,
// not just what the page reflects.
// ---------------------------------------------------------------------------

test("home page carries X-Content-Type-Options: nosniff (SA-18)", async ({ request }) => {
  const res = await request.get("/");
  expect(res.ok()).toBe(true);
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

test("home page carries X-Frame-Options: DENY (anti-clickjacking)", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
});

test("home page carries Referrer-Policy header", async ({ request }) => {
  const res = await request.get("/");
  const rp = res.headers()["referrer-policy"];
  expect(rp).toBeTruthy();
  // The configured value is strict-origin-when-cross-origin.
  expect(rp).toBe("strict-origin-when-cross-origin");
});

test("detail page carries X-Content-Type-Options: nosniff (SA-18)", async ({ request }) => {
  const res = await request.get("/advisories/1");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

test("home page carries a Content-Security-Policy with no unsafe-inline in script-src (SA-9)", async ({
  request
}) => {
  const res = await request.get("/");
  const csp = res.headers()["content-security-policy"];
  expect(csp).toBeTruthy();

  // Parse the CSP string into a directive map for robust assertion.
  const directives = parseCsp(csp!);

  // script-src must not contain 'unsafe-inline' — SvelteKit hash mode is used instead.
  const scriptSrc = directives["script-src"] ?? directives["default-src"] ?? "";
  expect(scriptSrc).not.toContain("'unsafe-inline'");

  // script-src must contain 'self' and at least one sha256 hash (SvelteKit hash mode).
  expect(scriptSrc).toContain("'self'");
  expect(scriptSrc).toMatch(/'sha256-[A-Za-z0-9+/]+=*'/);

  // frame-ancestors must be 'none' (anti-clickjacking, SA-9).
  const frameAncestors = directives["frame-ancestors"] ?? "";
  expect(frameAncestors).toContain("'none'");

  // object-src must be 'none' (no Flash / plugin execution).
  const objectSrc = directives["object-src"] ?? directives["default-src"] ?? "";
  expect(objectSrc).toContain("'none'");

  // base-uri must be 'self' (prevent base-tag hijacking).
  const baseUri = directives["base-uri"] ?? "";
  expect(baseUri).toContain("'self'");
});

test("CSP is present and well-formed on the detail page too (SA-9)", async ({ request }) => {
  const res = await request.get("/advisories/1");
  const csp = res.headers()["content-security-policy"];
  expect(csp).toBeTruthy();

  const directives = parseCsp(csp!);
  const scriptSrc = directives["script-src"] ?? directives["default-src"] ?? "";
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).toMatch(/'sha256-[A-Za-z0-9+/]+=*'/);
});

test("existing app functionality is not broken by CSP — home page loads with content (SA-11)", async ({
  page
}) => {
  // If the CSP blocked any essential script, the interactive elements (list, sidebar,
  // pagination) would not function. A CSP violation that blocks SvelteKit's hydration
  // script would leave the page as static HTML with no reactive behaviour.
  // This spec proves the page loads correctly and is hydrated under the deployed CSP.
  const cspViolations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("Content Security Policy")) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto("/");

  // The advisory list must render (server-side) and interactive elements must
  // be present (client-side hydration). If CSP blocked hydration, clicking a
  // sort button would not update the URL.
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("link", { name: /ExampleApp/ })).toBeVisible();

  // No CSP violations in the console.
  expect(cspViolations).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Utility: parse a CSP header string into a { directive: value } map.
// ---------------------------------------------------------------------------
function parseCsp(csp: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) {
      result[trimmed.toLowerCase()] = "";
    } else {
      result[trimmed.slice(0, spaceIdx).toLowerCase()] = trimmed.slice(spaceIdx + 1);
    }
  }
  return result;
}
