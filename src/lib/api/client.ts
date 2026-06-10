// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { env } from "$env/dynamic/public";
import type {
  Advisory,
  AdvisoryList,
  Facets,
  Filters,
  Health,
  ListQuery,
  Severity,
  SortColumn
} from "$lib/api/types";
import { SEVERITY_BANDS } from "$lib/api/types";

// Base URL for browser-side requests (or SSR when no internal URL is set).
//
// Resolution precedence (client / browser):
//   1. PUBLIC_API_BASE_URL — explicit cross-origin base (non-proxy deploys).
//   2. "" — same-origin relative `/api/...`; default for Compose + dev.
//
// For SSR in Compose the server load functions pass a `base` option derived from
// SECURITYPORTAL_API_INTERNAL_URL (read in $lib/server/api-base.ts, which imports
// $env/dynamic/private — a server-only module that MUST NOT be imported here so
// this module stays safe to bundle for the browser).
const BROWSER_API_BASE = (env.PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

/** The whitelist of columns the list endpoint accepts, used to validate input. */
const SORT_COLUMNS: readonly SortColumn[] = ["current_release_date", "critical"];

/** Default page size; mirrors the API's own default. */
export const DEFAULT_LIMIT = 25;

/** Upper bound the API enforces; we clamp here too for honest UI state. */
export const MAX_LIMIT = 100;

/** The scalar text filter params, sharing identical URL<->Filters handling. */
const TEXT_FILTER_KEYS = [
  "q",
  "cve",
  "publisher",
  "vendor",
  "product",
  "category",
  "lang"
] as const;
type TextFilterKey = (typeof TEXT_FILTER_KEYS)[number];

/** A pristine filter set: every dimension inactive. */
export function emptyFilters(): Filters {
  return {
    q: "",
    cve: "",
    publisher: "",
    vendor: "",
    product: "",
    category: "",
    lang: "",
    severity: [],
    tlp: [],
    scoreMin: null,
    scoreMax: null,
    from: "",
    to: ""
  };
}

/** True when no filter dimension is active (used to show/hide "clear all"). */
export function filtersAreEmpty(filters: Filters): boolean {
  return (
    TEXT_FILTER_KEYS.every((key) => filters[key] === "") &&
    filters.severity.length === 0 &&
    filters.tlp.length === 0 &&
    filters.scoreMin === null &&
    filters.scoreMax === null &&
    filters.from === "" &&
    filters.to === ""
  );
}

/**
 * ApiError carries the HTTP status alongside a human-readable message so a
 * `load` function can map it onto the right SvelteKit error (e.g. 404 → a
 * friendly not-found page). Non-2xx responses are never returned as data.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The `fetch` shape both the platform and SvelteKit's `event.fetch` satisfy. */
type FetchFn = typeof fetch;

/**
 * Options accepted by the public fetch helpers.
 *
 * `base` overrides the module-level BROWSER_API_BASE.  Server `load` functions
 * set this to the value returned by $lib/server/api-base:serverApiBase() so
 * SSR fetches go directly to the internal API address (e.g. http://api:8081)
 * rather than looping through Caddy or relying on a same-origin relative URL
 * that the Node server cannot resolve.
 */
export interface FetchOpts {
  base?: string;
}

/**
 * Performs a GET against the API and decodes JSON, mapping non-2xx onto an
 * ApiError. `fetchFn` should be the request-scoped `fetch` passed from a
 * SvelteKit `load` so SSR and request context (cookies, base) are respected.
 */
async function getJSON<T>(fetchFn: FetchFn, path: string, base?: string): Promise<T> {
  // Use the caller-supplied base (SSR internal URL) when present; fall back to
  // the browser public base (PUBLIC_API_BASE_URL or same-origin empty string).
  const resolvedBase = base !== undefined ? base : BROWSER_API_BASE;
  const url = `${resolvedBase}${path}`;

  let response: Response;
  try {
    response = await fetchFn(url, { headers: { Accept: "application/json" } });
  } catch (cause) {
    // Network/DNS/connection failure — the API is unreachable.
    throw new ApiError(0, `cannot reach the API at ${url}: ${String(cause)}`);
  }

  if (!response.ok) {
    // The API returns `{ "error": "..." }` on its error paths; fall back to the
    // status text when the body is absent or not JSON.
    let message = response.statusText || `request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Ignore an unparsable error body and keep the status-text message.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

/** Builds the `sort` query value the API expects: `column:direction`. */
function sortParam(query: ListQuery): string {
  return `${query.sort}:${query.direction}`;
}

/**
 * Appends a filter set onto API request params using the exact names the API's
 * `parseFilters` reads (`q`, `cve`, `severity`, `score_min`, ...). Multi-valued
 * filters are sent as repeated params; only active dimensions are written, so
 * the wire form mirrors the URL form. Both the list and facets calls go through
 * here, guaranteeing the sidebar counts describe the same set the list shows.
 */
function appendFilterParams(params: URLSearchParams, filters: Filters): void {
  for (const key of TEXT_FILTER_KEYS) {
    if (filters[key] !== "") {
      params.set(key, filters[key]);
    }
  }
  for (const value of filters.severity) {
    params.append("severity", value);
  }
  for (const value of filters.tlp) {
    params.append("tlp", value);
  }
  if (filters.scoreMin !== null) {
    params.set("score_min", String(filters.scoreMin));
  }
  if (filters.scoreMax !== null) {
    params.set("score_max", String(filters.scoreMax));
  }
  if (filters.from !== "") {
    params.set("from", filters.from);
  }
  if (filters.to !== "") {
    params.set("to", filters.to);
  }
}

/**
 * Fetches a page of the advisory list. Pagination, sort, and all active filters
 * come from a validated ListQuery; the API clamps `limit` to its own maximum
 * regardless.
 *
 * Server `load` functions should pass `{ base: serverApiBase() }` so SSR
 * fetches go directly to the internal API address (task 33 / ADR-0011).
 */
export async function fetchAdvisories(
  fetchFn: FetchFn,
  query: ListQuery,
  opts: FetchOpts = {}
): Promise<AdvisoryList> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
    sort: sortParam(query)
  });
  appendFilterParams(params, query.filters);
  return getJSON<AdvisoryList>(fetchFn, `/api/advisories?${params.toString()}`, opts.base);
}

/**
 * Fetches the facet counts for the current filter state (drill-down): the same
 * filters as the list, minus pagination/sort, so each dimension's counts match
 * the narrowed result set the list shows.
 *
 * Server `load` functions should pass `{ base: serverApiBase() }`.
 */
export async function fetchFacets(
  fetchFn: FetchFn,
  filters: Filters,
  opts: FetchOpts = {}
): Promise<Facets> {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  const query = params.toString();
  return getJSON<Facets>(fetchFn, query ? `/api/facets?${query}` : "/api/facets", opts.base);
}

/**
 * Fetches the stored CSAF JSON for one document revision, verbatim. The shape is
 * an arbitrary CSAF document; the caller feeds it to `convertToDocModel`. A
 * missing/non-publishable id surfaces as an ApiError with status 404.
 *
 * This is the internal/revision-level endpoint (/api/documents/:id).
 * For the public advisory permalink use fetchAdvisory (ADR-0016).
 *
 * Server `load` functions should pass `{ base: serverApiBase() }`.
 */
export async function fetchDocument(
  fetchFn: FetchFn,
  id: number,
  opts: FetchOpts = {}
): Promise<unknown> {
  return getJSON<unknown>(fetchFn, `/api/documents/${encodeURIComponent(String(id))}`, opts.base);
}

/**
 * The shape of the withdrawn envelope returned by the API as HTTP 410 Gone
 * when an advisory has been tombstoned (ADR-0015/ADR-0016 §4). The caller
 * receives this as structured data rather than an error so the detail page can
 * render the "no longer published" notice with the stored tracking_id and
 * withdrawal timestamp.
 */
export interface WithdrawnEnvelope {
  withdrawn: true;
  tracking_id: string;
  withdrawn_at: string | null;
}

/**
 * Fetches the latest publishable document for an advisory by its canonical
 * (publisher, tracking_id) permalink (ADR-0016). Both segments are
 * percent-encoded with `encodeURIComponent` so values containing `:`, spaces,
 * `/`, `&`, etc. round-trip through Gin's path-param decode correctly
 * (C-21/SA-31).
 *
 * Returns either the raw CSAF JSON (for a live advisory) or a WithdrawnEnvelope
 * (for a tombstoned advisory — HTTP 410 Gone from the API). A
 * missing/non-publishable advisory surfaces as an ApiError with status 404.
 * Any other non-2xx response surfaces as an ApiError with its HTTP status.
 *
 * Server `load` functions should pass `{ base: serverApiBase() }`.
 */
export async function fetchAdvisory(
  fetchFn: FetchFn,
  publisher: string,
  trackingId: string,
  opts: FetchOpts = {}
): Promise<unknown | WithdrawnEnvelope> {
  const resolvedBase = opts.base !== undefined ? opts.base : BROWSER_API_BASE;
  const path = `/api/advisories/${encodeURIComponent(publisher)}/${encodeURIComponent(trackingId)}`;
  const url = `${resolvedBase}${path}`;

  let response: Response;
  try {
    response = await fetchFn(url, { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new ApiError(0, `cannot reach the API at ${url}: ${String(cause)}`);
  }

  // 410 Gone — withdrawn advisory. The body is the WithdrawnEnvelope shape
  // `{ withdrawn: true, tracking_id, withdrawn_at }`, not the error envelope.
  // We parse it as structured data rather than throwing so the page server can
  // return WithdrawnData to the page without a second round-trip.
  if (response.status === 410) {
    try {
      const envelope = (await response.json()) as WithdrawnEnvelope;
      return envelope;
    } catch {
      // Unparsable 410 body — treat as a generic error.
      throw new ApiError(410, response.statusText || "Gone");
    }
  }

  if (!response.ok) {
    let message = response.statusText || `request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Ignore an unparsable error body and keep the status-text message.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as unknown;
}

/**
 * Fetches API health (DB reachability + last ingest time).
 *
 * Server `load` functions should pass `{ base: serverApiBase() }`.
 */
export async function fetchHealth(fetchFn: FetchFn, opts: FetchOpts = {}): Promise<Health> {
  return getJSON<Health>(fetchFn, "/api/health", opts.base);
}

/**
 * Parses and validates the list query out of a URL's search params, falling back
 * to defaults for anything missing or malformed. Centralising this keeps the
 * `load` function, the page, and the URL in agreement (shareable/bookmarkable
 * state). Unknown sort columns or directions fall back to the defaults rather
 * than erroring — a stale/hand-edited URL still renders a sensible page.
 */
export function parseListQuery(searchParams: URLSearchParams): ListQuery {
  let limit = DEFAULT_LIMIT;
  const rawLimit = Number(searchParams.get("limit"));
  if (Number.isInteger(rawLimit) && rawLimit > 0) {
    limit = Math.min(rawLimit, MAX_LIMIT);
  }

  let offset = 0;
  const rawOffset = Number(searchParams.get("offset"));
  if (Number.isInteger(rawOffset) && rawOffset > 0) {
    offset = rawOffset;
  }

  let sort: SortColumn = "current_release_date";
  const rawSort = searchParams.get("sort");
  if (rawSort && (SORT_COLUMNS as readonly string[]).includes(rawSort)) {
    sort = rawSort as SortColumn;
  }

  const rawDir = searchParams.get("dir");
  const direction = rawDir === "asc" ? "asc" : "desc";

  return { limit, offset, sort, direction, filters: parseFilters(searchParams) };
}

/** Reads a multi-valued param, splitting comma-joined occurrences like the API. */
function multiParam(searchParams: URLSearchParams, name: string): string[] {
  const out: string[] = [];
  for (const raw of searchParams.getAll(name)) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (value !== "") {
        out.push(value);
      }
    }
  }
  return out;
}

