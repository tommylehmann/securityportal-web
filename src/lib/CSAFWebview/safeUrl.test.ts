// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { describe, expect, it } from "vitest";
import { isSafeUrl } from "./safeUrl";

describe("isSafeUrl", () => {
  it("permits http: URLs", () => {
    expect(isSafeUrl("http://example.com/path")).toBe(true);
  });

  it("permits https: URLs", () => {
    expect(isSafeUrl("https://www.bsi.bund.de/advisory")).toBe(true);
  });

  it("permits mailto: URLs", () => {
    expect(isSafeUrl("mailto:security@example.com")).toBe(true);
  });

  it("blocks javascript: URLs (primary XSS vector)", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("blocks javascript: URLs with mixed case", () => {
    expect(isSafeUrl("JavaScript:alert(document.domain)")).toBe(false);
  });

  it("blocks data: URLs", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("blocks vbscript: URLs", () => {
    expect(isSafeUrl("vbscript:MsgBox(1)")).toBe(false);
  });

  it("blocks relative paths", () => {
    expect(isSafeUrl("/relative/path")).toBe(false);
  });

  it("blocks bare strings without a scheme", () => {
    expect(isSafeUrl("example.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSafeUrl(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSafeUrl(null)).toBe(false);
  });

  it("returns false for a whitespace-only string", () => {
    expect(isSafeUrl("   ")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Bypass-class cases added for task-22 coverage (SA-8 hardening, ADR-0007).
  // These cover evasion techniques that a bypass attempt might try.
  // -------------------------------------------------------------------------

  it("permits https: URLs regardless of upper/mixed case scheme", () => {
    // The URL constructor downcases the scheme before we inspect .protocol,
    // so HTTPS: and Https: must be treated the same as https:.
    expect(isSafeUrl("HTTPS://www.example.com")).toBe(true);
    expect(isSafeUrl("HTTP://example.com")).toBe(true);
  });

  it("blocks protocol-relative URLs (//evil.com) — no scheme means reject", () => {
    // Protocol-relative URLs inherit the page's protocol in a browser, but
    // new URL("//evil.com") throws (no scheme) so isSafeUrl returns false.
    expect(isSafeUrl("//evil.com/xss")).toBe(false);
  });

  it("blocks javascript: with percent-encoded newline bypass (%0a)", () => {
    // A tab or newline character between the scheme letters is a known bypass
    // attempt. The URL constructor either rejects or normalises it; in practice
    // "java%09script:" is not a valid URL and throws, returning false.
    expect(isSafeUrl("java\tscript:alert(1)")).toBe(false);
    expect(isSafeUrl("java\nscript:alert(1)")).toBe(false);
  });

  it("blocks javascript: with embedded null byte", () => {
    // A null byte can be used to truncate scheme detection in naive parsers.
    // new URL rejects the string, so isSafeUrl returns false.
    expect(isSafeUrl("javascript\0:alert(1)")).toBe(false);
  });

  it("blocks data: URL with mixed-case DATA:", () => {
    // Case-insensitive scheme handling must apply to data: too, not only javascript:.
    expect(isSafeUrl("DATA:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("Data:text/plain,test")).toBe(false);
  });

  it("blocks VBSCRIPT: with uppercase scheme", () => {
    expect(isSafeUrl("VBSCRIPT:MsgBox(1)")).toBe(false);
  });

  it("blocks JAVASCRIPT: with all-caps scheme", () => {
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
  });
});
