<!--
SPDX-License-Identifier: Apache-2.0
SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

# securityportal-web — Public CSAF Advisory Portal UI

A SvelteKit 2 / Svelte 5 frontend for the SecurityPortal public advisory portal. Renders advisories from the backend API as human-readable HTML using vendored CSAF webview components.

**This is part of the SecurityPortal public advisory portal.** See the top-level workspace for architecture context and deployment instructions.

## Overview

- **Bilingual UI:** German and English (i18n). Document content renders in its own language.
- **WID-style interface:** list with faceted filtering (sidebar, search, severity, TLP, product, vendor, etc.), detail view with the vendored CSAF webview renderer.
- **Tailwind + Flowbite:** clean government-portal aesthetic.
- **Server-side rendering (SSR):** fetches the API server-side to avoid CORS complexity; browser gets pre-rendered HTML.
- **No authentication:** public read-only access.

## Quick start

### Prerequisites

- Node.js 20+ and npm
- `PUBLIC_API_BASE_URL` env var (optional; defaults to same-origin `/api`)

### Development

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` with a Vite dev proxy to the API on `:8081` (configurable in `vite.config.ts`).

### Build and preview

```bash
npm run build
npm run preview
```

Builds with `adapter-node` and serves a production-like app on `:5173`.

### Docker

```bash
docker build -t securityportal-web:latest .
docker run -p 8080:8080 \
  -e PUBLIC_API_BASE_URL=http://api.example.com \
  securityportal-web:latest
```

## Configuration

### Runtime environment variables

All of these are read at **runtime** (not build time), so you can change them between build and deployment (e.g., via Docker `.env`).

**Server-only variables** (read via `$env/dynamic/private`, never sent to browser):

| Variable                          | Default                  | Description                                                                                                                                                                              |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SECURITYPORTAL_BRAND_NAME`       | `"SecurityPortal"`       | Portal title (shown in header + alt text on logo). Text only, no HTML.                                                                                                                   |
| `SECURITYPORTAL_BRAND_SUBTITLE`   | `"CSAF Advisory Portal"` | Subtitle shown in header. Text only.                                                                                                                                                     |
| `SECURITYPORTAL_THEME_PRIMARY`    | `"#2563eb"`              | Primary brand color. Hex `#rrggbb` or RGB `R G B` (each 0–255).                                                                                                                          |
| `SECURITYPORTAL_THEME_PRIMARY_FG` | unset                    | Foreground (text) color on primary bg. Hex or RGB. **v1 scope: unused (always light text).**                                                                                             |
| `SECURITYPORTAL_THEME_ACCENT`     | unset                    | Accent color override. Hex or RGB. **v1 scope: unused (fixed per severity bands).**                                                                                                      |
| `SECURITYPORTAL_LOGO_PATH`        | unset                    | Path to a logo file (SVG/PNG/WebP) served at `/branding/logo`. Must exist and be readable by the app process. When unset, a built-in shield glyph is shown.                              |
| `SECURITYPORTAL_LEGAL_DIR`        | unset                    | Directory containing legal Markdown files (see below). When unset, impressum/datenschutz pages show placeholders.                                                                        |
| `SECURITYPORTAL_API_INTERNAL_URL` | unset                    | **Compose/Kubernetes only:** internal address for SSR to reach the API (e.g., `http://api:8081`). When unset, SSR falls through to `PUBLIC_API_BASE_URL` or same-origin relative `/api`. |

**Browser-accessible variables** (read via `$env/dynamic/public`):

| Variable              | Default            | Description                                                                                                                                                                                                                                                 |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_API_BASE_URL` | `""` (same-origin) | Backend API base URL. Empty (default) = same-origin relative `/api/...` (suitable for a reverse proxy routing `/api` to the API). Absolute origin (e.g., `https://api.example.com`) = call the API cross-origin; CSP `connect-src` is extended to allow it. |

### Branding and theming (Phase 7)

The portal supports runtime rebranding without rebuilding the container:

