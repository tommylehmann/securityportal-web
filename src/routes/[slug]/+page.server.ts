// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Generic content-page route — server-side load (ADR-0018, tasks 49-51).
//
// SECURITY (SA-52 / C-36 / SA-20 / C-10):
//   The URL slug NEVER reaches a filesystem join directly.  It is first
//   validated by lookupSlug() against the CLOSED content registry; only a
//   matched registry entry determines which file(s) are accessed.  An
//   unregistered or traversal slug → 404.
//
// Source kinds (ADR-0018):
//   'legal'  — reads ${LEGAL_DIR}/<slug>.<locale>.md, passes through
//               renderLegalMarkdown + 512 KiB cap + fallback chain (ADR-0010).
//   'repo'   — loads the bundled static import for this slug+locale, passes
//               through the SAME renderLegalMarkdown pipeline.  Repo content is
//               trusted but sanitized for uniformity (one {@html} sink, SA-19).
//
// Fallback chain for 'legal' pages (never 500):
//   1. ${LEGAL_DIR}/<slug>.<locale>.md   → sanitized HTML, source:'file'
//   2. ${LEGAL_DIR}/<slug>.<other>.md    → sanitized HTML, source:'file'
//   3. Both missing / legalDir unset     → source:'fallback', html:''
//      (page renders the per-slug i18n placeholder + amber banner)
//
// For 'repo' pages the bundled Markdown is always present in the image, so
// there is no fallback path; the page always renders.

import { error } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PageServerLoad } from "./$types";
import { getRuntimeBranding } from "$lib/server/runtime-config";
import { renderLegalMarkdown } from "$lib/server/legal-markdown";
import { lookupSlug } from "$lib/content/registry";
import type { Locale } from "$lib/i18n";

// 512 KiB read cap (spec §16.4, ADR-0010).
const MAX_BYTES = 512 * 1024;

// ---------------------------------------------------------------------------
// Repo-bundled Markdown static imports (kind:'repo').
//
// Each slug that uses kind:'repo' needs an entry here.  This is intentional:
// static imports are resolved at build time, keeping the closed-registry
// discipline (no dynamic require, no request-input path join).
// ---------------------------------------------------------------------------

// Vite/SvelteKit: ?raw suffix returns the file content as a string at build time.
// These imports are tree-shaken in practice and only reach the server bundle.
import manualDe from "$lib/content/manual.de.md?raw";
import manualEn from "$lib/content/manual.en.md?raw";

/** Map of slug → locale → raw Markdown string for bundled 'repo' content. */
const REPO_CONTENT: Record<string, Record<Locale, string>> = {
  manual: {
    de: manualDe,
    en: manualEn
  }
};

// ---------------------------------------------------------------------------
// Legal file reader (kind:'legal')
// ---------------------------------------------------------------------------

/**
 * Attempts to read and render `${legalDir}/${slug}.${locale}.md`.
 * Returns the sanitized HTML string on success, or null on any failure
 * (missing file, oversized file, read error).
 *
 * The slug here is guaranteed to have passed lookupSlug() — it is a known
 * registry key with no path separators.  join() is used for portability but
 * the slug value is already validated; no user-controlled component escapes.
 */
async function tryReadLegal(
  legalDir: string,
  slug: string,
  locale: Locale
): Promise<string | null> {
  const filePath = join(legalDir, `${slug}.${locale}.md`);
  try {
    const raw = await readFile(filePath, { encoding: "utf8", flag: "r" });
    if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) {
      console.warn(`[securityportal] legal file ${filePath} exceeds 512 KiB cap — using fallback`);
      return null;
    }
    return renderLegalMarkdown(raw);
  } catch {
    // File missing, permission error, or other I/O failure — use fallback.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page data types
// ---------------------------------------------------------------------------

export interface ContentPageData {
  /** Registry title key, passed to the page for <title> and <h1>. */
  titleKey: string;
  /** Source discriminant drives the template branch. */
  source: "file" | "repo" | "fallback";
  /** Sanitized HTML string (empty string when source === 'fallback'). */
  html: string;
  /** The resolved slug (from the closed registry, not raw request input). */
  slug: string;
}

// ---------------------------------------------------------------------------
// Load function
// ---------------------------------------------------------------------------

export const load: PageServerLoad<ContentPageData> = async ({ params, locals }) => {
  const rawSlug = params.slug;

  // Gate 1: validate and look up slug in the closed registry.
  // Any traversal attempt, unknown slug, or suspicious character → 404.
  const entry = lookupSlug(rawSlug);
  if (!entry) {
    error(404, "Not Found");
  }

  const locale = locals.locale;

  if (entry.kind === "repo") {
    // Bundled Markdown: always available; no fallback path needed.
    const localeContent = REPO_CONTENT[rawSlug];
    if (!localeContent) {
      // This would be a programming error (repo entry registered but no static
      // import added).  Log and fall through to the fallback.
      console.error(
        `[securityportal] repo content registered for slug '${rawSlug}' but no static import found`
      );
      return { titleKey: entry.titleKey, source: "fallback", html: "", slug: rawSlug };
    }
    const rawMd = localeContent[locale] ?? localeContent["en"] ?? localeContent["de"];
    return {
      titleKey: entry.titleKey,
      source: "repo",
      html: renderLegalMarkdown(rawMd),
      slug: rawSlug
    };
  }

  // kind === 'legal': read from operator-mounted LEGAL_DIR.
  const { legalDir } = getRuntimeBranding();

  if (legalDir) {
    // Primary: try the resolved locale.
    const html = await tryReadLegal(legalDir, rawSlug, locale);
    if (html !== null) {
      return { titleKey: entry.titleKey, source: "file", html, slug: rawSlug };
    }

    // Fallback: try the other locale.
    const otherLocale: Locale = locale === "de" ? "en" : "de";
    const fallbackHtml = await tryReadLegal(legalDir, rawSlug, otherLocale);
    if (fallbackHtml !== null) {
      return { titleKey: entry.titleKey, source: "file", html: fallbackHtml, slug: rawSlug };
    }
  }

  // No usable file — signal the page to render the i18n placeholder.
  return { titleKey: entry.titleKey, source: "fallback", html: "", slug: rawSlug };
};
