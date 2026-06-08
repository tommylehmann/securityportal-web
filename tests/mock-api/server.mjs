// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Deterministic mock of the securityportal-api read-only surface, used by the
// Playwright e2e suite. The SvelteKit detail/list pages fetch the API from their
// *server* `load` functions, so the only way to intercept those calls is to point
// the running app at this server via PUBLIC_API_BASE_URL — Playwright `page.route`
// would only catch browser-side requests and miss the server-side fetch.
//
// Scenario control: the suite drives behaviour by POSTing to /__mock/scenario
// before navigating. State is process-global (one app server, one mock server),
// so tests that change a scenario reset it in their own setup. The two CSAF render
// fixtures are read straight from src/lib/CSAFWebview/__fixtures__/ so the e2e
// suite and the implementer's render path share the same documents.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "src", "lib", "CSAFWebview", "__fixtures__");

const deDoc = JSON.parse(readFileSync(join(fixturesDir, "de-2026-0001.json"), "utf8"));
const enDoc = JSON.parse(readFileSync(join(fixturesDir, "en-bsi-2022-0001.json"), "utf8"));
// Security-test fixture: references contain javascript: and data: payloads (id 3).
// Used by the href-scheme allow-list e2e specs (SA-8, task 22 / C-1).
const maliciousHrefsDoc = JSON.parse(
  readFileSync(join(fixturesDir, "malicious-hrefs.json"), "utf8")
);

// The canned list. Row order here is the API's default (current_release_date desc):
// the EN advisory (2022) would normally sort *after* the DE one (2026), so the
// default order is [DE (id 1), EN (id 2)]. The mock honours the `sort` query param
// the client sends so the sort/pagination assertions exercise real query plumbing.
const ROWS = [
  {
    id: 1,
    tracking_id: "DE-2026-0001",
    publisher_name: "Example AG",
    title: "ExampleApp: Schwachstelle ermöglicht Codeausführung",
    current_release_date: "2026-05-20T10:00:00Z",
    initial_release_date: "2026-05-20T10:00:00Z",
    tlp: "WHITE",
    category: "csaf_security_advisory",
    critical: 8.8,
    cvss_v2_score: null,
    cvss_v3_score: 8.8,
    lang: "de-DE",
    tracking_status: "final",
    version: "1",
    // Phase-4 list shape: each row carries its aggregated CVE ids (never null).
    cves: ["CVE-2026-12345"],
    // Side-table dimensions surfaced only through the facets, not the list row.
    vendors: ["Example AG"],
    products: ["ExampleApp"]
  },
  {
    id: 2,
    tracking_id: "BSI-2022-0001",
    publisher_name: "Bundesamt für Sicherheit in der Informationstechnik",
    title: "CVRF-CSAF-Converter: XML External Entities Vulnerability",
    current_release_date: "2022-04-06T10:00:00Z",
    initial_release_date: "2022-04-06T10:00:00Z",
    tlp: "WHITE",
    category: "csaf_security_advisory",
    critical: 5.3,
    cvss_v2_score: null,
    cvss_v3_score: 5.3,
    lang: "en-US",
    tracking_status: "final",
    version: "1",
    cves: ["CVE-2022-27193"],
    vendors: ["BSI"],
    products: ["CVRF-CSAF-Converter"]
  }
];

