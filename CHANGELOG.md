<!--
SPDX-License-Identifier: Apache-2.0
SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

# Changelog

All notable changes to the SecurityPortal Web are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Phase 8 — REST maturity, publisher routing, feeds, content pages, authz seam)

#### Publisher-scoped detail route (ADR-0016)

- **Two-segment detail route:** `/advisories/[publisher]/[trackingId]` (e.g., `/advisories/Example%20AG/wid-sec-w-2026-1816`) mirrors the API's publisher-scoped permalink. Both segments are automatically URL-decoded by SvelteKit; links use `encodeURIComponent` to safely round-trip special characters (spaces, colons, umlauts).
- **Withdrawn advisory notice:** when an advisory has been withdrawn (API returns 410 Gone), the detail page renders a localized "no longer published" notice with the tracking ID and withdrawal date instead of the document body.
- **Withdrawn API integration:** the client's `fetchAdvisory` function now maps the API's `410 Gone` response (with the withdrawn envelope) to the detail page's withdrawn-notice data structure.

#### Content-page system (ADR-0018)

- **Generic content registry:** `src/lib/content/registry.ts` defines a closed map of `slug → { titleKey, kind }`. The dynamic route `[...page]` looks up slugs in the registry only; unregistered or traversal attempts return 404 before any file access.
- **Legal content (`legal` kind):** operator-mounted Markdown at `${LEGAL_DIR}/<slug>.<locale>.md` (e.g., `impressum.de.md`). Uses the existing ADR-0010 pipeline: render to HTML, sanitize to an allow-list, show placeholder if missing/oversized/malformed.
- **Repo content (`repo` kind):** bundled Markdown in `src/lib/content/<slug>.<locale>.md`. Trusted source, but still sanitized (belt-and-suspenders). Enables zero-configuration pages like the user manual.
- **User manual page:** `/manual` (kind: `repo`) documents browsing, filtering, and REST API usage. Bundled in both German (`manual.de.md`) and English (`manual.en.md`). Includes a link to `/api/docs` (the interactive OpenAPI reference).
- **Impressum / Datenschutz migrated:** these pages are now registered entries (slug: `impressum`, `datenschutz`, kind: `legal`), no longer separate route files. Footer links are preserved; operators fill in the legal Markdown files at `${LEGAL_DIR}`.

#### API surface integration

- **Atom feed links:** the list links to advisories now reflect the API's publisher-scoped permalink, matching the advisory `_links.self` and Atom `<link>` href format.
- **OpenAPI docs link:** footer now links to `/api/docs` (the Redoc viewer) for machine-readable API reference.
- **Withdrawn 410 handling:** the client correctly interprets API 410 responses (was 200 in earlier phases); the detail page maps 410 → withdrawn notice, 404 → 404 page, 502 → error alert.

#### i18n & content

- **Withdrawn notice keys:** added i18n entries `detail.withdrawn.{title,body,date}` for German and English.
- **Content page titles:** added i18n keys for new pages (`legal.impressum.headTitle`, `legal.datenschutz.headTitle`, `content.manual.headTitle`).
- **API docs link:** added i18n entry for the footer link to `/api/docs`.

### Changed

- **Detail route structure:** old `/advisories/[trackingId]` replaced by `/advisories/[publisher]/[trackingId]`. The single-segment route no longer exists; the web detail route shape mirrors the API permalink (ADR-0016 / OQ-15).
- **Advisory permalink stability:** Permalinks are now based on the CSAF `tracking_id` + `publisher` (both publisher-assigned, stable across reimports) rather than the database numeric surrogate.
- **Detail page API call:** calls `GET /api/advisories/{publisher}/{trackingid}` (the API's only public advisory endpoint) instead of `GET /api/documents/:id`. The old `fetchDocument` function is retained for internal use.
- **List link routing:** advisory rows now build routes using both `publisher_name` and `tracking_id`; either is percent-encoded for URL safety. Rows with null publisher are rendered unlinked (no `/advisories//{id}` URLs emitted).
- **Withdrawn response status:** now 410 Gone from the API (was 200). The client checks for 410 status and reads the envelope; the 200-envelope branch is no longer exercised.
- **Content page routes:** `/impressum` and `/datenschutz` now route through the generic `[...page]` handler (identical public URLs, unified template + sanitization logic).

### Security

- **Publisher-scoped routing:** both `{publisher}` and `{trackingId}` segments are URL-encoded in links via SvelteKit's `resolve()` helper. The detail `+page.server.ts` reads both params from SvelteKit's already-decoded `params` object (no double-decoding).
- **Withdrawn envelope parsing:** the 410 response body contains only the three fields (`withdrawn`, `tracking_id`, `withdrawn_at`); these are extracted and rendered as plain text (never echoed into markup).
- **Content registry closure:** slugs are looked up in the closed registry only. No request input is ever used to construct a file path. Unregistered, traversal, or absolute slugs return 404 without file access (SA-52 / C-36).
- **HTML sanitization:** the single app-wide `{@html}` sink is the sanitized output from `renderLegalMarkdown`. Both legal and repo content flow through the same sanitizer (allow-list: text, links, tables; drop script, iframe, img, svg). The sanitizer uses markdown-it (`html: false`) + sanitize-html with `http/https/mailto` scheme allow-list (ADR-0007, ADR-0010).
- **Null-publisher rendering:** when `advisory.publisher_name` is null, the row title is rendered as plain text (no link generated). This prevents `/advisories//{trackingId}` URLs from being emitted.
