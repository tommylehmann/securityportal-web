// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Closed content-page registry (ADR-0018, task 49).
//
// SECURITY: slug→source derivation uses ONLY this closed map.  Request input
// (URL path segment) is looked up in the map; it NEVER reaches a filesystem
// join directly.  An unregistered, traversal, or absolute slug yields a 404
// before any file access occurs (SA-52 / C-36 / SA-20 / C-10).
//
// The registry currently has two source kinds:
//
//   'legal' — operator-mounted Markdown at ${LEGAL_DIR}/<slug>.<locale>.md.
//             Uses the 512 KiB cap + missing→other-locale→i18n-placeholder
//             fallback chain from ADR-0010.
//
//   'repo'  — Markdown bundled in src/lib/content/<slug>.<locale>.md,
//             loaded via static import in the route handler.  Repo content is
//             trusted, but it is still passed through renderLegalMarkdown (the
//             single sanitizer) so there is one uniform {@html} sink (ADR-0010 /
//             SA-19).
//
// To add a new content page:
//   1. Add an entry to CONTENT_REGISTRY below.
//   2. Add the i18n title key to de.json / en.json.
//   3. For kind:'repo', add src/lib/content/<slug>.de.md and <slug>.en.md.
//   4. For kind:'legal', the operator mounts the Markdown files at runtime.

import type { MessageKey } from "$lib/i18n";

export type ContentKind = "legal" | "repo";

export interface ContentEntry {
  /** i18n key for the <title> and <h1>. */
  readonly titleKey: MessageKey;
  readonly kind: ContentKind;
}

/**
 * Closed registry mapping slug → content entry.
 *
 * Every key is a simple alphanumeric-plus-hyphen slug with no path separators,
 * dots, or null bytes — enforced by the route handler before lookup.
 */
export const CONTENT_REGISTRY: Readonly<Record<string, ContentEntry>> = {
  impressum: {
    titleKey: "legal.impressum.headTitle",
    kind: "legal"
  },
  datenschutz: {
    titleKey: "legal.datenschutz.headTitle",
    kind: "legal"
  },
  manual: {
    titleKey: "content.manual.headTitle",
    kind: "repo"
  }
};

/**
 * Returns the registry entry for a given slug, or null if the slug is
 * unregistered or contains suspicious characters (traversal, absolute path,
 * null bytes, dots, or slashes).
 *
 * This is the single gate between request input and the closed registry.
 * Call this before ANY further processing of the slug value.
 */
export function lookupSlug(slug: string): ContentEntry | null {
  // Reject anything that could be a traversal attempt or otherwise invalid:
  //   - null bytes
  //   - dots (relative traversal: .. / ./foo)
  //   - slashes (absolute or multi-segment paths)
  //   - percent-encoded sequences left over from partial decoding
  //
  // SvelteKit URL-decodes route params before passing them, so %2e%2e arrives
  // as '..' — the dot check covers that case.  Percent signs here mean double-
  // encoded sequences that were not decoded; reject them too.
  if (
    slug.includes("\0") ||
    slug.includes(".") ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("%")
  ) {
    return null;
  }

  return CONTENT_REGISTRY[slug] ?? null;
}
