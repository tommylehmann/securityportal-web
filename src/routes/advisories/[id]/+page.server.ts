// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { error } from "@sveltejs/kit";
import { ApiError, fetchDocument } from "$lib/api/client";
import type { PageServerLoad } from "./$types";

// Detail load: fetches the verbatim CSAF JSON for one document revision on the
// server (no browser CORS dependency on the API). A non-numeric id, or a 404
// from the API (missing / non-publishable TLP), becomes a SvelteKit 404 so the
// friendly +error page renders. The raw JSON is handed to the page, which runs
// convertToDocModel and feeds the vendored Webview client-side.
export interface DetailData {
  id: number;
  document: unknown;
}

export const load: PageServerLoad<DetailData> = async ({ fetch, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) {
    error(404, "Advisory not found");
  }

  try {
    const document = await fetchDocument(fetch, id);
    return { id, document };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      error(404, "Advisory not found");
    }
    if (err instanceof ApiError) {
      error(502, `Could not load the advisory: ${err.message}`);
    }
    throw err;
  }
};
