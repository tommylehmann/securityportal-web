// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

import { describe, expect, it } from "vitest";
import en from "./en.json";
import de from "./de.json";
import { asLocale, createTranslator, interpolate, resolveLocale } from "./index";

describe("message catalogs", () => {
  it("de.json and en.json have identical key sets", () => {
    const enKeys = Object.keys(en).sort();
    const deKeys = Object.keys(de).sort();

    const missingInDe = enKeys.filter((key) => !(key in de));
    const extraInDe = deKeys.filter((key) => !(key in en));

    expect(missingInDe, "keys present in en.json but missing from de.json").toEqual([]);
    expect(extraInDe, "keys present in de.json but missing from en.json").toEqual([]);
    expect(deKeys).toEqual(enKeys);
  });

  it("has no blank translations in either catalog", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.json[${key}] is blank`).not.toBe("");
    }
    for (const [key, value] of Object.entries(de)) {
      expect(value.trim(), `de.json[${key}] is blank`).not.toBe("");
    }
  });

  it("keeps the same {placeholder} tokens across locales", () => {
    const tokensOf = (value: string): string[] =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tokensOf(de[key]), `placeholder mismatch for ${key}`).toEqual(tokensOf(en[key]));
    }
  });
});

describe("interpolate", () => {
  it("returns the template unchanged when no params are given", () => {
    expect(interpolate("Showing {start}–{end}")).toBe("Showing {start}–{end}");
  });

  it("substitutes named placeholders, coercing numbers", () => {
    expect(interpolate("Showing {start}–{end} of {total}", { start: 1, end: 20, total: 42 })).toBe(
      "Showing 1–20 of 42"
    );
  });

  it("leaves unknown placeholders intact", () => {
    expect(interpolate("Advisory {id}", { other: 5 })).toBe("Advisory {id}");
  });
});

describe("createTranslator", () => {
  const t = createTranslator(en);

  it("translates a known key", () => {
    expect(t("pagination.previous")).toBe("Previous");
  });

  it("interpolates params", () => {
    expect(t("detail.headTitle", { id: 7 })).toBe("Advisory 7 — SecurityPortal");
  });

  it("returns the key itself for a missing translation", () => {
    // Cast through unknown: a runtime-missing key is exactly what we guard.
    const missing = "does.not.exist" as unknown as keyof typeof en;
    expect(t(missing)).toBe("does.not.exist");
  });
});

describe("asLocale", () => {
  it("accepts supported locales", () => {
    expect(asLocale("de")).toBe("de");
    expect(asLocale("en")).toBe("en");
  });

  it("rejects anything else", () => {
    expect(asLocale("fr")).toBeNull();
    expect(asLocale("")).toBeNull();
    expect(asLocale(null)).toBeNull();
    expect(asLocale(undefined)).toBeNull();
  });
});

describe("resolveLocale", () => {
  it("prefers the cookie over Accept-Language", () => {
    expect(resolveLocale("de", "en-US,en;q=0.9")).toBe("de");
    expect(resolveLocale("en", "de-DE")).toBe("en");
  });

  it("ignores an unsupported cookie and falls back to Accept-Language", () => {
    expect(resolveLocale("fr", "de-DE,de;q=0.9")).toBe("de");
  });

  it("maps de* tags to de and en* to en", () => {
    expect(resolveLocale(null, "de-AT,de;q=0.8")).toBe("de");
    expect(resolveLocale(null, "en-GB,en;q=0.8")).toBe("en");
  });

  it("honours declared order when both are present", () => {
    expect(resolveLocale(null, "de;q=0.5,en;q=0.9")).toBe("de");
  });

  it("defaults to en with no cookie and no usable header", () => {
    expect(resolveLocale(null, null)).toBe("en");
    expect(resolveLocale(null, "fr-FR,fr;q=0.9")).toBe("en");
  });
});
