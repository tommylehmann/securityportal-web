// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Unit tests for the closed content-page registry (SA-52 / C-36 / SA-20 / C-10,
// plan task 49, ADR-0018).
//
// Security property: lookupSlug() is the sole guard between request input and
// the closed registry.  No slug containing traversal characters, absolute path
// markers, null bytes, percent signs, or dots may resolve to a registry entry —
// they must all return null.  Only the exact registered slugs may resolve.

import { describe, expect, it } from "vitest";
import { CONTENT_REGISTRY, lookupSlug } from "./registry";

// ---------------------------------------------------------------------------
// Registered slugs — happy path (SA-52: only registered slugs resolve)
// ---------------------------------------------------------------------------

describe("lookupSlug — registered slugs resolve", () => {
  it("resolves 'impressum' (kind:legal)", () => {
    const entry = lookupSlug("impressum");
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe("legal");
    expect(entry!.titleKey).toBe("legal.impressum.headTitle");
  });

  it("resolves 'datenschutz' (kind:legal)", () => {
    const entry = lookupSlug("datenschutz");
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe("legal");
    expect(entry!.titleKey).toBe("legal.datenschutz.headTitle");
  });

  it("resolves 'manual' (kind:repo)", () => {
    const entry = lookupSlug("manual");
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe("repo");
    expect(entry!.titleKey).toBe("content.manual.headTitle");
  });
});

// ---------------------------------------------------------------------------
// Unregistered slugs → null (SA-52)
// ---------------------------------------------------------------------------

describe("lookupSlug — unregistered slug returns null", () => {
  it("returns null for an empty string", () => {
    expect(lookupSlug("")).toBeNull();
  });

  it("returns null for an unknown word slug", () => {
    expect(lookupSlug("about")).toBeNull();
  });

  it("returns null for 'contact'", () => {
    expect(lookupSlug("contact")).toBeNull();
  });

  it("returns null for 'etc'", () => {
    expect(lookupSlug("etc")).toBeNull();
  });

  it("returns null for 'passwd'", () => {
    expect(lookupSlug("passwd")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Traversal / path-injection attempts → null (SA-52 / C-36 / SA-20)
//
// SvelteKit URL-decodes path params before handing them to the route handler,
// so %2e%2e arrives as '..'.  The dot-check is therefore the primary guard
// for that class.  Percent signs that somehow survive (double-encoded
// sequences) are caught by the percent-sign check.
// ---------------------------------------------------------------------------

describe("lookupSlug — traversal and injection attempts are rejected", () => {
  // Relative-path traversal (both . and .. variants).
  it("returns null for '..'", () => {
    expect(lookupSlug("..")).toBeNull();
  });

  it("returns null for '../etc/passwd'", () => {
    expect(lookupSlug("../etc/passwd")).toBeNull();
  });

  it("returns null for '../../etc/passwd'", () => {
    expect(lookupSlug("../../etc/passwd")).toBeNull();
  });

  it("returns null for '.' (single dot)", () => {
    expect(lookupSlug(".")).toBeNull();
  });

  it("returns null for '.hidden'", () => {
    expect(lookupSlug(".hidden")).toBeNull();
  });

  it("returns null for 'foo.bar' (embedded dot)", () => {
    expect(lookupSlug("foo.bar")).toBeNull();
  });

  // Slash-containing values (both forward and backward slash).
  it("returns null for 'etc/passwd' (forward slash)", () => {
    expect(lookupSlug("etc/passwd")).toBeNull();
  });

  it("returns null for a single forward slash '/'", () => {
    expect(lookupSlug("/")).toBeNull();
  });

  it("returns null for '/etc/passwd' (absolute path with forward slash)", () => {
    expect(lookupSlug("/etc/passwd")).toBeNull();
  });

  it("returns null for a backslash-containing slug (Windows traversal)", () => {
    expect(lookupSlug("..\\etc\\passwd")).toBeNull();
  });

  it("returns null for a backslash-only slug", () => {
    expect(lookupSlug("\\")).toBeNull();
  });

  // Percent-encoded sequences (partially decoded or double-encoded).
  it("returns null for '%2e%2e%2f' (double-encoded traversal, percent still present)", () => {
    // SvelteKit decodes %2e → . but a double-encoded %252e would arrive as %2e
    // (percent preserved) — both variants must be rejected.
    expect(lookupSlug("%2e%2e%2f")).toBeNull();
  });

  it("returns null for 'impressum%00' (null byte percent-encoded with surrounding percent)", () => {
    // If somehow the percent is present (not fully decoded), reject it.
    expect(lookupSlug("impressum%00")).toBeNull();
  });

  it("returns null for a value with a percent sign '%'", () => {
    expect(lookupSlug("im%pressum")).toBeNull();
  });

  // Null byte injection.
  it("returns null for a null-byte slug '\\x00'", () => {
    expect(lookupSlug("\0")).toBeNull();
  });

  it("returns null for a slug with a null byte embedded: 'impressum\\x00'", () => {
    expect(lookupSlug("impressum\0")).toBeNull();
  });

  it("returns null for a slug with a null byte before a registered name: '\\x00impressum'", () => {
    expect(lookupSlug("\0impressum")).toBeNull();
  });

  // Absolute paths.
  it("returns null for '/impressum' (absolute-style leading slash)", () => {
    expect(lookupSlug("/impressum")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CONTENT_REGISTRY shape (task 49 + 50 + 51 AC)
// ---------------------------------------------------------------------------

describe("CONTENT_REGISTRY — structural invariants", () => {
  it("contains exactly the three expected slugs", () => {
    const slugs = Object.keys(CONTENT_REGISTRY).sort();
    expect(slugs).toEqual(["datenschutz", "impressum", "manual"]);
  });

  it("each entry has a non-empty titleKey and a valid kind", () => {
    for (const [slug, entry] of Object.entries(CONTENT_REGISTRY)) {
      expect(entry.titleKey, `${slug}.titleKey`).toBeTruthy();
      expect(["legal", "repo"]).toContain(entry.kind);
    }
  });

  it("impressum and datenschutz are kind:legal (task 50)", () => {
    expect(CONTENT_REGISTRY["impressum"]!.kind).toBe("legal");
    expect(CONTENT_REGISTRY["datenschutz"]!.kind).toBe("legal");
  });

  it("manual is kind:repo (task 51)", () => {
    expect(CONTENT_REGISTRY["manual"]!.kind).toBe("repo");
  });
});
