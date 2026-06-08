// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Unit tests for the runtime-config color validator (SA-22).
// Covers: valid hex, valid channel triple, rejected garbage, and CSS
// injection attempts that must not reach the style sink.

import { describe, expect, it } from "vitest";
import { parseColor } from "./runtime-config";

describe("parseColor", () => {
  // ---------------------------------------------------------------------------
  // Valid hex colors
  // ---------------------------------------------------------------------------

  it("parses lowercase hex", () => {
    expect(parseColor("#075985")).toBe("7 89 133");
  });

  it("parses uppercase hex", () => {
    expect(parseColor("#075985".toUpperCase())).toBe("7 89 133");
  });

  it("parses mixed-case hex", () => {
    expect(parseColor("#B91C1C")).toBe("185 28 28");
  });

  it("parses pure black", () => {
    expect(parseColor("#000000")).toBe("0 0 0");
  });

  it("parses pure white", () => {
    expect(parseColor("#ffffff")).toBe("255 255 255");
  });

  it("parses a mid-range hex (primary-800)", () => {
    expect(parseColor("#075985")).toBe("7 89 133");
  });

  it("parses another mid-range hex (primary-500)", () => {
    expect(parseColor("#0ea5e9")).toBe("14 165 233");
  });

  it("trims leading/trailing whitespace before hex", () => {
    expect(parseColor("  #b91c1c  ")).toBe("185 28 28");
  });

  // ---------------------------------------------------------------------------
  // Valid R G B channel triples
  // ---------------------------------------------------------------------------

  it("parses a channel triple", () => {
    expect(parseColor("7 89 133")).toBe("7 89 133");
  });

  it("parses a channel triple with extra internal whitespace", () => {
    expect(parseColor("7  89  133")).toBe("7 89 133");
  });

  it("parses leading/trailing whitespace in channel triple", () => {
    expect(parseColor("  185 28 28  ")).toBe("185 28 28");
  });

  it("parses zero channels", () => {
    expect(parseColor("0 0 0")).toBe("0 0 0");
  });

  it("parses max channels (255 255 255)", () => {
    expect(parseColor("255 255 255")).toBe("255 255 255");
  });

  it("parses single-digit channels", () => {
    expect(parseColor("1 2 3")).toBe("1 2 3");
  });

  // ---------------------------------------------------------------------------
  // Rejected values
  // ---------------------------------------------------------------------------

  it("rejects undefined", () => {
    expect(parseColor(undefined)).toBeNull();
  });

  it("rejects null", () => {
    expect(parseColor(null)).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseColor("")).toBeNull();
  });

  it("rejects whitespace-only string", () => {
    expect(parseColor("   ")).toBeNull();
  });

  it("rejects named CSS color 'red'", () => {
    expect(parseColor("red")).toBeNull();
  });

  it("rejects 3-digit hex shorthand (#abc)", () => {
    // The hex pattern requires exactly 6 hex digits; 3-char is not accepted.
    expect(parseColor("#abc")).toBeNull();
  });

  it("rejects 8-digit hex (with alpha)", () => {
    expect(parseColor("#075985ff")).toBeNull();
  });

  it("rejects rgb() function notation", () => {
    expect(parseColor("rgb(7, 89, 133)")).toBeNull();
  });

  it("rejects oklch() notation", () => {
    expect(parseColor("oklch(40% 0.1 220)")).toBeNull();
  });

  it("rejects channel value > 255", () => {
    expect(parseColor("256 0 0")).toBeNull();
    expect(parseColor("0 256 0")).toBeNull();
    expect(parseColor("0 0 256")).toBeNull();
  });

  it("rejects a 4-token channel value", () => {
    expect(parseColor("1 2 3 4")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // CSS injection / breakout attempts (SA-22)
  // ---------------------------------------------------------------------------

  it("rejects a semicolon-terminated injection: 'red;}body{'", () => {
    expect(parseColor("red;}body{")).toBeNull();
  });

  it("rejects a valid-looking triple with semicolon suffix: '1 2 3;x'", () => {
    // CHANNEL_TRIPLE_RE anchors the match so trailing ;x fails.
    expect(parseColor("1 2 3;x")).toBeNull();
  });

  it("rejects a CSS rule injection attempt via semicolon in hex position", () => {
    expect(parseColor("#ff0000; background: red")).toBeNull();
  });

  it("rejects a value containing braces", () => {
    expect(parseColor("1 2 3}body{color:red")).toBeNull();
  });

  it("rejects a value containing a double-quote", () => {
    expect(parseColor('255 0 0"')).toBeNull();
  });

  it("rejects a value containing a single-quote", () => {
    expect(parseColor("255 0 0'")).toBeNull();
  });

  it("rejects a value containing angle brackets (HTML injection attempt)", () => {
    expect(parseColor("<script>alert(1)</script>")).toBeNull();
  });

  it("rejects a value containing a closing brace after valid channels", () => {
    expect(parseColor("7 89 133}")).toBeNull();
  });

  it("rejects CSS var() reference", () => {
    expect(parseColor("var(--evil)")).toBeNull();
  });

  it("rejects a calc() expression", () => {
    expect(parseColor("calc(1 + 2)")).toBeNull();
  });
});
