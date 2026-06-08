// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Mounted logo route (spec §16.2, task 30).
//
// Serves the operator-supplied logo image from the path configured via
// SECURITYPORTAL_LOGO_PATH.  Returns 404 when the env var is unset, the
// file is unreadable, or the content type is not on the allow-list.
//
// Security notes:
//  - SA-20 (no path traversal): the path comes verbatim from
//    SECURITYPORTAL_LOGO_PATH in process environment — it is NEVER joined
//    with any request input (no URL params, no headers).  The only input
//    to this handler is "GET /branding/logo"; file identity is fixed at
//    process start.
//  - SA-25 (img-src unchanged): the logo is served from the same origin
//    (/branding/logo), so CSP img-src 'self' data: covers it without
//    any new origin entry.
//  - Content type is validated against an allow-list before serving;
//    X-Content-Type-Options: nosniff is set to prevent MIME sniffing.

import { env } from "$env/dynamic/private";
import { readFile } from "node:fs/promises";
import type { RequestHandler } from "./$types";

// ---------------------------------------------------------------------------
// Content-type allow-list (SA-20: no executable content served here)
// ---------------------------------------------------------------------------

/** Maps lowercase file extensions to permitted content types. */
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp"
};

/**
 * Resolves the content type for the given file path by checking its
 * lowercase extension against the allow-list.  Returns null for
 * unsupported types (jpg, gif, ico, …) — those are served as 404, not
 * with a mismatched or guessed type.
 */
function allowedContentType(filePath: string): string | null {
  const lc = filePath.toLowerCase();
  for (const [ext, mime] of Object.entries(EXTENSION_TO_CONTENT_TYPE)) {
    if (lc.endsWith(ext)) return mime;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET: RequestHandler = async () => {
  // Read SECURITYPORTAL_LOGO_PATH from environment.  This value is set by
  // the operator and is fixed for the lifetime of the process; it is never
  // derived from any part of the request (SA-20).
  const logoPath = env.SECURITYPORTAL_LOGO_PATH?.trim() ?? "";
  if (!logoPath) {
    return new Response(null, { status: 404 });
  }

  // Validate the content type from the extension before reading the file.
  // Reject unsupported types early (no I/O for disallowed formats).
  const contentType = allowedContentType(logoPath);
  if (!contentType) {
    return new Response(null, { status: 404 });
  }

  // Read the file from the fixed, operator-supplied path.  Any I/O error
  // (file missing, permissions, …) results in a 404 — no error details are
  // leaked to the client (SA-14 analog).
  let data: Buffer;
  try {
    data = await readFile(logoPath);
  } catch {
    return new Response(null, { status: 404 });
  }

  // Stream the file with security headers.
  // Convert the Node.js Buffer to a Uint8Array so the Web Streams Response
  // constructor accepts it (BodyInit does not include Buffer directly).
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Prevent the browser from MIME-sniffing away from the declared type.
      "X-Content-Type-Options": "nosniff",
      // Serve inline (not as a download attachment).
      "Content-Disposition": "inline",
      // Cache for a reasonable period; the operator can restart the process
      // to invalidate.  max-age=3600 avoids hammering the filesystem on
      // every page load while still allowing logo changes within an hour.
      "Cache-Control": "public, max-age=3600, immutable"
    }
  });
};
