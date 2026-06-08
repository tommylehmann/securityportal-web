// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Derive the API origin for connect-src at build/start time.  PUBLIC_API_BASE_URL
// is a runtime env var for adapter-node, so this is read from process.env when
// vite build runs (or when the dev server starts).  If it is absent or same-origin
// (empty string / relative) we do not add a second connect-src entry.
function apiConnectOrigin() {
  const raw = (process.env.PUBLIC_API_BASE_URL ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const extraConnectSrc = apiConnectOrigin();
const connectSrc = ["'self'", ...(extraConnectSrc ? [extraConnectSrc] : [])];

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: [vitePreprocess({ script: true })],

  kit: {
    adapter: adapter(),
    alias: {
      $routes: "./src/routes"
    },

    // Restrictive Content Security Policy (decisions/0006-content-security-policy.md).
    // mode:'hash' means SvelteKit automatically hashes its own inline <script> tags
    // and includes those hashes in the script-src directive — no 'unsafe-inline'
    // needed.  Tailwind/Flowbite emit inline styles so style-src keeps 'unsafe-inline'
    // as a documented concession (revisit if Tailwind ever supports nonced styles).
    // HSTS is the reverse-proxy's responsibility and is NOT set here (threat model §1).
    csp: {
      mode: "hash",
      directives: {
        "default-src": ["'self'"],
        // 'unsafe-inline' is intentionally absent; hashes are injected by SvelteKit.
        "script-src": ["'self'"],
        // Tailwind 4 / Flowbite emit inline style attributes — 'unsafe-inline' is a
        // known concession documented in ADR-0006; tighten to hashes later if feasible.
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        // boxicons fonts are bundled locally (no CDN), so 'self' is sufficient.
        "font-src": ["'self'"],
        // connect-src permits the API origin when it is cross-origin.  Same-origin
        // deployments need only 'self'.  The value is resolved from PUBLIC_API_BASE_URL
        // at build/start time (see apiConnectOrigin above).
        "connect-src": connectSrc,
        // Forbid <frame>/<iframe> embedding from any origin (anti-clickjacking).
        "frame-ancestors": ["'none'"],
        // No plugins (Flash, PDF in <object>, etc.).
        "object-src": ["'none'"],
        // Prevent a base tag from redirecting relative URLs to an attacker origin.
        "base-uri": ["'self'"],
        // Confine where forms may submit.
        "form-action": ["'self'"]
      }
    }
  }
};

export default config;
