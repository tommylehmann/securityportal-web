// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

/**
 * Formats an ISO-8601 timestamp as a calendar date. Returns an em dash for a
 * missing or unparsable value so table cells never read "Invalid Date".
 *
 * The locale is intentionally fixed to ISO `YYYY-MM-DD` for now: it is
 * language-neutral and avoids a hydration mismatch between the server (no
 * browser locale) and the client. Locale-aware formatting is a Phase-5 i18n
 * concern.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}
