// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { defineConfig, devices } from "@playwright/test";

// Ports the e2e harness uses on localhost. The app (adapter-node `node build`)
// is pointed at the mock API via PUBLIC_API_BASE_URL, so its *server-side* `load`
// fetches hit the mock — the only way to intercept the SvelteKit server fetch
// (`page.route` only covers browser-side requests). Both are managed by Playwright.
const APP_PORT = 4173;
const MOCK_API_PORT = 8099;

export default defineConfig({
  testDir: "tests/e2e",
  // Server-global mock scenario state means tests that flip a scenario must not
  // overlap with others on the same app server; run serially for determinism.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      // Deterministic API mock; serves the canned list + the DE/EN CSAF fixtures.
      command: `node tests/mock-api/server.mjs`,
      url: `http://127.0.0.1:${MOCK_API_PORT}/api/health`,
      env: { MOCK_API_PORT: String(MOCK_API_PORT) },
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "pipe"
    },
    {
      // The real production build (adapter-node), so `load` runs server-side just
      // like in deployment. PUBLIC_API_BASE_URL points it at the mock.
      command: `npm run build && node build/index.js`,
      url: `http://127.0.0.1:${APP_PORT}`,
      timeout: 180_000,
      env: {
        PUBLIC_API_BASE_URL: `http://127.0.0.1:${MOCK_API_PORT}`,
        HOST: "127.0.0.1",
        PORT: String(APP_PORT)
      },
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "pipe"
    }
  ]
});