- **Brand name/subtitle:** set `SECURITYPORTAL_BRAND_NAME` and `SECURITYPORTAL_BRAND_SUBTITLE` to display custom text in the header.
- **Primary color:** `SECURITYPORTAL_THEME_PRIMARY` accepts hex (`#rrggbb`) or RGB decimal (`R G B`). A linear ramp is generated for the Tailwind `primary-*` scale. Colors are validated server-side (SA-22); invalid values are logged and ignored (defaults apply).
- **Logo:** `SECURITYPORTAL_LOGO_PATH` points to a file (SVG, PNG, or WebP) served at `/branding/logo`. The path is fixed at process start and never joined with request input (SA-20). Content-Type is allow-listed by extension; read errors silently return 404 (no path disclosure, SA-14).
- **Mounted files:** in Docker Compose or Kubernetes, bind-mount the logo file or legal directory into the container and set the path to where it will exist inside the container (e.g., `/config/logo.png` if mounted at `/config`).

### Legal content (Markdown + sanitized HTML, Phase 7)

The web app reads **Markdown-formatted** legal documents from `SECURITYPORTAL_LEGAL_DIR`:

**File layout:** `${SECURITYPORTAL_LEGAL_DIR}/<page>.<locale>.md`

- **Pages:** `impressum` (company/contact info), `datenschutz` (privacy policy)
- **Locales:** `de` (German), `en` (English)
- **Examples:** `impressum.de.md`, `datenschutz.en.md`

**Content rendering (ADR-0010):**

1. Operator writes Markdown (block text, lists, tables, safe links, emphasis).
2. At request time, the Markdown is rendered to HTML.
3. HTML is sanitized to a fixed allow-list:
   - **Allowed tags:** `p h1–h4 ul ol li blockquote strong em code pre hr br table thead tbody tr th td a` (text flow + tables + anchors).
   - **Allowed attributes:** `a[href rel target]`, `td/th[colspan rowspan]` (all others stripped).
   - **Dropped entirely:** `script iframe object embed svg img` (never rendered, even as escaped text).
   - **Link scheme allow-list:** `http https mailto` only (ADR-0007); `javascript:` and `data:` links are inert.
   - **Anchor hardening:** every link gets `rel="noopener noreferrer"` and `target="_blank"`.
4. Sanitized HTML is rendered via Svelte `{@html}` — the **only permitted `{@html}` in the app** (SA-6 carve-out, documented in code).

**Fallback chain:**

- If the file exists and is ≤ 512 KiB → render sanitized HTML.
- Else try the other locale's file.
- Else → show a placeholder with an amber "not completed" banner (never 500, never blank).

**Size limit:** files over 512 KiB are rejected and fall back to the placeholder.

**Operators:** to complete the legal pages, create `impressum.de.md` / `impressum.en.md` and `datenschutz.de.md` / `datenschutz.en.md` in the mounted directory with your legal text. Markdown syntax is supported; HTML tags are escaped to prevent injection.

### Locale

The active UI language (German or English) is resolved in this order:

1. **Cookie** (`locale` cookie) — user's toggled preference (persistent)
2. **Accept-Language header** — browser's preferred language
3. **Default:** English

The locale picker (footer toggle) persists the choice to the cookie, so switching is sticky across sessions.

## Development commands

| Command                    | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `npm run dev`              | Start Vite dev server with hot reload on `:5173`             |
| `npm run build`            | Build for production (adapter-node)                          |
| `npm run preview`          | Serve the built app locally (production-like)                |
| `npm run check`            | Type-check and Svelte check (svelte-kit sync + svelte-check) |
| `npm run lint`             | Prettier + ESLint (no fixes)                                 |
| `npm run format`           | Prettier + ESLint auto-fix                                   |
| `npm run test:unit`        | Vitest unit tests                                            |
| `npm run test:integration` | Playwright e2e tests (requires `npm run build` first)        |
| `npm run audit:prod`       | Production-only vulnerability audit                          |
| `npm run sbom`             | Generate CycloneDX SBOM (production dependencies)            |

## Project structure

