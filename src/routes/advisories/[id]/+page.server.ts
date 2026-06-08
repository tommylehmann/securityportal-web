// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { error } from "@sveltejs/kit";
import { ApiError, fetchDocument } from "$lib/api/client";
import { extractMetadata, type AdvisoryMetadata } from "$lib/csaf/metadata";
import type { PageServerLoad } from "./$types";

// Detail load: fetches the verbatim CSAF JSON for one document revision on the
// server (no browser CORS dependency on the API). A non-numeric id, or a 404
// from the API (missing / non-publishable TLP), becomes a SvelteKit 404 so the
// friendly +error page renders. The raw JSON is handed to the page, which runs
// convertToDocModel and feeds the vendored Webview client-side.
//
// The user-facing wording is localized in +error.svelte, not here: the load runs
// on the server with no UI-locale context for the body copy, and surfacing the
// English `error()` detail under a localized heading was a mismatch (F2). We
// throw only the HTTP status (the message is a stable, non-user-facing tag); the
// error page renders the localized text keyed off `page.status`. The message is
// a neutral HTTP reason phrase (never an internal tag), so nothing
// implementation-specific leaks into the serialized SSR error payload.
export interface DetailData {
  id: number;
  document: unknown;
  /**
   * Header-band metadata (title, severity, publisher, dates, TLP, category,
   * CVEs) derived from the loaded CSAF document on the server, so the band
   * renders without a second round-trip (the document endpoint serves only the
   * raw JSON, and there is no by-id metadata endpoint — spec §8).
   */
  metadata: AdvisoryMetadata;
}

export const load: PageServerLoad<DetailData> = async ({ fetch, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) {
    error(404, "Not Found");
  }

  try {
    const document = await fetchDocument(fetch, id);
    return { id, document, metadata: extractMetadata(document) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      error(404, "Not Found");
    }
    if (err instanceof ApiError) {
      error(502, "Bad Gateway");
    }
    throw err;
  }
};
