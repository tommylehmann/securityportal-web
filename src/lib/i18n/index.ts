// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Lightweight, dependency-free i18n for the portal chrome (spec §11). Only the
// UI labels are localized; CSAF document content renders in its own language.
//
// The locale is resolved on the server (cookie → Accept-Language → default) so
// SSR emits the right language and there is no hydration flash; see
// `hooks.server.ts` and `+layout.server.ts`. The resolved catalog is shipped to
// the client through layout data, and components read it via a Svelte context
// (see `context.ts`).

import en from "./en.json";
import de from "./de.json";

/** Supported UI locales. `en` is the default/fallback. */
export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Name of the cookie that carries the chosen locale (SSR source of truth). */
export const LOCALE_COOKIE = "locale";

/** A message catalog: every translation key maps to a string. */
export type Messages = typeof en;
/** Every valid translation key (derived from the English catalog). */
export type MessageKey = keyof Messages;

/** Interpolation parameters: `{placeholder}` tokens replaced by these values. */
export type TranslationParams = Record<string, string | number>;

const catalogs: Record<Locale, Messages> = { en, de };

/** Narrows an arbitrary string to a supported `Locale`, or null if unsupported. */
export function asLocale(value: string | null | undefined): Locale | null {
  return value != null && (LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
}

/** Returns the message catalog for a locale (falls back to the default). */
export function catalogFor(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}

/**
 * Resolves the active locale, in priority order: an explicit `cookieValue`
 * (the source of truth, set by the toggle), then the request `Accept-Language`
 * header (any `de*` tag → `de`, otherwise `en`), then the default. Used by the
 * server during SSR so the first paint is already in the right language.
 */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined
): Locale {
  const fromCookie = asLocale(cookieValue);
  if (fromCookie) return fromCookie;

  // Accept-Language is a comma-separated, q-weighted list. We do not need full
  // q-sorting for two locales: the first DE/EN tag in declared order wins, which
  // matches browser ordering closely enough for chrome selection.
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
      if (tag.startsWith("de")) return "de";
      if (tag.startsWith("en")) return "en";
    }
  }

  return DEFAULT_LOCALE;
}

/** Substitutes `{name}` tokens in a template with the given params. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

/** A bound translation function: `t(key, params?)` → localized string. */
export type Translate = (key: MessageKey, params?: TranslationParams) => string;

/**
 * Builds a translator over a catalog. A missing key returns the key itself —
 * which makes a forgotten string visible in the UI and easy to assert in tests
 * — rather than throwing or rendering blank.
 */
export function createTranslator(messages: Messages): Translate {
  return (key, params) => {
    const template = messages[key];
    return template === undefined ? key : interpolate(template, params);
  };
}
