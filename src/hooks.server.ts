// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { env } from "$env/dynamic/public";
import type { Handle } from "@sveltejs/kit";
import { LOCALE_COOKIE, resolveLocale } from "$lib/i18n";

// ---------------------------------------------------------------------------
// Dynamic connect-src extension for cross-origin API (decisions/0006-content-security-policy.md).
//
// PUBLIC_API_BASE_URL is a runtime env var that may be absent (same-origin
// deployments) or a full cross-origin URL (e.g. https://api.example.com).
// svelte.config.js bakes the build-time value into the CSP; this hook extends
// the header at request time so the runtime value always wins.
// ---------------------------------------------------------------------------
function apiOrigin(): string | null {
  const raw = (env.PUBLIC_API_BASE_URL ?? "").trim();
  if (!raw) return null;
  try {
    const origin = new URL(raw).origin;
    // Same-origin does not need an extra connect-src entry.
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

// Extend the connect-src directive in an existing CSP header value string.
// If the API origin is already present (or empty), the original string is returned.
function extendConnectSrc(csp: string, origin: string): string {
  const parts = csp.split(";").map((p) => p.trim());
  const idx = parts.findIndex((p) => p.toLowerCase().startsWith("connect-src"));
  if (idx === -1) {
    // No connect-src directive yet — append one.
    return `${csp}; connect-src 'self' ${origin}`;
  }
  // Split the directive on whitespace and compare whole tokens so that a short
  // origin (e.g. https://api.example.com) is not falsely "found" as a substring
  // of a longer already-listed token (e.g. https://api.example.com.evil.net).
  const tokens = parts[idx].split(/\s+/);
  if (tokens.includes(origin)) {
    return csp; // Already present.
  }
  parts[idx] = `${parts[idx]} ${origin}`;
  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Security headers (threats C-3 / ADR-0006).
//
// NOTE: HSTS is intentionally NOT set here. HTTP Strict-Transport-Security is
// the reverse proxy's responsibility (the app may also serve plain HTTP in
// dev/testing, and a premature HSTS header would lock the browser to HTTPS for
// the preload period). See threat model §1 ("Out of scope: reverse proxy / TLS
// terminator").
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
  // Prevent browsers from MIME-sniffing a response away from the declared
  // Content-Type, blocking content-sniffing XSS attacks.
  "X-Content-Type-Options": "nosniff",

  // Limit Referer information sent to cross-origin navigations: send full URL to
  // same-origin, only the origin (no path/query) to cross-origin.
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Legacy anti-clickjacking companion to the CSP frame-ancestors directive; keeps
  // browsers that predate frame-ancestors support from framing the page.
  "X-Frame-Options": "DENY",

  // Restrict access to browser features that are not needed by this portal.
  // camera/microphone/geolocation/payment/usb are denied; extend as needed.
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
};

export const handle: Handle = async ({ event, resolve }) => {
  // Resolve the active UI locale once per request, before any load runs: cookie
  // (the toggle's source of truth) → Accept-Language → default. Stashing it on
  // `event.locals` lets `+layout.server.ts` ship it (and the catalog) to the page,
  // so SSR renders the right language with no hydration flash. We also rewrite the
  // `<html lang>` placeholder in app.html so the document language is correct for
  // assistive tech and search engines from the first byte.
  const locale = resolveLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language")
  );
  event.locals.locale = locale;

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale)
  });

  // Apply security headers to every response (C-3 / ADR-0006).
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  // Extend the CSP's connect-src if the API is cross-origin at runtime.
  // svelte.config.js already included the build-time value; this handles
  // deployments where PUBLIC_API_BASE_URL differs between build and runtime
  // (e.g. Docker with a per-environment env-file).
  const runtimeOrigin = apiOrigin();
  if (runtimeOrigin) {
    const existing = response.headers.get("content-security-policy") ?? "";
    if (existing) {
      response.headers.set("content-security-policy", extendConnectSrc(existing, runtimeOrigin));
    }
  }

  return response;
};
