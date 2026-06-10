// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Tests for the +page.server.ts load function of the advisory detail route
// (ADR-0016, plan tasks 55). Exercises:
//
//   - Live advisory: returns { withdrawn: false, trackingId, document, metadata }
//   - Withdrawn advisory (HTTP 410 from API): returns { withdrawn: true, trackingId, withdrawnAt }
//     without calling extractMetadata/convertToDocModel (SA-29/C-17)
//   - 404 from the API: surfaces as SvelteKit 404 via error(404, "Not Found")
//   - 502 mapping for other ApiErrors
//   - SA-31/C-21: params.publisher and params.trackingId are never echoed into error bodies;
//     error() is called with a static "Not Found" / "Bad Gateway" string only

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports that trigger SvelteKit
// virtual-module resolution.
// ---------------------------------------------------------------------------

// Stub the SvelteKit error() helper so we can assert it was called without
// actually throwing a SvelteKit redirect/error object in the test runner.
const { mockError } = vi.hoisted(() => ({
  mockError: vi.fn((status: number, message: string) => {
    throw new MockSvelteKitError(status, message);
  })
}));

class MockSvelteKitError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

vi.mock("@sveltejs/kit", () => ({
  error: mockError
}));

// Stub SvelteKit virtual/server modules so the test runner doesn't choke on
// private env imports.
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

// Stub $lib/server/api-base — we want to control what the load function uses
// as its SSR base (it calls serverApiBase() internally).
vi.mock("$lib/server/api-base", () => ({
  serverApiBase: () => undefined
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER the mocks are declared.
// ---------------------------------------------------------------------------

import { load } from "./+page.server";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

/** A minimal CSAF document that extractMetadata can parse. */
function makeDoc(trackingId: string) {
  return {
    document: {
      title: "Test advisory " + trackingId,
      category: "csaf_security_advisory",
      lang: "en",
      publisher: { name: "Test Publisher", namespace: "https://example.test" },
      distribution: { tlp: { label: "WHITE" } },
      tracking: {
        id: trackingId,
        version: "1.0.0",
        status: "final",
        current_release_date: "2026-03-01T00:00:00Z",
        initial_release_date: "2026-01-01T00:00:00Z",
        revision_history: [{ number: "1" }]
      }
    }
  };
}

/** A withdrawn envelope as returned by the API as HTTP 410 (ADR-0015/ADR-0016). */
function makeWithdrawnEnvelope(
  trackingId: string,
  withdrawnAt: string | null = "2026-05-10T08:00:00Z"
) {
  return {
    withdrawn: true as const,
    tracking_id: trackingId,
    withdrawn_at: withdrawnAt
  };
}

/** A fake fetch that returns the given body with the given HTTP status. */
function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" }
      })
  ) as unknown as typeof fetch;
}

/** Calls load() with the minimal SvelteKit LoadEvent shape. */
async function callLoad(fetchFn: typeof fetch, publisher: string, trackingId: string) {
  return load({
    fetch: fetchFn,
    params: { publisher, trackingId }
  } as Parameters<typeof load>[0]);
}

// ---------------------------------------------------------------------------
// Live advisory
// ---------------------------------------------------------------------------

describe("load — live advisory", () => {
  beforeEach(() => {
    mockError.mockClear();
  });

  it("returns withdrawn: false with the document and extracted metadata", async () => {
    const doc = makeDoc("PORTAL-2024-001");
    const result = await callLoad(mockFetch(doc), "Example Corp", "PORTAL-2024-001");

    expect(result.withdrawn).toBe(false);
    expect(result.trackingId).toBe("PORTAL-2024-001");
    if (result.withdrawn !== false) throw new Error("type narrowing");
    expect(result.document).toEqual(doc);
    // extractMetadata is called: verify at least the title was extracted.
    expect(result.metadata.title).toContain("PORTAL-2024-001");
  });

  it("passes trackingId from params (URL-decoded by SvelteKit router)", async () => {
    // SvelteKit decodes %3A → : before populating params.trackingId, so the
    // load function always receives the decoded value.
    const doc = makeDoc("RHSA-2024:5101");
    const result = await callLoad(mockFetch(doc), "Red Hat", "RHSA-2024:5101");

    expect(result.trackingId).toBe("RHSA-2024:5101");
  });

  it("accepts a publisher name with a space (URL-decoded by SvelteKit router)", async () => {
    const doc = makeDoc("ADV-2026-001");
    const result = await callLoad(mockFetch(doc), "Example Corp", "ADV-2026-001");

    expect(result.withdrawn).toBe(false);
    expect(result.trackingId).toBe("ADV-2026-001");
  });
});

