<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

# CSAFWebview — vendoring provenance

## Source

This directory is a **vendored fork** of the CSAF single-document viewer.

- **Upstream of upstream:** `csaf_webview` (BSI / Intevation, Apache-2.0) — the
  original Svelte 4 / SvelteKit 1 / chota viewer.
- **Direct source (what was copied here):** the Svelte 5 fork that ISDuBA
  maintains at `ISDuBA/client/src/lib/Advisories/CSAFWebview/`. SecurityPortal
  targets Svelte 5 / SvelteKit 2 / Tailwind 4 to match ISDuBA, so the Svelte 5
  variant is the correct base (see ADR-0003).
- **Date vendored:** 2026-06-05.
- **Entry-point contract (unchanged):** `convertToDocModel(json)` → `appStore` →
  `<Webview>`.

Vendored files keep their original `SPDX-FileCopyrightText` (BSI / Intevation)
and `SPDX-License-Identifier: Apache-2.0` headers — they are derived works and
remain REUSE-compliant. Only net-new SecurityPortal files use the neutral
`2026 SecurityPortal contributors` copyright.

## Net-new files (SecurityPortal-authored)

- `store.svelte.ts` — a slim, self-contained replacement for ISDuBA's
  application store. It exposes only the `appStore` surface the viewer reads:
  the document view-model and the small amount of transient UI state
  (`selectedCVE`, `selectedProduct`, `history`, `four_cves`).
- `components/Link.svelte` — a plain in-document anchor, replacing ISDuBA's
  SPA-router-coupled `Link`.

## Local modifications

### 1. Standalone adaptation (removed ISDuBA-only coupling)

- Replaced ISDuBA's large `$lib/store.svelte` (auth/OIDC, search, workflow,
  diff, dark-mode, messages) with the slim local `store.svelte.ts`.
- Removed the search-match highlight/auto-scroll feature
  (`$lib/Advisories/advisory.svelte`, `splitMatches` from `$lib/utils`) from
  `Webview`, `Collapsible`, `Notes`, `Product`, and `SearchableText`.
- Removed the "related documents" navigation (ISDuBA SPA routing via
  `$routes/router.svelte` / `svelte-spa-router` and `getContext("advisory")`)
  from `Webview`, `General`, and `Vulnerability`.
- Inlined the two tiny type/const dependencies that lived in unrelated ISDuBA
  modules: `CVSSTextualRating` (from `$lib/Statistics/statistics`) into
  `general/CVSS.svelte`, and `tablePadding` (from `$lib/Table/defaults`) into
  `general/RevisionHistory.svelte`.
- Vendored `pmdTypes.ts` (CSAF schema types) and `components/CBadge.svelte`
  verbatim from ISDuBA, with headers intact.
- Did not vendor `Back.svelte` (ISDuBA in-page back-navigation, not used by the
  `Webview` tree) or the `*.test.ts` files (tests are added separately).
- Dropped `convertToDocModel`'s only caller change: `loadFile.ts` now imports
  the local store; its behaviour is otherwise unchanged.

### 2. Free-text rendering fix (ADR-0001, mandatory)

CSAF free-text fields are authored by untrusted external vendors. They are
rendered as **escaped plain text with `white-space: pre-wrap`** so author line
breaks are preserved — never `{@html}`, never Markdown.

- `SearchableText.svelte` — rewritten to render `{text}` (escaped) inside a
  `.csaf-free-text` span that applies `white-space: pre-wrap; overflow-wrap:
anywhere`. This is the single choke point through which all free-text fields
  flow (directly, or via `ValueField` / `ValueList` / `KeyValue`).
- `notes/Note.svelte` — dropped the never-defined `display-markdown` class and
  the misleading `markdown-text` wrapper name.
- `KeyValue.svelte` — fixed the `text`/`Text` branch, which upstream printed the
  loop **index** inside a never-defined `display-markdown` class; it now renders
  the actual value through `SearchableText`.

The reference viewers (`csaf_webview`, ISDuBA) put free text in normal flow
(collapsing `\n`) and referenced an undefined `display-markdown` class; both
defects are corrected here.

## Icons

The vendored components use Boxicons (`bx ...`) classes for chevrons and product
status glyphs, matching ISDuBA and the upstream `csaf_webview` (which depends on
the same `boxicons` package). The `boxicons` runtime dependency is now installed
and its stylesheet is imported once in `src/routes/+layout.svelte`
(`boxicons/css/boxicons.min.css`), so the glyphs render. (Resolves reviewer
finding F2.)
