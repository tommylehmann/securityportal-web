// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { catalogFor, type Locale, type Messages } from "$lib/i18n";
import { getRuntimeBranding, type RuntimeBranding } from "$lib/server/runtime-config";
import type { LayoutServerLoad } from "./$types";

// Ship the request-scoped locale (resolved in hooks.server.ts) plus its message
// catalog to every page. The catalog travels in the SSR payload so the client
// hydrates with the exact strings the server rendered — no flash, no extra
// round-trip. The catalogs are small, so sending one per page is cheap.
//
// The branding field carries operator-supplied overrides for brand name,
// subtitle, and theme colors (spec §16.2, task 27).  It is resolved once per
// process (memoized) and travels in the layout data so +layout.svelte can
// apply the theme inline-style and replace the default glyph with the logo.
export interface LayoutData {
  locale: Locale;
  messages: Messages;
  branding: RuntimeBranding;
}

export const load: LayoutServerLoad<LayoutData> = ({ locals }) => {
  const locale = locals.locale;
  return {
    locale,
    messages: catalogFor(locale),
    branding: getRuntimeBranding()
  };
};
