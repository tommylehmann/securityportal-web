// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

/**
 * Allow-list of URL schemes that are safe to render as live anchor hrefs.
 * Everything not in this list (javascript:, data:, vbscript:, etc.) is
 * rejected and the URL must be rendered as inert escaped text instead.
 * See decisions/0007-href-scheme-allowlist.md and threat-model control C-1.
 */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Returns true when `url` begins with one of the allow-listed schemes
 * (`http:`, `https:`, `mailto:`).  A URL with any other scheme — including
 * `javascript:`, `data:`, `vbscript:` — returns false and must NOT be placed
 * in an `<a href>` attribute.
 *
 * The check is scheme-only: it does not validate the rest of the URL structure.
 * An absent or non-string value also returns false.
 */
export function isSafeUrl(url: string | undefined | null): url is string {
  if (typeof url !== "string" || url.trim() === "") return false;
  try {
    const parsed = new URL(url);
    return SAFE_SCHEMES.has(parsed.protocol);
  } catch {
    // URL is relative or otherwise unparseable — not a safe absolute URL for
    // CSAF content (which must always be absolute per the spec).
    return false;
  }
}