```
src/
  app.html              # HTML shell with <html lang="%lang%" ...>
  app.css               # Global Tailwind + Flowbite + custom portal CSS
  hooks.server.ts       # Security headers, CSP, locale resolution
  app.d.ts              # Global types
  routes/
    +layout.svelte      # Portal shell (header, nav, footer)
    +layout.server.ts   # Load locale + i18n catalog
    +page.svelte        # Advisory list (home)
    +page.server.ts     # Fetch advisories from API
    advisories/
      [id]/
        +page.svelte    # Advisory detail (CSAF webview render)
        +page.server.ts # Fetch document JSON from API
        +error.svelte   # Friendly 404 page
    impressum/
      +page.svelte      # Legal: company/contact info (placeholder)
    datenschutz/
      +page.svelte      # Privacy policy (placeholder)
  lib/
    i18n/
      de.json           # German message catalog
      en.json           # English message catalog
      index.ts          # Locale resolution, t(key) accessor
    api/
      types.ts          # TypeScript mirrors of API JSON shapes
      client.ts         # Fetch wrappers + error handling
      client.test.ts    # Vitest unit tests
    format.ts           # Date formatting (ISO YYYY-MM-DD)
    components/
      SeverityBadge.svelte  # Colored severity indicator
    CSAFWebview/          # Vendored CSAF webview tree (from ISDuBA)
      Webview.svelte       # Main entry point
      store.svelte.ts      # Slim Svelte store (doc, selected items)
      PROVENANCE.md        # Vendoring source + modifications log
      docmodel/            # Document model + type defs
      general/, notes/, ...# CSAF-specific rendering sections
      SearchableText.svelte # Free-text escape + pre-wrap (ADR-0001)
      Link.svelte          # URL-scheme-checked `<a>` renderer
public/
  favicon.svg           # Portal icon

tests/
  e2e/
    list.spec.ts        # Playwright: list page
    detail.spec.ts      # Playwright: detail page + CSAF render
  mock-api/
    server.mjs          # Mock API (e2e test fixture)
```

## Routes

### `/` (home)

Advisory list with WID-style layout and faceted filtering sidebar:

- **Filter sidebar:** collapsible facet groups for severity bands, TLP labels, publishers, vendors, products, categories, and language; counts update via drill-down as filters are applied. Free-text search with cross-language support (German and English stemming).
- **Date and score range filters:** query advisories by release date range and CVSS score thresholds.
- **Result table:** latest revision per advisory, columns for severity badge, title (links to detail), publisher, release date, TLP, category, CVE list, language.
- **Pagination:** "Previous/Next" + showing X–Y of N. State in URL query (`limit`/`offset`).
- **Sorting:** click severity or release date header to sort; state in URL (`sort`/`dir`).
- **Empty state:** "No advisories found" when no advisories match the active filters.
- **Error state:** friendly alert if the API call fails (shows the API error message, not a stack trace).
- **URL-based filter state:** all filters are encoded in the query string, enabling shareable deep-links to filtered views.

### `/advisories/[id]` (detail)

Single advisory rendered via the vendored CSAF webview:

- Calls `GET /api/documents/:id` server-side to fetch the stored CSAF JSON.
- Runs `convertToDocModel(json)` to transform it into the webview's internal shape.
- Renders the `<Webview>` component with tabs for General, Product Tree, Vulnerabilities, Notes, etc.
- A "Back to advisories" link returns to the list.
- 404 handling: if the document is not found or is non-publishable, the friendly error page is shown.

### `/impressum` (Imprint)

**TODO:** Operator must fill in company name, address, contact info, legal entity details. Currently a placeholder.

### `/datenschutz` (Privacy Policy)

**TODO:** Operator must fill in the privacy statement (data processing, third parties, user rights, etc.). Currently a placeholder.

## CSAF rendering

The advisory detail page renders the stored CSAF JSON using the vendored `csaf_webview` tree (`src/lib/CSAFWebview/`), a Svelte 5 fork of the upstream `csaf_webview` project (originally Svelte 4 / SvelteKit 1 by BSI/Intevation, adapted by ISDuBA to Svelte 5 / SvelteKit 2).

### Vendoring (ADR-0003)

