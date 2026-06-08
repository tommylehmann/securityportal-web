// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Server-only API base resolver (spec §16.5, task 33, ADR-0011).
//
// This module MUST NOT be imported by client-side code or any non-*.server.ts
// module.  It imports $env/dynamic/private — SvelteKit enforces at build time
// that private env variables are never bundled into the client bundle (SA-13).
//
// Resolution order for SSR load functions:
//   1. SECURITYPORTAL_API_INTERNAL_URL — container-internal address
//      (e.g. http://api:8081).  Used in the Compose deployment so SSR fetches
//      bypass Caddy and hit the API directly on the internal Docker network.
//      serverApiBase() returns this value when set.
//   2. PUBLIC_API_BASE_URL — cross-origin absolute base for non-proxy deploys.
//      serverApiBase() returns undefined when the internal URL is unset;
//      client.ts getJSON then falls through to BROWSER_API_BASE (which is
//      PUBLIC_API_BASE_URL when set).
//   3. "" — same-origin relative `/api/...`; the default when neither env var
//      is set (Compose sets both; dev relies on the same-origin default with
//      Vite's /api/ proxy for the browser).
//
// The critical contract: serverApiBase() returns undefined (not "") when
// SECURITYPORTAL_API_INTERNAL_URL is unset, so callers that pass it as the
// `base` option to getJSON trigger the `base !== undefined` fall-through to
// PUBLIC_API_BASE_URL rather than shadowing it with an empty string (F1).

import { env } from "$env/dynamic/private";

// Memoized: env vars are process-stable in adapter-node.
// The outer `undefined` means "not yet resolved"; the inner value is either a
// non-empty URL string (when the env var is set) or `undefined` (when it is not),
// which is exactly what callers need to distinguish "use this base" from "fall
// through to the public/same-origin base" in getJSON.
let _memo: string | undefined | null = null;

/** Clears the memo.  Only used in tests — do not call from application code. */
export function _resetApiBaseMemo(): void {
  _memo = null;
}

/**
 * Returns the base URL that server-side (SSR) load functions should use when
 * calling the API, or `undefined` when none is configured.
 *
 * Resolution order:
 *   1. SECURITYPORTAL_API_INTERNAL_URL — if set and non-empty, returns it
 *      (trailing slashes trimmed).  In Compose this is http://api:8081.
 *      SSR bypasses Caddy and hits the API directly on the internal Docker
 *      network.
 *   2. Returns `undefined` — callers (getJSON) treat undefined as "not
 *      supplied" and fall through to BROWSER_API_BASE (PUBLIC_API_BASE_URL if
 *      set, else same-origin "").
 *
 * Returning `undefined` (not `""`) for the unset case is the key invariant:
 * `getJSON` uses `base !== undefined` to decide whether the caller has
 * overridden the base, so an empty internal URL must not be forwarded as an
 * explicit override that shadows PUBLIC_API_BASE_URL (F1 / task-33 review).
 */
export function serverApiBase(): string | undefined {
  if (_memo !== null) return _memo;
  const raw = (env.SECURITYPORTAL_API_INTERNAL_URL ?? "").trim().replace(/\/+$/, "");
  _memo = raw !== "" ? raw : undefined;
  return _memo;
}
