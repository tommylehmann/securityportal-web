SecurityPortal is a public, read-only portal for CSAF 2.0 security advisories.
This page documents how to navigate the portal and how to access the REST API directly.

---

## Browsing and searching

The home page shows the latest published advisories.
Use the filter sidebar to narrow results by:

- **Full-text** — keywords searched across titles, notes, and product names.
- **CVE ID** — exact CVE identifier, e.g. `CVE-2024-12345`.
- **CVSS score** — minimum and/or maximum base score (0.0 – 10.0).
- **Release date** — from / to range on `current_release_date`.
- **Severity** — None / Low / Medium / High / Critical (mapped from CVSS v3 base score).
- **Publisher** — the CSAF document publisher.
- **Vendor / Product** — product and vendor names extracted from the product tree.
- **Category** — CSAF document category (e.g. `csaf_base`, `csaf_security_advisory`).
- **TLP** — Traffic Light Protocol label.
- **Language** — document language code.

All active filters are reflected in the URL query string, so filtered views can be bookmarked or shared.

Clicking an advisory title opens the detail view, which renders the full human-readable HTML using the CSAF Webview component.

---

## REST API

The machine-readable REST API is served under `/api`. An interactive OpenAPI reference is available at **[/api/docs](/api/docs)**.

### Base URL

All endpoints are relative to the portal root, e.g. `https://example.com/api/advisories`.

---

### Advisories

#### List advisories

```
GET /api/advisories
```

Returns the latest publishable revision of every advisory, paginated.

**Query parameters:**

| Parameter   | Type   | Description                                          |
| ----------- | ------ | ---------------------------------------------------- |
| `q`         | string | Full-text search query                               |
| `cve`       | string | CVE ID filter (exact)                                |
| `severity`  | string | One of `none`, `low`, `medium`, `high`, `critical`   |
| `score_min` | float  | Minimum CVSS base score                              |
| `score_max` | float  | Maximum CVSS base score                              |
| `from`      | date   | Release date range start (`YYYY-MM-DD`)              |
| `to`        | date   | Release date range end (`YYYY-MM-DD`)                |
| `product`   | string | Product name filter                                  |
| `vendor`    | string | Vendor name filter                                   |
| `publisher` | string | Publisher filter                                     |
| `tlp`       | string | TLP label filter                                     |
| `category`  | string | CSAF document category filter                        |
| `lang`      | string | Language code filter                                 |
| `limit`     | int    | Page size (default 20, max 100)                      |
| `offset`    | int    | Pagination offset (max 10 000)                       |
| `sort`      | string | Sort field; supported values: `severity`, `released` |
| `order`     | string | `asc` or `desc` (default `desc`)                     |
| `format`    | string | `json` (default) or `csv`                            |

**Response (JSON, status 200):**

```json
{
  "total": 42,
  "advisories": [
    {
      "id": 1,
      "tracking_id": "PORTAL-2024-001",
      "publisher": "Example Corp",
      "title": "Critical vulnerability in Example Software",
      "severity": "critical",
      "cvss_score": 9.8,
      "current_release_date": "2024-06-01T00:00:00Z",
      "initial_release_date": "2024-05-15T00:00:00Z",
      "tlp": "WHITE",
      "category": "csaf_security_advisory",
      "lang": "en",
      "cves": ["CVE-2024-12345"],
      "_links": {
        "self": "/api/advisories/Example%20Corp/PORTAL-2024-001"
      }
    }
  ],
  "_links": {
    "self": "/api/advisories?limit=20&offset=0",
    "first": "/api/advisories?limit=20&offset=0",
    "next": "/api/advisories?limit=20&offset=20"
  }
}
```

---

#### Publisher collection

```
GET /api/advisories/{publisher}
```

Lists advisories from a specific publisher. Accepts the same query parameters as the global list (except `publisher`).

The `{publisher}` segment is URL-encoded; the value must match the `publisher` field in the advisory data exactly.

---

#### Advisory detail (publisher-scoped permalink)

```
GET /api/advisories/{publisher}/{trackingid}
```

Returns the stored CSAF JSON for the latest publishable revision of the advisory identified by `(publisher, tracking_id)`.

This is the **canonical permalink** format. The tracking ID may contain colons and other URL-safe characters (e.g. `RHSA-2024:5101`); encode them when constructing URLs (`%3A` for `:`).

**Status codes:**

| Status   | Meaning                                                     |
| -------- | ----------------------------------------------------------- |
| 200      | Advisory found; body is the CSAF JSON document              |
| 404      | Not found or not publishable                                |
| 410 Gone | Advisory has been withdrawn; body is the withdrawn envelope |

**Withdrawn envelope (410):**

```json
{
  "withdrawn": true,
  "tracking_id": "PORTAL-2024-001",
  "withdrawn_at": "2024-07-01T12:00:00Z"
}
```

A withdrawn advisory is no longer published, but its permalink is preserved and returns 410 so callers can distinguish "never existed" (404) from "was published, now retracted" (410).

---

#### Documents

```
GET /api/documents/{id}
```

Returns the stored CSAF JSON by internal numeric document ID. This is an internal/revision-level endpoint; prefer the publisher-scoped permalink above for stable external links.

---

### Facets

```
GET /api/facets
```

Returns distinct values and counts for each filterable facet, respecting the currently active filter state. Accepts the same query parameters as the advisory list.

**Response example:**

```json
{
  "severity": [
    { "value": "critical", "count": 5 },
    { "value": "high", "count": 12 }
  ],
  "publisher": [{ "value": "Example Corp", "count": 17 }]
}
```

---

### Atom feeds

The portal provides Atom 1.0 feeds for use with feed readers.

#### Global feed

```
GET /api/feed.atom
```

The most recent publishable, non-withdrawn advisories (default 25 entries, max 100). Accepts `limit` as a query parameter.

#### Per-publisher feed

```
GET /api/advisories/{publisher}/feed.atom
```

The same feed scoped to a single publisher.

Feed entries contain: canonical permalink ID, title, updated date, published date, alternate link to the web detail page, and a plain-text summary (title + CVEs + severity). Advisory free text is **not** included in the feed.

---

### Health

```
GET /api/health
```

Returns API service health including database reachability and the time of the last successful ingest cycle.

---

## OpenAPI reference

A full, machine-readable OpenAPI 3.1 description of the API is available at **[/api/openapi.json](/api/openapi.json)**.

An interactive Redoc viewer is available at **[/api/docs](/api/docs)**.
