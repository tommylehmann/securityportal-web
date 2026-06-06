// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Types mirroring the securityportal-api read-only JSON surface. Field names and
// nullability match the Go structs in `securityportal-api/pkg/database/queries.go`
// and `pkg/web/handlers.go` exactly — keep them in sync. Nullable Go pointers
// (`*string`, `*float64`, `*time.Time`) surface as `value | null` here.

/** One row of GET /api/advisories — the latest revision of an advisory. */
export interface Advisory {
  id: number;
  tracking_id: string;
  publisher_name: string | null;
  title: string | null;
  current_release_date: string | null;
  initial_release_date: string | null;
  tlp: string | null;
  category: string | null;
  /** Effective CVSS severity score (coalesce v3, v2); drives the severity badge. */
  critical: number | null;
  cvss_v2_score: number | null;
  cvss_v3_score: number | null;
  lang: string | null;
  tracking_status: string | null;
  version: string | null;
  /** CVE ids aggregated from the document; an empty array when none, never null. */
  cves: string[];
}

/** Body of GET /api/advisories. */
export interface AdvisoryList {
  advisories: Advisory[];
  total: number;
  limit: number;
  offset: number;
}

/** Body of GET /api/health. */
export interface Health {
  status: string;
  database: string;
  last_ingest?: string;
  version?: string;
}

/** Column the list may be ordered by — the whitelist the API accepts. */
export type SortColumn = "current_release_date" | "critical";

/** Sort direction suffix the API understands (`column:asc` / `column:desc`). */
export type SortDirection = "asc" | "desc";

/**
 * CSAF severity buckets (CVSS v3 base-score ranges, per the CVSS spec). `none`
 * also covers advisories that carry no score at all.
 */
export type Severity = "none" | "low" | "medium" | "high" | "critical";

/** The severity bands in canonical low-to-high order (matches the API). */
export const SEVERITY_BANDS: readonly Severity[] = ["none", "low", "medium", "high", "critical"];

/**
 * The combinable search/facet filter state shared by the result list and the
 * facet sidebar. Mirrors the query params the API's `parseFilters` reads
 * (`securityportal-api/pkg/web/handlers.go`): scalar text fields, multi-valued
 * severity/tlp, an optional CVSS score range and an optional release-date range.
 * Multi-valued and range fields are absent (empty array / null) when inactive so
 * the URL stays clean.
 */
export interface Filters {
  /** Free-text query (`q`). */
  q: string;
  /** CVE id substring (`cve`). */
  cve: string;
  publisher: string;
  vendor: string;
  product: string;
  category: string;
  lang: string;
  /** Selected severity bands (`severity`, repeatable). */
  severity: Severity[];
  /** Selected TLP labels, upper-cased (`tlp`, repeatable). */
  tlp: string[];
  /** Inclusive CVSS score bounds; null when unset. */
  scoreMin: number | null;
  scoreMax: number | null;
  /** Release-date range as `YYYY-MM-DD` strings; empty when unset. */
  from: string;
  to: string;
}

/** Validated query state for the advisory list, read from / written to the URL. */
export interface ListQuery {
  limit: number;
  offset: number;
  sort: SortColumn;
  direction: SortDirection;
  filters: Filters;
}

/** One counted facet value (`{ value, count }`) returned by GET /api/facets. */
export interface FacetCount {
  value: string;
  count: number;
}

/**
 * One facet dimension: its counted values plus a `capped` flag the API sets when
 * it truncated the dimension to its most-frequent values (cap 50).
 */
export interface FacetGroup {
  values: FacetCount[];
  capped: boolean;
}

/**
 * Body of GET /api/facets — one group per facet dimension, each counted over the
 * current filter state (drill-down). Field names match the Go `Facets` struct in
 * `securityportal-api/pkg/database/facets.go`.
 */
export interface Facets {
  publisher: FacetGroup;
  vendor: FacetGroup;
  product: FacetGroup;
  category: FacetGroup;
  tlp: FacetGroup;
  lang: FacetGroup;
  severity: FacetGroup;
}