// A richer, deterministic corpus exercised only by the filter/facet e2e suite
// (selected via the "facets" scenario). It is a superset of the two canonical
// rows above — ids 1 and 2 keep their exact list-visible fields so list/detail
// specs are unaffected — plus three more rows spanning every facet dimension:
// distinct publishers, vendors, products, categories, TLP labels (RED is NEVER
// present — the public API never leaks restricted documents), languages, CVSS
// severity bands, release dates and CVE ids. The shapes mirror the real API
// (securityportal-api/pkg/web/handlers.go, facets.go).
const FACET_ROWS = [
  ...ROWS,
  {
    id: 3,
    tracking_id: "ACME-2026-0007",
    publisher_name: "Acme Corp",
    title: "Acme Router: critical remote code execution",
    current_release_date: "2026-03-10T10:00:00Z",
    initial_release_date: "2026-03-10T10:00:00Z",
    tlp: "GREEN",
    category: "csaf_security_advisory",
    critical: 9.8,
    cvss_v2_score: null,
    cvss_v3_score: 9.8,
    lang: "en-US",
    tracking_status: "final",
    version: "2",
    cves: ["CVE-2026-20001", "CVE-2026-20002"],
    vendors: ["Acme Corp"],
    products: ["Acme Router", "Acme Gateway"]
  },
  {
    id: 4,
    tracking_id: "ACME-2026-0011",
    publisher_name: "Acme Corp",
    title: "Acme Gateway: information disclosure",
    current_release_date: "2026-01-15T10:00:00Z",
    initial_release_date: "2026-01-15T10:00:00Z",
    tlp: "AMBER",
    category: "csaf_informational_advisory",
    critical: 5.0,
    cvss_v2_score: null,
    cvss_v3_score: 5.0,
    lang: "en-US",
    tracking_status: "final",
    version: "1",
    cves: ["CVE-2026-20050"],
    vendors: ["Acme Corp"],
    products: ["Acme Gateway"]
  },
  {
    id: 5,
    tracking_id: "BETA-2025-0003",
    publisher_name: "Beta GmbH",
    title: "BetaSuite: keine CVSS-Bewertung",
    current_release_date: "2025-11-02T10:00:00Z",
    initial_release_date: "2025-11-02T10:00:00Z",
    tlp: "WHITE",
    category: "csaf_base",
    critical: null,
    cvss_v2_score: null,
    cvss_v3_score: null,
    lang: "de-DE",
    tracking_status: "final",
    version: "1",
    cves: [],
    vendors: ["Beta GmbH"],
    products: ["BetaSuite"]
  }
];

// A corpus with more distinct publishers than FacetCap, so the publisher facet
// is truncated and reports capped:true — exercising the sidebar's "most frequent
// values" indicator. Each publisher is unique (count 1) so the count of distinct
// values, not any single value, drives the cap.
const CAPPED_ROWS = Array.from({ length: 60 }, (_, i) => ({
  id: 1000 + i,
  tracking_id: `CAP-2026-${String(i).padStart(4, "0")}`,
  publisher_name: `Publisher ${String(i).padStart(2, "0")}`,
  title: `Capped corpus advisory ${i}`,
  current_release_date: "2026-02-01T10:00:00Z",
  initial_release_date: "2026-02-01T10:00:00Z",
  tlp: "WHITE",
  category: "csaf_security_advisory",
  critical: 7.5,
  cvss_v2_score: null,
  cvss_v3_score: 7.5,
  lang: "en-US",
  tracking_status: "final",
  version: "1",
  cves: [],
  vendors: [`Vendor ${String(i).padStart(2, "0")}`],
  products: [`Product ${String(i).padStart(2, "0")}`]
}));

const DOCS = { 1: deDoc, 2: enDoc, 3: maliciousHrefsDoc };

// Mutable scenario state, flipped via /__mock/scenario.
//  - "ok":     serve the canned 2-row list / documents (default).
//  - "empty":  list returns zero rows.
//  - "error":  list returns HTTP 500 with an { error } body.
//  - "facets": serve the richer 5-row corpus used by the filter/facet e2e suite.
//  - "capped": serve a 60-publisher corpus so the publisher facet is truncated
//              (capped:true) — exercises the sidebar's "most frequent" notice.
let scenario = "ok";
// Records the query string of the last /api/advisories and /api/facets requests
// so a test can assert the server-side fetch carried the expected params (sort,
// pagination, and — for drill-down — the active filter state).
let lastListQuery = "";
let lastFacetsQuery = "";

// The CSAF v3 severity bands in canonical low-to-high order; mirrors the API's
// SeverityBandNames(). /api/facets always emits all five (incl. zero counts).
const SEVERITY_BANDS = ["none", "low", "medium", "high", "critical"];

// Caps unbounded facets (publisher, vendor, product) at the API's FacetCap; the
// group reports `capped: true` when truncated to its most-frequent values.
const FACET_CAP = 50;

// Returns the row set the current scenario serves (before filtering).
function corpus() {
  if (scenario === "empty") return [];
  if (scenario === "facets") return FACET_ROWS;
  if (scenario === "capped") return CAPPED_ROWS;
  return ROWS;
}

// Classifies a row's effective CVSS score into a severity band, matching the
// API's facetSeverity CASE (NULL or 0 -> none).
function severityBand(score) {
  if (score === null || score === undefined || score === 0) return "none";
  if (score < 4.0) return "low";
  if (score < 7.0) return "medium";
  if (score < 9.0) return "high";
  return "critical";
}

