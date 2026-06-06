// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  emptyFilters,
  fetchAdvisories,
  fetchDocument,
  listQueryToSearchParams,
  parseListQuery,
  severityOf
} from "./client";
import type { AdvisoryList, Filters, ListQuery } from "./types";

/** A ListQuery with the given overrides and otherwise pristine filters. */
function listQuery(overrides: Partial<ListQuery> = {}): ListQuery {
  return {
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort: "current_release_date",
    direction: "desc",
    filters: emptyFilters(),
    ...overrides
  };
}

// $env/dynamic/public is a SvelteKit virtual module; stub it so the client
// resolves its base URL to the empty (same-origin) default under vitest.
vi.mock("$env/dynamic/public", () => ({ env: {} }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("parseListQuery", () => {
  it("falls back to defaults on an empty query", () => {
    const q = parseListQuery(new URLSearchParams(""));
    expect(q).toEqual<ListQuery>(listQuery());
  });

  it("reads valid pagination and sort", () => {
    const q = parseListQuery(new URLSearchParams("limit=10&offset=20&sort=critical&dir=asc"));
    expect(q).toEqual<ListQuery>(
      listQuery({ limit: 10, offset: 20, sort: "critical", direction: "asc" })
    );
  });

  it("clamps limit to the maximum", () => {
    const q = parseListQuery(new URLSearchParams(`limit=${MAX_LIMIT + 50}`));
    expect(q.limit).toBe(MAX_LIMIT);
  });

  it("ignores malformed or unknown values", () => {
    const q = parseListQuery(new URLSearchParams("limit=-5&offset=abc&sort=bogus&dir=sideways"));
    expect(q).toEqual<ListQuery>(listQuery());
  });
});

describe("listQueryToSearchParams", () => {
  it("omits default values for a clean URL", () => {
    const params = listQueryToSearchParams(listQuery());
    expect(params.toString()).toBe("");
  });

  it("round-trips a non-default query", () => {
    const original = listQuery({ limit: 10, offset: 20, sort: "critical", direction: "asc" });
    const params = listQueryToSearchParams(original);
    expect(parseListQuery(params)).toEqual(original);
  });

  it("round-trips an active filter set", () => {
    const filters: Filters = {
      ...emptyFilters(),
      q: "openssl",
      cve: "CVE-2024-1234",
      publisher: "Example Corp",
      vendor: "Acme",
      product: "Widget",
      category: "csaf_security_advisory",
      lang: "en",
      severity: ["high", "critical"],
      tlp: ["WHITE", "GREEN"],
      scoreMin: 7,
      scoreMax: 10,
      from: "2024-01-01",
      to: "2024-12-31"
    };
    const original = listQuery({ filters });
    const params = listQueryToSearchParams(original);
    expect(parseListQuery(params)).toEqual(original);
  });
});

describe("severityOf", () => {
  it("maps CVSS scores to buckets", () => {
    expect(severityOf({ critical: null })).toBe("none");
    expect(severityOf({ critical: 0 })).toBe("none");
    expect(severityOf({ critical: 3.9 })).toBe("low");
    expect(severityOf({ critical: 4 })).toBe("medium");
    expect(severityOf({ critical: 6.9 })).toBe("medium");
    expect(severityOf({ critical: 7 })).toBe("high");
    expect(severityOf({ critical: 8.9 })).toBe("high");
    expect(severityOf({ critical: 9 })).toBe("critical");
    expect(severityOf({ critical: 10 })).toBe("critical");
  });
});

describe("fetchAdvisories", () => {
  it("requests the list endpoint with serialised query and returns the body", async () => {
    const body: AdvisoryList = { advisories: [], total: 0, limit: 10, offset: 0 };
    const fetchFn = vi.fn(async () => jsonResponse(body));

    const result = await fetchAdvisories(
      fetchFn as unknown as typeof fetch,
      listQuery({ limit: 10, sort: "critical", direction: "asc" })
    );

    expect(result).toEqual(body);
    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("/api/advisories?");
    expect(url).toContain("limit=10");
    expect(url).toContain("sort=critical%3Aasc");
  });

  it("serialises active filters as API query params", async () => {
    const body: AdvisoryList = { advisories: [], total: 0, limit: DEFAULT_LIMIT, offset: 0 };
    const fetchFn = vi.fn(async () => jsonResponse(body));

    await fetchAdvisories(
      fetchFn as unknown as typeof fetch,
      listQuery({
        filters: {
          ...emptyFilters(),
          q: "tls",
          severity: ["high", "critical"],
          tlp: ["WHITE"],
          scoreMin: 7,
          from: "2024-01-01"
        }
      })
    );

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("q=tls");
    expect(url).toContain("severity=high");
    expect(url).toContain("severity=critical");
    expect(url).toContain("tlp=WHITE");
    expect(url).toContain("score_min=7");
    expect(url).toContain("from=2024-01-01");
  });

  it("raises an ApiError carrying the API error message on non-2xx", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    await expect(
      fetchAdvisories(fetchFn as unknown as typeof fetch, listQuery())
    ).rejects.toMatchObject({ status: 500, message: "boom" });
  });
});

describe("fetchDocument", () => {
  it("returns the verbatim JSON", async () => {
    const doc = { document: { title: "x" } };
    const fetchFn = vi.fn(async () => jsonResponse(doc));
    const result = await fetchDocument(fetchFn as unknown as typeof fetch, 42);
    expect(result).toEqual(doc);
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toContain("/api/documents/42");
  });

  it("maps a 404 to an ApiError with status 404", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "document not found" }, 404));
    await expect(fetchDocument(fetchFn as unknown as typeof fetch, 1)).rejects.toBeInstanceOf(
      ApiError
    );
  });
});