/** Reads an optional finite number param; returns null when absent or malformed. */
function numberParam(searchParams: URLSearchParams, name: string): number | null {
  const raw = searchParams.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Reads a `YYYY-MM-DD` date param; returns "" for anything that doesn't match. */
function dateParam(searchParams: URLSearchParams, name: string): string {
  const raw = (searchParams.get(name) ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

/**
 * Parses the combinable filter state out of URL search params. This is the
 * single canonical URL→Filters mapping the sidebar, list, and facets all share.
 * Unknown severity bands are dropped, TLP labels upper-cased, dates validated
 * to `YYYY-MM-DD`, and scores coerced to finite numbers — a stale or hand-edited
 * URL still yields a sensible, safe filter set rather than erroring.
 */
export function parseFilters(searchParams: URLSearchParams): Filters {
  const filters = emptyFilters();

  for (const key of TEXT_FILTER_KEYS) {
    const value = (searchParams.get(key) ?? "").trim();
    if (value !== "") {
      filters[key as TextFilterKey] = value;
    }
  }

  filters.severity = multiParam(searchParams, "severity").filter((value): value is Severity =>
    (SEVERITY_BANDS as readonly string[]).includes(value)
  );
  filters.tlp = multiParam(searchParams, "tlp").map((value) => value.toUpperCase());

  filters.scoreMin = numberParam(searchParams, "score_min");
  filters.scoreMax = numberParam(searchParams, "score_max");
  filters.from = dateParam(searchParams, "from");
  filters.to = dateParam(searchParams, "to");

  return filters;
}

/**
 * Serialises a filter set into URL search params, writing only active
 * dimensions so the URL stays clean. The canonical Filters→URL mapping; the
 * inverse of parseFilters (it round-trips a parsed filter set).
 */
export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  return params;
}

/**
 * Serialises a list query back into URL search params, omitting values that are
 * at their default so the URL stays clean (`/` shows the default list).
 */
export function listQueryToSearchParams(query: ListQuery): URLSearchParams {
  const params = filtersToSearchParams(query.filters);
  if (query.sort !== "current_release_date") {
    params.set("sort", query.sort);
  }
  if (query.direction !== "desc") {
    params.set("dir", query.direction);
  }
  if (query.limit !== DEFAULT_LIMIT) {
    params.set("limit", String(query.limit));
  }
  if (query.offset > 0) {
    params.set("offset", String(query.offset));
  }
  return params;
}

/**
 * Maps an advisory's effective CVSS score to a CSAF severity bucket. Advisories
 * with no score render as `none`. Ranges follow the CVSS v3 specification.
 */
export function severityOf(
  advisory: Pick<Advisory, "critical">
): import("$lib/api/types").Severity {
  const score = advisory.critical;
  if (score === null || score <= 0) return "none";
  if (score < 4) return "low";
  if (score < 7) return "medium";
  if (score < 9) return "high";
  return "critical";
}