// Parses the filter query params the app sends (names match the API's
// parseFilters exactly) into a normalised shape used by applyFilters/facets.
function parseFilters(searchParams) {
  const multi = (name) => {
    const out = [];
    for (const raw of searchParams.getAll(name)) {
      for (const part of raw.split(",")) {
        const value = part.trim();
        if (value !== "") out.push(value);
      }
    }
    return out;
  };
  const scalar = (name) => (searchParams.get(name) ?? "").trim();
  const num = (name) => {
    const raw = searchParams.get(name);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  return {
    q: scalar("q").toLowerCase(),
    cve: scalar("cve").toLowerCase(),
    publisher: scalar("publisher"),
    vendor: scalar("vendor").toLowerCase(),
    product: scalar("product").toLowerCase(),
    category: scalar("category"),
    lang: scalar("lang"),
    severity: multi("severity"),
    tlp: multi("tlp").map((value) => value.toUpperCase()),
    scoreMin: num("score_min"),
    scoreMax: num("score_max"),
    from: scalar("from"),
    to: scalar("to")
  };
}

// Applies the parsed filter set to a row set, ANDing every active dimension —
// the same "all active filters apply" model the API uses. Matching is
// case-insensitive for free-text/CVE/vendor/product, exact for the column-backed
// publisher/category/lang, and the publishable-TLP invariant is implicit because
// the corpus never contains a RED row (so a tlp=RED filter narrows to nothing).
function applyFilters(rows, f) {
  return rows.filter((row) => {
    if (f.q !== "") {
      const haystack = `${row.title ?? ""} ${row.tracking_id ?? ""} ${(row.cves ?? []).join(
        " "
      )}`.toLowerCase();
      if (!haystack.includes(f.q)) return false;
    }
    if (f.cve !== "" && !(row.cves ?? []).some((cve) => cve.toLowerCase().startsWith(f.cve))) {
      return false;
    }
    if (f.publisher !== "" && row.publisher_name !== f.publisher) return false;
    if (f.category !== "" && row.category !== f.category) return false;
    if (f.lang !== "" && row.lang !== f.lang) return false;
    if (
      f.vendor !== "" &&
      !(row.vendors ?? []).some((vendor) => vendor.toLowerCase() === f.vendor)
    ) {
      return false;
    }
    if (
      f.product !== "" &&
      !(row.products ?? []).some((product) => product.toLowerCase() === f.product)
    ) {
      return false;
    }
    if (f.severity.length > 0 && !f.severity.includes(severityBand(row.critical))) return false;
    if (f.tlp.length > 0 && !f.tlp.includes((row.tlp ?? "").toUpperCase())) return false;
    if (f.scoreMin !== null && !(row.critical !== null && row.critical >= f.scoreMin)) return false;
    if (f.scoreMax !== null && !(row.critical !== null && row.critical <= f.scoreMax)) return false;
    // Dates compare on the YYYY-MM-DD prefix; from/to are inclusive bounds.
    if (f.from !== "" && (row.current_release_date ?? "").slice(0, 10) < f.from) return false;
    if (f.to !== "" && (row.current_release_date ?? "").slice(0, 10) > f.to) return false;
    return true;
  });
}

// Counts a column-backed dimension over the filtered rows, descending by count
// then value (matching the API's ORDER BY n DESC, value ASC), and applies the
// top-N cap for unbounded dimensions.
function facetColumn(rows, pick, { capped = false } = {}) {
  const counts = new Map();
  for (const row of rows) {
    const value = pick(row);
    if (value === null || value === undefined || value === "") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let values = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  let isCapped = false;
  if (capped && values.length > FACET_CAP) {
    values = values.slice(0, FACET_CAP);
    isCapped = true;
  }
  return { values, capped: isCapped };
}

// Counts a multi-valued (side-table) dimension, one count per distinct row that
// carries the value, matching the API's count(DISTINCT d.id) for vendor/product.
// Vendor and product are unbounded, so they are capped like the publisher facet.
function facetMulti(rows, pick) {
  const counts = new Map();
  for (const row of rows) {
    for (const value of new Set(pick(row) ?? [])) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  let values = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  let isCapped = false;
  if (values.length > FACET_CAP) {
    values = values.slice(0, FACET_CAP);
    isCapped = true;
  }
  return { values, capped: isCapped };
}

// Severity facet: all five bands always emitted (incl. zero counts), in
// canonical order, summing to the filtered total — matching the API.
function facetSeverity(rows) {
  const counts = new Map(SEVERITY_BANDS.map((band) => [band, 0]));
  for (const row of rows) {
    const band = severityBand(row.critical);
    counts.set(band, counts.get(band) + 1);
  }
  return {
    values: SEVERITY_BANDS.map((band) => ({ value: band, count: counts.get(band) })),
    capped: false
  };
}

// Computes the full facet payload over a filtered row set (drill-down: the same
// filter state as the list). Field names match the Go Facets struct.
function computeFacets(rows) {
  return {
    publisher: facetColumn(rows, (row) => row.publisher_name, { capped: true }),
    vendor: facetMulti(rows, (row) => row.vendors),
    product: facetMulti(rows, (row) => row.products),
    category: facetColumn(rows, (row) => row.category),
    tlp: facetColumn(rows, (row) => (row.tlp ? row.tlp.toUpperCase() : null)),
    lang: facetColumn(rows, (row) => row.lang),
    severity: facetSeverity(rows)
  };
}

function sortRows(rows, sortParam) {
  // The client sends `sort=column:direction`. Mirror the API's two sortable
  // columns so the rendered order actually depends on the URL.
  const [columnRaw, dirRaw] = (sortParam ?? "").split(":");
  const column = columnRaw === "critical" ? "critical" : "current_release_date";
  const dir = dirRaw === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const av = a[column];
    const bv = b[column];
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return sorted;
}

function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://mock.local");

  // Scenario control endpoint (not part of the real API). Body: { scenario }.
  if (req.method === "POST" && url.pathname === "/__mock/scenario") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        scenario = body.scenario ?? "ok";
        lastListQuery = "";
        lastFacetsQuery = "";
        sendJSON(res, 200, { scenario });
      } catch {
        sendJSON(res, 400, { error: "bad scenario body" });
      }
    });
    return;
  }

  // Inspector: what query did the app's server-side load last send to the list?
  if (req.method === "GET" && url.pathname === "/__mock/last-list-query") {
    sendJSON(res, 200, { query: lastListQuery });
    return;
  }

  // Inspector: the query the app last sent to /api/facets. Used by the filter
  // suite to prove the drill-down re-requests facets with the active filters.
  if (req.method === "GET" && url.pathname === "/__mock/last-facets-query") {
    sendJSON(res, 200, { query: lastFacetsQuery });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJSON(res, 200, { status: "ok", database: "reachable" });
    return;
  }

  // The real list response carries only the public list shape; the side-table
  // dimensions (vendors/products) drive the facets but are never list columns.
  const toListRow = ({ vendors: _vendors, products: _products, ...row }) => row;

  if (
    req.method === "GET" &&
    (url.pathname === "/api/advisories" || url.pathname === "/api/advisories/search")
  ) {
    lastListQuery = url.search.replace(/^\?/, "");
    if (scenario === "error") {
      sendJSON(res, 500, { error: "internal database error" });
      return;
    }
    const limit = Number(url.searchParams.get("limit")) || 25;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const sort = url.searchParams.get("sort") ?? "current_release_date:desc";

    const filtered = applyFilters(corpus(), parseFilters(url.searchParams));
    const all = sortRows(filtered, sort);
    const page = all.slice(offset, offset + limit).map(toListRow);
    sendJSON(res, 200, {
      advisories: page,
      total: all.length,
      limit,
      offset
    });
    return;
  }

  // GET /api/facets: facet counts for the current filter state (drill-down). The
  // same filter params as the list narrow the corpus before counting, so the
  // sidebar counts describe exactly the set the list shows. Error scenario errors
  // here too, matching the app's parallel list+facets load.
  if (req.method === "GET" && url.pathname === "/api/facets") {
    lastFacetsQuery = url.search.replace(/^\?/, "");
    if (scenario === "error") {
      sendJSON(res, 500, { error: "internal database error" });
      return;
    }
    const filtered = applyFilters(corpus(), parseFilters(url.searchParams));
    sendJSON(res, 200, computeFacets(filtered));
    return;
  }

  const docMatch = url.pathname.match(/^\/api\/documents\/(.+)$/);
  if (req.method === "GET" && docMatch) {
    const id = docMatch[1];
    const doc = DOCS[id];
    if (!doc) {
      sendJSON(res, 404, { error: "document not found" });
      return;
    }
    sendJSON(res, 200, doc);
    return;
  }

  sendJSON(res, 404, { error: "not found" });
});

const port = Number(process.env.MOCK_API_PORT) || 8099;
server.listen(port, "127.0.0.1", () => {
  console.error(`mock-api listening on http://127.0.0.1:${port}`);
});
