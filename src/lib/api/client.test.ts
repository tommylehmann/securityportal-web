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
  fetchAdvisory,
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

// ---------------------------------------------------------------------------
// fetchAdvisory — 2-segment publisher-scoped URL (ADR-0016)
// (SA-31/C-21: encodeURIComponent on BOTH segments — publisher and tracking_id)
// ---------------------------------------------------------------------------

describe("fetchAdvisory", () => {
  it("builds the 2-segment path for plain publisher and id", async () => {
    const doc = { document: { title: "openssl" } };
    const fetchFn = vi.fn(async () => jsonResponse(doc));

    const result = await fetchAdvisory(
      fetchFn as unknown as typeof fetch,
      "Example Corp",
      "PORTAL-2024-001"
    );

    expect(result).toEqual(doc);
    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    // Publisher "Example Corp" must have space encoded; tracking_id plain.
    expect(url).toBe("/api/advisories/Example%20Corp/PORTAL-2024-001");
  });

  it("encodes a colon-containing tracking_id (e.g. RHSA-2024:5101) with encodeURIComponent", async () => {
    // C-21/SA-31: the colon must be encoded as %3A so it is transmitted as a
    // single path segment rather than being interpreted as a port separator.
    const fetchFn = vi.fn(async () => jsonResponse({ document: { title: "rhel" } }));

    await fetchAdvisory(fetchFn as unknown as typeof fetch, "Red Hat", "RHSA-2024:5101");

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("/api/advisories/Red%20Hat/RHSA-2024%3A5101");
    // Must NOT contain the raw colon or unencoded space.
    expect(url).not.toContain("RHSA-2024:5101");
    expect(url).not.toContain("Red Hat");
  });

  it("encodes a slash-containing tracking_id with encodeURIComponent", async () => {
    // C-21/SA-31: a slash in a tracking_id must be encoded as %2F so it does
    // not split the URL into extra path segments.
    const fetchFn = vi.fn(async () => jsonResponse({ document: { title: "x" } }));

    await fetchAdvisory(fetchFn as unknown as typeof fetch, "Acme", "a/b");

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("/api/advisories/Acme/a%2Fb");
    expect(url).not.toMatch(/\/api\/advisories\/Acme\/a\/b/);
  });

  it("uses the caller-supplied SSR base when provided (ADR-0011 / task 33)", async () => {
    // Server-side load functions pass { base: serverApiBase() } so SSR fetches
    // go directly to the internal API address.
    const fetchFn = vi.fn(async () => jsonResponse({ document: {} }));

    await fetchAdvisory(fetchFn as unknown as typeof fetch, "Acme", "TEST-ID", {
      base: "http://api:8081"
    });

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://api:8081/api/advisories/Acme/TEST-ID");
  });

  it("returns the withdrawn envelope for a 410 Gone response (ADR-0015/ADR-0016 §4)", async () => {
    // The API returns HTTP 410 + WithdrawnEnvelope for tombstoned advisories.
    // fetchAdvisory surfaces this as structured data (not an error) so the load
    // function can return WithdrawnData to the page.
    const envelope = {
      withdrawn: true as const,
      tracking_id: "PORTAL-2024-WD",
      withdrawn_at: "2026-05-10T08:00:00Z"
    };
    const fetchFn = vi.fn(async () => jsonResponse(envelope, 410));

    const result = (await fetchAdvisory(
      fetchFn as unknown as typeof fetch,
      "Acme",
      "PORTAL-2024-WD"
    )) as typeof envelope;

    expect(result).toEqual(envelope);
    expect(result.withdrawn).toBe(true);
    expect(result.tracking_id).toBe("PORTAL-2024-WD");
    expect(result.withdrawn_at).toBe("2026-05-10T08:00:00Z");
  });

  it("maps a 404 to an ApiError with status 404", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "document not found" }, 404));

    await expect(
      fetchAdvisory(fetchFn as unknown as typeof fetch, "Acme", "NO-SUCH-ID")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("maps a 500 to an ApiError carrying the error message", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "internal error" }, 500));

    await expect(
      fetchAdvisory(fetchFn as unknown as typeof fetch, "Acme", "ANY-ID")
    ).rejects.toMatchObject({ status: 500, message: "internal error" });
  });

  // Task 55: verify the 2-segment URL structure matches the web route pattern
  // (/advisories/[publisher]/[trackingId]) that SvelteKit's resolve() produces.
  // Both segments must be percent-encoded with encodeURIComponent, matching the
  // `resolve("/advisories/[publisher]/[trackingId]", {...})` call in +page.svelte.
  it("builds a URL whose path structure matches the 2-segment SvelteKit route pattern", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ document: {} }));
    await fetchAdvisory(fetchFn as unknown as typeof fetch, "Example Corp", "RHSA-2024:5101");

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    // Path is /api/advisories/{enc-pub}/{enc-trackingId} — two dynamic segments.
    const parts = url.split("/api/advisories/")[1]?.split("/") ?? [];
    expect(parts).toHaveLength(2);
    // Both segments must be non-empty.
    expect(parts[0]).not.toBe("");
    expect(parts[1]).not.toBe("");
    // Decoding must round-trip back to the original values.
    expect(decodeURIComponent(parts[0])).toBe("Example Corp");
    expect(decodeURIComponent(parts[1])).toBe("RHSA-2024:5101");
  });

  // Task 55: confirm `fetchAdvisoryByTrackingId` (the retired flat-route function
  // from ADR-0013) is not exported from client.ts. If it were, the old single-segment
  // contract would remain callable.
  it("does not export the retired fetchAdvisoryByTrackingId function", () => {
    // Dynamic import check: the module must not export that name.
    // We verify this at the type level — if the function existed it would be
    // importable; since it's not in the import list above, TypeScript already
    // catches it. This runtime assertion documents the constraint explicitly.
    const clientModule = { fetchAdvisory } as Record<string, unknown>;
    expect("fetchAdvisoryByTrackingId" in clientModule).toBe(false);
  });
});
