// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 SecurityPortal contributors

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
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
