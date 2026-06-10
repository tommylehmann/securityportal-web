// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { error } from "@sveltejs/kit";
import { ApiError, fetchAdvisory, type WithdrawnEnvelope } from "$lib/api/client";
import { extractMetadata, type AdvisoryMetadata } from "$lib/csaf/metadata";
import { serverApiBase } from "$lib/server/api-base";
import type { PageServerLoad } from "./$types";

// Detail load: fetches the latest publishable CSAF advisory by its canonical
// (publisher, tracking_id) permalink (ADR-0016). Both params arrive URL-decoded
// by the SvelteKit router. A 404 from the API (missing or non-publishable TLP)
// becomes a SvelteKit 404 so the friendly +error page renders.
//
// When the advisory has been withdrawn, the API returns HTTP 410 Gone with a
// JSON envelope { withdrawn: true, tracking_id, withdrawn_at }. fetchAdvisory
// surfaces this as a WithdrawnEnvelope value (not an error) so we return a
// minimal data shape to the page without calling extractMetadata/convertToDocModel
// — raw document bytes are intentionally not used (C-17/SA-29, ADR-0016 §4).
//
// C-21/SA-31: params.publisher and params.trackingId are NEVER echoed into
// DOM-reaching error bodies. The load throws only stable HTTP status codes; the
// +error page renders localized text keyed off page.status.

/** Returned when the advisory is live and its document is available. */
export interface DetailData {
  withdrawn: false;
  trackingId: string;
  document: unknown;
  /**
   * Header-band metadata (title, severity, publisher, dates, TLP, category,
   * CVEs) derived from the loaded CSAF document on the server, so the band
   * renders without a second round-trip (ADR-0016, spec §8).
   */
  metadata: AdvisoryMetadata;
}

/** Returned when the advisory has been withdrawn (OQ-3 / ADR-0016 §4). */
export interface WithdrawnData {
  withdrawn: true;
  trackingId: string;
  /** ISO-8601 timestamp string or null when the withdrawal time was not recorded. */
  withdrawnAt: string | null;
}

export type PageData = DetailData | WithdrawnData;

export const load: PageServerLoad<PageData> = async ({ fetch, params }) => {
  const trackingId = params.trackingId;
  const publisher = params.publisher;

  try {
    const result = await fetchAdvisory(fetch, publisher, trackingId, {
      base: serverApiBase()
    });

    // Check for the withdrawn envelope: { withdrawn: true, tracking_id, withdrawn_at }.
    // The API emits HTTP 410 Gone for withdrawn advisories; fetchAdvisory surfaces
    // the 410 body as a WithdrawnEnvelope value so we can return structured data
    // to the page (C-17/SA-29, ADR-0016 §4).
    if (isWithdrawnEnvelope(result)) {
      // C-17/SA-29: return envelope only — do NOT call extractMetadata/convertToDocModel.
      // Use the stored tracking_id from the DB response (result.tracking_id), not
      // the raw route param, so the echoed value is always the server's authoritative
      // string (C-21/SA-31).
      return {
        withdrawn: true as const,
        trackingId: result.tracking_id,
        withdrawnAt: result.withdrawn_at
      };
    }

    // Live advisory: extract header-band metadata on the server so the band
    // renders without a second round-trip.
    return {
      withdrawn: false as const,
      trackingId,
      document: result,
      metadata: extractMetadata(result)
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // C-21/SA-31: throw a static status — do not include publisher or
      // trackingId in the error message so no path value reaches the serialised
      // SSR error payload.
      error(404, "Not Found");
    }
    if (err instanceof ApiError) {
      error(502, "Bad Gateway");
    }
    throw err;
  }
};

/** Type guard: narrows an unknown API response to the withdrawn envelope shape. */
function isWithdrawnEnvelope(value: unknown): value is WithdrawnEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).withdrawn === true
  );
}
