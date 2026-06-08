// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { catalogFor, type Locale, type Messages } from "$lib/i18n";
import type { LayoutServerLoad } from "./$types";

// Ship the request-scoped locale (resolved in hooks.server.ts) plus its message
// catalog to every page. The catalog travels in the SSR payload so the client
// hydrates with the exact strings the server rendered — no flash, no extra
// round-trip. The catalogs are small, so sending one per page is cheap.
export interface LayoutData {
  locale: Locale;
  messages: Messages;
}

export const load: LayoutServerLoad<LayoutData> = ({ locals }) => {
  const locale = locals.locale;
  return { locale, messages: catalogFor(locale) };
};