// ---------------------------------------------------------------------------
// Withdrawn advisory — HTTP 410 (SA-29/C-17, ADR-0015/ADR-0016 §4)
// ---------------------------------------------------------------------------

describe("load — withdrawn advisory (HTTP 410)", () => {
  beforeEach(() => {
    mockError.mockClear();
  });

  it("returns withdrawn: true with trackingId and withdrawnAt, does NOT call extractMetadata", async () => {
    // API returns HTTP 410 + WithdrawnEnvelope; fetchAdvisory surfaces it as data.
    const envelope = makeWithdrawnEnvelope("PORTAL-2024-WD");
    const result = await callLoad(mockFetch(envelope, 410), "Acme", "PORTAL-2024-WD");

    expect(result.withdrawn).toBe(true);
    expect(result.trackingId).toBe("PORTAL-2024-WD");
    if (result.withdrawn !== true) throw new Error("type narrowing");
    expect(result.withdrawnAt).toBe("2026-05-10T08:00:00Z");
    // SA-29/C-17: no `document` or `metadata` keys on the withdrawn shape.
    expect("document" in result).toBe(false);
    expect("metadata" in result).toBe(false);
  });

  it("handles a null withdrawn_at (no timestamp recorded)", async () => {
    const envelope = makeWithdrawnEnvelope("PORTAL-WD-NULL-TS", null);
    const result = await callLoad(mockFetch(envelope, 410), "Acme", "PORTAL-WD-NULL-TS");

    expect(result.withdrawn).toBe(true);
    if (result.withdrawn !== true) throw new Error("type narrowing");
    expect(result.withdrawnAt).toBeNull();
  });

  it("uses the stored tracking_id from the envelope (DB value), not the raw route param", async () => {
    // The envelope's tracking_id is the authoritative stored value (SA-30/C-18).
    const envelope = makeWithdrawnEnvelope("PORTAL-STORED-ID");
    const result = await callLoad(mockFetch(envelope, 410), "Acme", "PORTAL-STORED-ID");

    expect(result.trackingId).toBe("PORTAL-STORED-ID");
    // The value comes from envelope.tracking_id, not params.trackingId.
  });
});

// ---------------------------------------------------------------------------
// Error mapping (SA-31/C-21)
// ---------------------------------------------------------------------------

describe("load — error mapping", () => {
  beforeEach(() => {
    mockError.mockClear();
  });

  it("maps a 404 ApiError to SvelteKit 404 with static 'Not Found' message", async () => {
    const fetchFn = mockFetch({ error: "document not found" }, 404);

    await expect(callLoad(fetchFn, "Acme", "NO-SUCH-ID")).rejects.toBeInstanceOf(
      MockSvelteKitError
    );
    expect(mockError).toHaveBeenCalledWith(404, "Not Found");
    // SA-31/C-21: the raw params ("NO-SUCH-ID", "Acme") must NOT be in the
    // error call — only a static string is passed.
    const call = mockError.mock.calls[0];
    expect(String(call[1])).not.toContain("NO-SUCH-ID");
    expect(String(call[1])).not.toContain("Acme");
  });

  it("maps a non-404/non-410 ApiError (e.g. 500) to SvelteKit 502", async () => {
    const fetchFn = mockFetch({ error: "internal error" }, 500);

    await expect(callLoad(fetchFn, "Acme", "SOME-ID")).rejects.toBeInstanceOf(MockSvelteKitError);
    expect(mockError).toHaveBeenCalledWith(502, "Bad Gateway");
    // SA-31/C-21: params must not appear in the error message.
    const call = mockError.mock.calls[0];
    expect(String(call[1])).not.toContain("SOME-ID");
    expect(String(call[1])).not.toContain("Acme");
  });

  it("maps a network failure (TypeError) to SvelteKit 502 via ApiError wrapping", async () => {
    // fetchAdvisory → inner fetch wraps network/DNS errors in ApiError(0, ...)
    // The load function's catch sees ApiError (not 404 / 410) → error(502, "Bad Gateway").
    const fetchFn = vi.fn(async () => {
      throw new TypeError("failed to fetch");
    }) as unknown as typeof fetch;

    await expect(callLoad(fetchFn, "Acme", "ID")).rejects.toBeInstanceOf(MockSvelteKitError);
    expect(mockError).toHaveBeenCalledWith(502, "Bad Gateway");
  });
});

