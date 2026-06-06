// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import type { APIRequestContext } from "@playwright/test";

// The mock API runs on this fixed localhost port (see playwright.config.ts). The
// app's server-side `load` fetches it via PUBLIC_API_BASE_URL; these helpers let a
// test flip the mock's scenario or inspect what query the app actually sent.
const MOCK_API = "http://127.0.0.1:8099";

export type Scenario = "ok" | "empty" | "error" | "facets" | "capped";

/** Sets the mock's response scenario for subsequent /api/advisories calls. */
export async function setScenario(request: APIRequestContext, scenario: Scenario): Promise<void> {
  const res = await request.post(`${MOCK_API}/__mock/scenario`, { data: { scenario } });
  if (!res.ok()) {
    throw new Error(`failed to set mock scenario "${scenario}": ${res.status()}`);
  }
}

/** Returns the query string of the last /api/advisories request the app made. */
export async function lastListQuery(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${MOCK_API}/__mock/last-list-query`);
  const body = (await res.json()) as { query: string };
  return body.query;
}

/** Returns the query string of the last /api/facets request the app made. */
export async function lastFacetsQuery(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${MOCK_API}/__mock/last-facets-query`);
  const body = (await res.json()) as { query: string };
  return body.query;
}
