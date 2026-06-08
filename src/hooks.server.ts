// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import type { Handle } from "@sveltejs/kit";
import { LOCALE_COOKIE, resolveLocale } from "$lib/i18n";

// Resolve the active UI locale once per request, before any load runs: cookie
// (the toggle's source of truth) → Accept-Language → default. Stashing it on
// `event.locals` lets `+layout.server.ts` ship it (and the catalog) to the page,
// so SSR renders the right language with no hydration flash. We also rewrite the
// `<html lang>` placeholder in app.html so the document language is correct for
// assistive tech and search engines from the first byte.
export const handle: Handle = async ({ event, resolve }) => {
  const locale = resolveLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language")
  );
  event.locals.locale = locale;

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale)
  });
};
