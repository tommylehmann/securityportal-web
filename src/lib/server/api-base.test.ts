// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Unit tests for the SSR API base resolver (task 33 / F1 regression guard).
//
// Covers the three-tier resolution chain:
//   1. SECURITYPORTAL_API_INTERNAL_URL set → that value is returned.
//   2. SECURITYPORTAL_API_INTERNAL_URL unset, PUBLIC_API_BASE_URL set → serverApiBase()
//      returns undefined so getJSON falls through to BROWSER_API_BASE (PUBLIC_API_BASE_URL).
//   3. Neither set → serverApiBase() returns undefined so getJSON falls through to
//      BROWSER_API_BASE (empty string → same-origin relative /api/...).
//
// The key invariant (F1): serverApiBase() must return undefined (not "") when
// SECURITYPORTAL_API_INTERNAL_URL is unset, so that an empty internal URL never
// shadows PUBLIC_API_BASE_URL in getJSON's `base !== undefined` guard.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// $env/dynamic/private is a SvelteKit virtual module; stub it so we can
// control the private env values in each test case.  vi.mock is hoisted to the
// top of the file by Vitest, so the factory must not reference any top-level
// variables declared in this module — use vi.hoisted() to initialise the
// shared env object before the factory runs.
const { mockPrivateEnv } = vi.hoisted(() => ({
  mockPrivateEnv: {} as Record<string, string>
}));
vi.mock("$env/dynamic/private", () => ({ env: mockPrivateEnv }));

// $env/dynamic/public is imported by client.ts (a transitive dep of this test
// via fetchAdvisories); stub it to the empty-object default too.
vi.mock("$env/dynamic/public", () => ({ env: {} }));

import { _resetApiBaseMemo, serverApiBase } from "./api-base";
import { fetchAdvisories, emptyFilters, DEFAULT_LIMIT } from "$lib/api/client";

// ---------------------------------------------------------------------------
// serverApiBase() — three-tier resolution
// ---------------------------------------------------------------------------

describe("serverApiBase", () => {
  beforeEach(() => {
    // Reset the memo between tests so each case starts fresh.
    _resetApiBaseMemo();
  });

  afterEach(() => {
    // Clean up the mocked env object after every case.
    delete mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL;
  });

  it("returns the internal URL when SECURITYPORTAL_API_INTERNAL_URL is set", () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "http://api:8081";
    expect(serverApiBase()).toBe("http://api:8081");
  });

  it("trims trailing slashes from the internal URL", () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "http://api:8081///";
    expect(serverApiBase()).toBe("http://api:8081");
  });

  it("trims leading/trailing whitespace from the internal URL", () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "  http://api:8081  ";
    expect(serverApiBase()).toBe("http://api:8081");
  });

  it("returns undefined when SECURITYPORTAL_API_INTERNAL_URL is unset", () => {
    // Env var absent — fall through to PUBLIC_API_BASE_URL / same-origin.
    expect(serverApiBase()).toBeUndefined();
  });

  it("returns undefined when SECURITYPORTAL_API_INTERNAL_URL is empty string", () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "";
    expect(serverApiBase()).toBeUndefined();
  });

  it("returns undefined when SECURITYPORTAL_API_INTERNAL_URL is whitespace-only", () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "   ";
    expect(serverApiBase()).toBeUndefined();
  });

  it("memoises the result across multiple calls within the same process", () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "http://api:8081";
    const first = serverApiBase();
    // Mutate env after first call to prove memo is used, not re-read.
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "http://changed:9999";
    expect(serverApiBase()).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// getJSON base precedence (via fetchAdvisories) — F1 regression guard
//
// Verifies the full chain: serverApiBase() result → opts.base → getJSON
// resolvedBase, covering both the SSR-internal case and the fall-through to
// PUBLIC_API_BASE_URL.  This is the test that would have caught F1.
// ---------------------------------------------------------------------------

describe("getJSON base precedence (F1 regression guard)", () => {
  const body = { advisories: [], total: 0, limit: DEFAULT_LIMIT, offset: 0 };
  const query = {
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort: "current_release_date" as const,
    direction: "desc" as const,
    filters: emptyFilters()
  };

  beforeEach(() => {
    _resetApiBaseMemo();
  });

  afterEach(() => {
    delete mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL;
  });

  it("tier 1: uses the internal URL as base when SECURITYPORTAL_API_INTERNAL_URL is set", async () => {
    mockPrivateEnv.SECURITYPORTAL_API_INTERNAL_URL = "http://api:8081";
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

    await fetchAdvisories(fetchFn as unknown as typeof fetch, query, {
      base: serverApiBase()
    });

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toMatch(/^http:\/\/api:8081\/api\/advisories/);
  });

  it("tier 2: falls through to PUBLIC_API_BASE_URL when internal URL is unset", async () => {
    // serverApiBase() returns undefined → getJSON uses BROWSER_API_BASE.
    // In this test BROWSER_API_BASE is "" (PUBLIC_API_BASE_URL not set in the
    // mocked $env/dynamic/public), so the URL is same-origin relative.
    // The test proves undefined is passed, not "" — that is the invariant.
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

    const base = serverApiBase(); // must be undefined
    expect(base).toBeUndefined();

    await fetchAdvisories(fetchFn as unknown as typeof fetch, query, { base });

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    // Same-origin relative: starts with /api/
    expect(url).toMatch(/^\/api\/advisories/);
  });

  it("tier 3: falls through to same-origin when neither env var is set", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

    await fetchAdvisories(fetchFn as unknown as typeof fetch, query);

    const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(url).toMatch(/^\/api\/advisories/);
  });
});
