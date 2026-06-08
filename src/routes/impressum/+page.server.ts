// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Server-side load for the Impressum page (spec §16.4, ADR-0010, tasks 31-32).
//
// Resolves the operator-mounted Markdown file for (page=impressum, locale) and
// returns sanitized HTML for rendering via {@html} — the one permitted {@html}
// sink (ADR-0010 / SA-6 carve-out).  See legal-markdown.ts for the sanitizer.
//
// Path derivation:  FIXED map {page × locale} → path (SA-20 / C-10):
//   ${LEGAL_DIR}/impressum.${locale}.md
//
// The filename is NEVER derived from request input (query params, headers, path
// segments).  Only the two supported locales (de, en) are accepted.
//
// Fallback chain (never 500):
//   1. Resolved locale file        → return sanitized HTML, source: 'file'
//   2. Other locale file           → return sanitized HTML, source: 'file'
//   3. legalDir unset / both files
//      missing/oversized/error     → return source: 'fallback'
//      (page renders i18n placeholder + amber banner)

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PageServerLoad } from "./$types";
import { getRuntimeBranding } from "$lib/server/runtime-config";
import { renderLegalMarkdown } from "$lib/server/legal-markdown";
import type { Locale } from "$lib/i18n";

// 512 KiB read cap (spec §16.4).
const MAX_BYTES = 512 * 1024;

const PAGE = "impressum" as const;

/**
 * Attempts to read and render `${legalDir}/${page}.${locale}.md`.
 * Returns the sanitized HTML string on success, or null on any failure
 * (missing file, oversized file, read error).
 */
async function tryReadAndRender(legalDir: string, locale: Locale): Promise<string | null> {
  const filePath = join(legalDir, `${PAGE}.${locale}.md`);
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

export const load: PageServerLoad = async ({ locals }) => {
  const { legalDir } = getRuntimeBranding();
  const locale = locals.locale;

  if (legalDir) {
    // Primary: try the resolved locale.
    const html = await tryReadAndRender(legalDir, locale);
    if (html !== null) {
      return { source: "file" as const, html };
    }

    // Fallback to the other locale.
    const otherLocale: Locale = locale === "de" ? "en" : "de";
    const fallbackHtml = await tryReadAndRender(legalDir, otherLocale);
    if (fallbackHtml !== null) {
      return { source: "file" as const, html: fallbackHtml };
    }
  }

  // No usable file — signal the page to render the i18n placeholder.
  return { source: "fallback" as const, html: "" };
};
