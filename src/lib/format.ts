// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import type { Locale } from "$lib/i18n";

// Locale-aware calendar-date formatting for the chrome (release dates in the
// result list, the detail header band). CSAF document content is formatted by
// the vendored viewer and is out of scope here.
//
// CRITICAL — deterministic, UTC, no Intl: the same ISO timestamp must render
// identically on the server (SSR, no browser locale, possibly UTC host) and on
// the client (any timezone), or hydration mismatches and timezone drift appear.
// So we read the UTC calendar fields off the parsed date and assemble the string
// ourselves rather than going through `toLocaleDateString`/`Intl` (whose output
// depends on the host's locale data and timezone). German renders as DD.MM.YYYY,
// English as the language-neutral ISO YYYY-MM-DD.

/** Zero-pads a number to a fixed width (UTC fields are always non-negative here). */
function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Formats an ISO-8601 timestamp as a calendar date for the given UI locale,
 * using the date's UTC fields so SSR and the client always agree:
 * - `de` → `DD.MM.YYYY`
 * - `en` (and any other locale) → ISO `YYYY-MM-DD`
 *
 * Returns an em dash for a missing or unparsable value so table cells never read
 * "Invalid Date".
 */
export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const year = pad(date.getUTCFullYear(), 4);
  const month = pad(date.getUTCMonth() + 1, 2);
  const day = pad(date.getUTCDate(), 2);

  return locale === "de" ? `${day}.${month}.${year}` : `${year}-${month}-${day}`;
}
