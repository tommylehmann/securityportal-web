// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// Ports the e2e harness uses on localhost. The app (adapter-node `node build`)
// is pointed at the mock API via PUBLIC_API_BASE_URL, so its *server-side* `load`
// fetches hit the mock — the only way to intercept the SvelteKit server fetch
// (`page.route` only covers browser-side requests). Both are managed by Playwright.
const APP_PORT = 4173;
const MOCK_API_PORT = 8099;

// Second app server used exclusively by the branding/legal e2e project.
// It shares the same build artifact as the main app server (no rebuild needed —
// `reuseExistingServer: true` for the second instance, and the build command
// on the first server runs once) but is started with SECURITYPORTAL_* env vars
// that drive branding, theme, logo, and legal-page behaviour.
const BRANDING_APP_PORT = 4174;

// Absolute paths to test fixtures.  The logo and legal dir are passed as env
// vars to the branding app server so `$env/dynamic/private` picks them up at
// runtime — exactly as an operator would set them in production.
const FIXTURES_DIR = resolve(import.meta.dirname, "tests/fixtures");
const LEGAL_FIXTURES_DIR = resolve(FIXTURES_DIR, "legal");
const LOGO_FIXTURE_PATH = resolve(FIXTURES_DIR, "logo.png");

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
      // Default project: no branding overrides.  Runs all specs that do not opt in
      // to the branding project (list, detail, filters, i18n, legal fallback, security).
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/branding.spec.ts", "**/legal-branded.spec.ts"]
    },
    {
      // Branding project: app server is started with SECURITYPORTAL_* env vars so
      // server-side `load` (which reads $env/dynamic/private) sees the overrides.
      // Specs in this project navigate to BRANDING_APP_PORT via baseURL override.
      name: "branding",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${BRANDING_APP_PORT}`
      },
      testMatch: ["**/branding.spec.ts", "**/legal-branded.spec.ts"]
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
    },
    {
      // Branding app server: same build artifact, different env.  The build is
      // already produced by the webServer above; `reuseExistingServer: true` here
      // means Playwright will not rebuild (the build dir is shared).  We only
      // start a second `node build/index.js` process on a different port with
      // SECURITYPORTAL_* overrides in effect.
      command: `node build/index.js`,
      url: `http://127.0.0.1:${BRANDING_APP_PORT}`,
      timeout: 60_000,
      env: {
        PUBLIC_API_BASE_URL: `http://127.0.0.1:${MOCK_API_PORT}`,
        HOST: "127.0.0.1",
        PORT: String(BRANDING_APP_PORT),
        SECURITYPORTAL_BRAND_NAME: "ACME PSIRT",
        SECURITYPORTAL_BRAND_SUBTITLE: "Security advisories from ACME",
        SECURITYPORTAL_THEME_PRIMARY: "#b91c1c",
        SECURITYPORTAL_LOGO_PATH: LOGO_FIXTURE_PATH,
        SECURITYPORTAL_LEGAL_DIR: LEGAL_FIXTURES_DIR
      },
      // Always reuse the existing build; the first webServer produced it.
      reuseExistingServer: true,
      stdout: "ignore",
      stderr: "pipe"
    }
  ]
});
