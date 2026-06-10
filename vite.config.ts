// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";

// Resolve the app version baked into the bundle as `__APP_VERSION__` (shown in
// the footer). Precedence:
//   1. PUBLIC_APP_VERSION — set by the release workflow / Dockerfile (the
//      git-derived SemVer); authoritative for published builds.
//   2. `git describe` — for local builds in a checkout (e.g. v1.2.3-4-gabc123).
//   3. package.json version — last resort (e.g. a tarball with no .git).
function resolveAppVersion(): string {
  const fromEnv = process.env.PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync("git describe --tags --always --dirty", {
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
  } catch {
    // not a git checkout (e.g. inside a container build) — fall through
  }
  try {
    const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
    return `v${pkg.version}`;
  } catch {
    return "v0.0.0-dev";
  }
}

export default defineConfig({
  // Baked-in build-time constant; declared for TypeScript in src/app.d.ts.
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion())
  },
  server: {
    proxy: {
      // Forward API calls to the securityportal-api service during development.
      "/api/": {
        target: "http://localhost:8081/",
        changeOrigin: true
      }
    }
  },
  plugins: [sveltekit(), tailwindcss()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json", "html"],
      exclude: ["**/build/**", "**/.svelte-kit/**", "**/*.config.*"]
    }
  },
  optimizeDeps: {
    include: ["svelte"]
  }
});
