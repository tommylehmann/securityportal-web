// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { invalidateAll } from "$app/navigation";
import { LOCALE_COOKIE, type Locale } from "$lib/i18n";

// One year, in seconds — the locale preference is long-lived but not permanent.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Persists the chosen locale and re-runs the server loads so SSR-resolved data
 * (and the `<html lang>`) follow the switch. The cookie is the source of truth
 * the server reads on the next request; `invalidateAll()` immediately re-fetches
 * the layout/page data with the new cookie in effect, so both server and client
 * agree without a full page reload.
 */
export async function setLocale(locale: Locale): Promise<void> {
  // `SameSite=Lax` and a root path so the cookie is sent on the next request to
  // any portal route. No `Secure` here so it also works over plain HTTP in dev;
  // the deployment terminates TLS upstream.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  await invalidateAll();
}