The components are **vendored** (copied) into this repo under `src/lib/CSAFWebview/`. This avoids a transitive Svelte 4 dependency (the upstream is incompatible with SecurityPortal's Svelte 5 target).

See `src/lib/CSAFWebview/PROVENANCE.md` for:

- Source and date of vendoring
- List of local modifications (ISDuBA coupling removed, free-text escaping fixed)
- License provenance (vendored files retain BSI/Intevation Apache-2.0 copyright)

### Free-text rendering (ADR-0001)

Free-text fields (notes, remediation details, threat details, acknowledgments, etc.) render as **escaped plain text with `white-space: pre-wrap`**:

```svelte
<!-- Every free-text field flows through SearchableText.svelte -->
<SearchableText text={vuln.summary} />

<!-- Compiles to -->
<span class="csaf-free-text" style="white-space: pre-wrap; overflow-wrap: anywhere">
  {text}
  <!-- {text} escapes HTML entities -->
</span>
```

This preserves author line breaks and prevents XSS (no Markdown, no raw HTML). A note like:

```
Line 1
Line 2

Line 3
<b>not bold</b> & ampersand
```

renders as literal text with `\n` preserved, `<b>` escaped to `&lt;b>`, and `&` to `&amp;`.

### URL-scheme allow-list (ADR-0007)

Every `<a href>` whose URL comes from CSAF content is validated in `Link.svelte`:

```svelte
<!-- Safe schemes: http, https, mailto -->
<Link href="https://example.com">Example</Link>
<!-- renders <a href="..."> -->
<Link href="javascript:alert(1)">Bad</Link>
<!-- renders as plain text "Bad" -->
```

This blocks `javascript:`, `data:`, `vbscript:` URLs.

### Icons (Boxicons)

Boxicons icons are used by the vendored components (chevrons, product-status glyphs, link/heart icons). The stylesheet is imported once in `src/routes/+layout.svelte`.

## i18n (Internationalization)

### Locale resolution

1. Check the `locale` cookie.
2. Parse the `Accept-Language` header (first `de` or `en` match wins).
3. Fall back to `en`.

The choice is resolved once per request in `hooks.server.ts` and stashed on `event.locals.locale`, so both SSR and the page have the same language without hydration flicker.

### Message catalogs

German and English message strings live in `src/lib/i18n/{de,en}.json`. The `t(key)` accessor (exported from `src/lib/i18n/index.ts`) retrieves the current-locale string.

### Adding a new message

1. Add the key to both `de.json` and `en.json` with the appropriate translations.
2. Import `t` from `$lib/i18n` and call `t('my_key')` in your component.

**Example:**

`src/lib/i18n/en.json`:

```json
{
  "advisories_title": "Security Advisories"
}
```

`src/lib/i18n/de.json`:

```json
{
  "advisories_title": "Sicherheitsmitteilungen"
}
```

Component:

```svelte
<script>
  import { t } from "$lib/i18n";
</script>

<h1>{t("advisories_title")}</h1>
```

### CSAF document language

CSAF documents carry their own language tag (`/document/lang`, e.g., `en`, `de`). The webview renders the document's language as-is; the UI chrome (header, nav, pagination, buttons) uses the active locale.

## Security

### Content Security Policy (CSP)

Set in `svelte.config.js` and extended dynamically in `hooks.server.ts`:

- `default-src 'self'` — only same-origin content
- `script-src 'self'` — no inline scripts, no 3rd-party scripts (SvelteKit SSR + build-time hash)
- `style-src 'self' 'unsafe-inline'` — Tailwind/Flowbite need inline styles
- `img-src 'self' data:` — same-origin + data: URLs for badges/icons
- `frame-ancestors 'none'` — no clickjacking / embedding
- `object-src 'none'` — no plugins

If `PUBLIC_API_BASE_URL` is cross-origin, `hooks.server.ts` extends `connect-src` to allow it (so server-side `fetch` can reach it).

### Security headers (ADR-0006)

Set in `hooks.server.ts`:

- `X-Content-Type-Options: nosniff` — prevent content-sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limit referrer leakage
- `X-Frame-Options: DENY` — prevent framing
- `Permissions-Policy` — deny camera, microphone, geolocation, payment, USB

**Intentionally NOT set here (reverse proxy responsibility):**

- `Strict-Transport-Security (HSTS)` — the reverse proxy owns TLS and should set this

### No user data collection

- No analytics, no tracking cookies, no 3rd-party integrations.
- A `locale` cookie stores the user's language preference (client-side only; never sent to the API).

## Testing

### Unit tests (Vitest)

```bash
npm run test:unit
```

Tests the API client, query parsing, severity bucketing, and date formatting.

### End-to-end tests (Playwright)

```bash
npm run build
npm run test:integration
```

Requires Chromium (Playwright installs it). Tests:

- Advisory list page (rendering, pagination, sorting, empty/error states)
- Advisory detail page (CSAF webview rendering for DE + EN documents)
- ADR-0001 line-break preservation and markup escaping
- 404 handling

Tests use a mock API (deterministic, in-process) so no real backend is needed. See `tests/` for the suite.

## Deployment options

SecurityPortal supports three deployment targets with identical runtime config and security properties:

1. **Docker Compose** (batteries-included) — `securityportal-api/docs/DEPLOYMENT.md`. Bundled Caddy reverse proxy, all services in containers, local self-signed or ACME/BYO TLS.
2. **Kubernetes Helm chart** — `deploy/helm/securityportal/` in the main repository. Deployments + Services, Ingress for TLS, optional bundled PostgreSQL, ConfigMap/Secret for config.
3. **Bare-metal / hand-rolled** — `securityportal-api/docs/DEPLOYMENT-BAREMETAL.md`. Go binary + Node.js under systemd, external Postgres, operator-provided reverse proxy (nginx/Caddy examples included).

All three share the same `SECURITYPORTAL_*` environment variables and security-header ownership model (app owns CSP, proxy owns HSTS/TLS). Choose the target that fits your infrastructure.

## Deployment checklist

Before going live:

- [ ] **Locale coverage:** verify German and English pages are complete and correct. Check `/impressum` and `/datenschutz` for any untranslated placeholders.
- [ ] **`PUBLIC_API_BASE_URL`:** set correctly in the Docker build or deployment config.
- [ ] **Legal pages:** fill in `/impressum` (company info) and `/datenschutz` (privacy policy) with your actual content.
- [ ] **Branding:** colors, logo, footer links (currently using placeholder SecurityPortal theme).
- [ ] **Browser support:** test in Chrome, Firefox, Safari, Edge (SvelteKit/Tailwind are evergreen-friendly).
- [ ] **Accessibility:** screen reader, keyboard nav, color contrast (Flowbite components are WCAG-friendly; audit custom components).
- [ ] **Monitoring:** set up error logging (e.g., Sentry) to catch runtime issues in production.

## Architecture and decisions

See the workspace-level documentation:

- **System architecture:** `.ai/shared/spec.md`
- **Threat model:** `.ai/shared/threat-model.md`
- **ADRs (Architecture Decision Records):** `.ai/shared/decisions/`
  - ADR-0001: CSAF free-text rendering (escaped plain text + pre-wrap)
  - ADR-0003: Vendoring csaf_webview components (Svelte 5)
  - ADR-0006: Content Security Policy headers
  - ADR-0007: URL-scheme allow-list for `<a href>` elements

## Known limitations / TODOs

- **Related documents:** the vendored webview does not wire in-document links (e.g., cross-references between advisories) because the public portal has no router for related items (unlike ISDuBA's SPA).
- **Boxicons:** icons are always rendered (cannot be toggled off). If you prefer different icons, swap `boxicons` for Flowbite's icon library or another.

## License

Apache-2.0. See `LICENSES/Apache-2.0.txt` and `LICENSE`.

**Vendored files** (`src/lib/CSAFWebview/`) retain their original Apache-2.0 copyright from BSI/Intevation. See `src/lib/CSAFWebview/PROVENANCE.md` for details.

Dependencies:

- **dompurify** (3.4.5): MIT
- **boxicons** (2.1.4): Apache-2.0 (BSI)
- **Flowbite** (4.0.2): MIT
- **Tailwind CSS** (4.1.18): MIT
- SvelteKit, Svelte, TypeScript: MIT-like

All production dependencies are vendored with REUSE-compliant license headers.