// ---------------------------------------------------------------------------
// SA-31/C-21: XSS posture — no params echoed into DOM-reaching error paths
// ---------------------------------------------------------------------------

describe("load — SA-31: publisher/trackingId never echoed into error messages", () => {
  const xssPayload = "<img src=x onerror=alert(1)>";

  beforeEach(() => {
    mockError.mockClear();
  });

  it("does not echo an XSS payload from the tracking_id into a 404 error message", async () => {
    const fetchFn = mockFetch({ error: "document not found" }, 404);

    await expect(callLoad(fetchFn, "Acme", xssPayload)).rejects.toBeInstanceOf(MockSvelteKitError);
    expect(mockError).toHaveBeenCalledWith(404, "Not Found");
    // The XSS payload must NOT appear in the error() call.
    for (const call of mockError.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toContain(xssPayload);
        expect(String(arg)).not.toContain("onerror");
      }
    }
  });

  it("does not echo an XSS payload from the publisher into a 404 error message", async () => {
    const fetchFn = mockFetch({ error: "document not found" }, 404);

    await expect(callLoad(fetchFn, xssPayload, "SOME-ID")).rejects.toBeInstanceOf(
      MockSvelteKitError
    );
    expect(mockError).toHaveBeenCalledWith(404, "Not Found");
    for (const call of mockError.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toContain(xssPayload);
        expect(String(arg)).not.toContain("onerror");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Task 55: 2-segment URL round-trip — fetch goes to the correct API path
// ---------------------------------------------------------------------------

describe("load — task-55: 2-segment API URL encoding", () => {
  // Verify that the load function issues a fetch to the correct 2-segment
  // /api/advisories/{publisher}/{trackingId} path (not the retired flat
  // /api/advisories/{trackingId} form). The fetch spy lets us inspect the URL.

  it("fetches /api/advisories/{enc-pub}/{enc-trackingId} for publisher with space and id with colon", async () => {
    // Record the URL the load function uses by intercepting the fetch call.
    let capturedUrl = "";
    const spyFetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify(makeDoc("RHSA-2024:5101")), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as unknown as typeof fetch;

    await callLoad(spyFetch, "Example Corp", "RHSA-2024:5101");

    // The URL must contain two encoded segments after /api/advisories/.
    expect(capturedUrl).toContain("/api/advisories/");
    const afterBase = capturedUrl.split("/api/advisories/")[1] ?? "";
    const segments = afterBase.split("/");
    // Must be exactly two segments.
    expect(segments).toHaveLength(2);
    // Publisher "Example Corp" — space must be encoded.
    expect(segments[0]).toBe("Example%20Corp");
    // tracking_id "RHSA-2024:5101" — colon must be encoded.
    expect(segments[1]).toBe("RHSA-2024%3A5101");
    // The URL must NOT be the retired flat /api/advisories/{trackingId} form.
    expect(capturedUrl).not.toMatch(/\/api\/advisories\/RHSA-2024/);
  });

  it("does not use the retired flat /api/advisories/{trackingId} URL shape", async () => {
    let capturedUrl = "";
    const spyFetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify(makeDoc("PORTAL-2024-001")), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as unknown as typeof fetch;

    await callLoad(spyFetch, "Acme", "PORTAL-2024-001");

    // Must have at least two path segments after /api/advisories/.
    const afterBase = capturedUrl.split("/api/advisories/")[1] ?? "";
    const segments = afterBase.split("/").filter(Boolean);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    // Must NOT be a one-segment URL (which was the retired flat form).
    expect(segments.length).not.toBe(1);
  });
});
