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
  // A known section is present (the vulnerability's CVE id). The CVE also appears
  // in the detail header band, so scope this to the rendered viewer below it.
  await expect(page.getByTestId("advisory-viewer").getByText("CVE-2026-12345")).toBeVisible();

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
  // The CVE also appears in the detail header band; scope to the rendered viewer.
  await expect(page.getByTestId("advisory-viewer").getByText("CVE-2022-27193")).toBeVisible();
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

// ---------------------------------------------------------------------------
// Detail header band (plan task 21, spec §13). The band sits above the vendored
// <Webview> and surfaces the advisory's key metadata: a severity badge (+ score),
// title, publisher, dates, TLP, category, version and CVE(s), plus a permalink
// affordance. Crucially the band is derived server-side from the CSAF document
// itself (src/lib/csaf/metadata.ts), NOT from the list row — so its CVSS/CVE
// values come from the rendered document and may differ from a list-only value.
// ---------------------------------------------------------------------------

test("the header band shows the advisory's key metadata above the viewer", async ({ page }) => {
  await page.goto("/advisories/1");

  const band = page.getByTestId("advisory-header");
  await expect(band).toBeVisible();

  // Title + tracking id.
  await expect(
    band.getByRole("heading", { name: "ExampleApp: Schwachstelle ermöglicht Codeausführung" })
  ).toBeVisible();
  await expect(band).toContainText("DE-2026-0001");

  // Severity badge derived from the document's max CVSS v3 base score (8.8 → High).
  await expect(band.getByText("High", { exact: false })).toBeVisible();
  await expect(band.getByText("8.8")).toBeVisible();

  // Publisher, TLP, category, version, and the CVE(s) from the document.
  await expect(band).toContainText("Example AG");
  await expect(band).toContainText("TLP: WHITE");
  await expect(band).toContainText("csaf_security_advisory");
  await expect(band).toContainText("CVE-2026-12345");

  // The release date renders in the default-locale (EN → ISO) form.
  await expect(band).toContainText("2026-05-20");

  // The Webview still renders below the band, and back-to-list still works.
  await expect(page.getByTestId("advisory-viewer")).toBeVisible();
  await expect(page.getByTestId("advisory-viewer").getByText("CVE-2026-12345")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to advisories" })).toBeVisible();
});

test("the band reflects the rendered document, not a stale list value", async ({ page }) => {
  // The BSI document scores CVSS v3 6.1 (→ Medium). The mock *list* row for this
  // advisory carries 5.3, but the band is derived from the document, so it must
  // show the document's own scoring — proving the band reads the real document.
  await page.goto("/advisories/2");

  const band = page.getByTestId("advisory-header");
  await expect(band).toBeVisible();
  await expect(band.getByText("Medium", { exact: false })).toBeVisible();
  await expect(band.getByText("6.1")).toBeVisible();
  await expect(band).toContainText("CVE-2022-27193");
  await expect(band).toContainText("Bundesamt für Sicherheit in der Informationstechnik");
});

test("the band exposes a well-formed absolute permalink (not host-relative junk)", async ({
  page
}) => {
  await page.goto("/advisories/1");

  const band = page.getByTestId("advisory-header");

  // A copy-permalink affordance is present.
  await expect(band.getByRole("button", { name: "Copy permalink" })).toBeVisible();

  // The visible canonical link is the page's own absolute /advisories/1 URL.
  const link = band.getByRole("link").filter({ hasText: "/advisories/1" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  // The visible anchor uses the absolute path; the text is the full absolute URL.
  expect(href).toBe("/advisories/1");
  const text = (await link.innerText()).trim();
  expect(text).toMatch(/^https?:\/\/[^/]+\/advisories\/1$/);
  // Regression guard: the early `resolve()` approach produced a malformed
  // `host../advisories/1`. The canonical URL must never contain `..`.
  expect(text).not.toContain("..");

  // <link rel="canonical"> mirrors the same absolute URL.
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", /^https?:\/\/[^/]+\/advisories\/1$/);
  expect(await canonical.getAttribute("href")).not.toContain("..");
});

test("the band's release date is locale-formatted: ISO in EN, DD.MM.YYYY in DE", async ({
  page,
  context
}) => {
  // The same underlying date (2026-05-20) must format differently per locale. We
  // assert on the rendered band's *date cell*, not the raw SSR HTML, because the
  // verbatim CSAF JSON the page hydrates with carries the ISO timestamp in its
  // data payload — so a raw-HTML negative check would match that blob, not the
  // rendered text. formatDate is UTC-based and Intl-free (src/lib/format.ts), so
  // the SSR and client renders agree. The date sits under the "Released" term.
  // The released date is the <dd> following the "Released"/"Veröffentlicht" <dt>.
  const releasedValue = (label: string) =>
    page.getByTestId("advisory-header").locator(`dt:text-is("${label}") + dd`);

  await context.addCookies([{ name: "locale", value: "en", url: "http://127.0.0.1:4173" }]);
  await page.goto("/advisories/1");
  await expect(releasedValue("Released")).toHaveText("2026-05-20");

  await context.clearCookies();
  await context.addCookies([{ name: "locale", value: "de", url: "http://127.0.0.1:4173" }]);
  await page.goto("/advisories/1");
  await expect(releasedValue("Veröffentlicht")).toHaveText("20.05.2026");
});

test("the not-found page is localized in German (F2)", async ({ request }) => {
  // The server throws only a stable status tag; the +error page localizes off the
  // status, so a German visitor must see German not-found copy, never the raw
  // English server string.
  const res = await request.get("/advisories/999", { headers: { Cookie: "locale=de" } });
  expect(res.status()).toBe(404);
  const html = await res.text();

  expect(html).toContain("Sicherheitshinweis nicht gefunden");
  expect(html).toContain(
    "Dieser Sicherheitshinweis existiert nicht oder wird nicht mehr veröffentlicht."
  );
  expect(html).toContain("Zurück zu den Sicherheitshinweisen");
  // The raw server tag and the English wording must never leak as *visible* text.
  // (The stable status tag appears in the SvelteKit hydration data blob, which is
  // not user-facing, so we strip <head>/<script> before checking — same approach
  // as the i18n raw-key sweep.)
  const visible = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");
  expect(visible).not.toContain("advisory_not_found");
  expect(visible).not.toContain("Advisory not found");
});
