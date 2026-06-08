// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { ApiError, fetchAdvisories, fetchFacets, parseListQuery } from "$lib/api/client";
import type { AdvisoryList, Facets, ListQuery } from "$lib/api/types";
import type { PageServerLoad } from "./$types";

// Result of the home load: the list plus the facet counts for the WID sidebar,
// or a typed error detail. The error is surfaced so the page can render an
// explicit error state instead of a generic SvelteKit error overlay (the API
// being down is an expected, recoverable condition for a public portal).
//
// `error` carries only the upstream API detail (e.g. the DB error text); the
// user-facing framing ("Unable to load advisories") is localized in the page so
// the chrome stays bilingual. It is null when the load succeeded.
export interface HomeData {
  query: ListQuery;
  list: AdvisoryList | null;
  facets: Facets | null;
  error: string | null;
}

// Server load: both API fetches run server-side (SSR + on navigation the
// SvelteKit server re-invokes it), so the browser never talks to the API
// directly and there is no client CORS dependency on the API origin. `fetch` is
// the SvelteKit request-scoped fetch. The full filter/sort/pagination state
// comes from the URL query string so the page is shareable/bookmarkable, and the
// facets are fetched with the SAME filter state as the list so the sidebar
// counts describe exactly the narrowed set the list shows (drill-down).
export const load: PageServerLoad<HomeData> = async ({ fetch, url }) => {
  const query = parseListQuery(url.searchParams);

  try {
    const [list, facets] = await Promise.all([
      fetchAdvisories(fetch, query),
      fetchFacets(fetch, query.filters)
    ]);
    return { query, list, facets, error: null };
  } catch (err) {
    // Surface only the upstream detail; the page wraps it with localized framing.
    const detail = err instanceof ApiError ? err.message : "unexpected error";
    return { query, list: null, facets: null, error: detail };
  }
};
