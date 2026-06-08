// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Server-only runtime-config resolver (spec §16.2, task 27).
//
// Reads operator-supplied SECURITYPORTAL_* environment variables through
// $env/dynamic/private (server module — never imported into client bundles or
// browser code) and normalises them into a typed RuntimeBranding value.
//
// The result is memoized: environment variables are process-stable in
// adapter-node, so computing them once at first use is safe and avoids
// repeated env-lookup overhead per request.
//
// Security note (SA-22): every value that will reach a DOM/CSS sink is
// validated here.  Invalid color values are rejected and logged; they do NOT
// propagate toward the style attribute or inline <style> tag.

import { env } from "$env/dynamic/private";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated, normalised primary theme colors. */
export interface ThemeColors {
  /** Normalised R G B channel string (e.g. "7 89 133") for each primary step. */
  primary50: string;
  primary100: string;
  primary200: string;
  primary300: string;
  primary400: string;
  primary500: string;
  primary600: string;
  primary700: string;
  primary800: string;
  primary900: string;
  /** Optional accent channel string (single override, no full ramp). */
  accent?: string;
  /** Optional primary-foreground channel string. */
  primaryFg?: string;
}

/**
 * Operator-supplied runtime branding resolved from process environment.
 * All string fields are safe for use as text content (they are NOT passed
 * through HTML sinks; the layout uses {brandName} template interpolation).
 */
export interface RuntimeBranding {
  /** Override for the nav brand name. undefined = fall back to i18n key. */
  brandName?: string;
  /** Override for the nav subtitle. undefined = fall back to i18n key. */
  subtitle?: string;
  /**
   * Validated theme overrides.  undefined = no inline <style> emitted;
   * defaults remain in force from app.css.
   */
  theme?: ThemeColors;
  /**
   * True when SECURITYPORTAL_LOGO_PATH is set and non-empty; the layout
   * renders <img src="/branding/logo"> in place of the built-in glyph.
   * The path itself stays server-side.
   */
  logoConfigured: boolean;
  /**
   * Exposed so legal-page routes (tasks 31-32) can find the mounted dir.
   * Empty string when unset.
   */
  legalDir: string;
}

// ---------------------------------------------------------------------------
// Color validation (SA-22)
// ---------------------------------------------------------------------------

/** Matches #rrggbb (case-insensitive). */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** Matches three decimal channel values each 0-255, separated by whitespace. */
const CHANNEL_TRIPLE_RE = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*$/;

/**
 * Validates `raw` as either `#rrggbb` hex OR a space-separated `R G B`
 * channel triple (each 0-255) and returns the normalised `"R G B"` channel
 * string for use in `rgb(var(--sp-primary-NNN))`.
 *
 * Returns null for any other value (including CSS injection attempts such as
 * `red;}body{...` or `1 2 3;injected`).
 */
export function parseColor(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Reject anything containing characters that could break out of a CSS value
  // context before we even try to parse the recognised formats.
  if (/[;{}"'<>]/.test(trimmed)) return null;

  // --- #rrggbb hex ---
  const hexMatch = HEX_COLOR_RE.exec(trimmed);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16);
    const g = parseInt(hexMatch[2], 16);
    const b = parseInt(hexMatch[3], 16);
    return `${r} ${g} ${b}`;
  }

  // --- R G B channel triple ---
  const tripleMatch = CHANNEL_TRIPLE_RE.exec(trimmed);
  if (tripleMatch) {
    const r = parseInt(tripleMatch[1], 10);
    const g = parseInt(tripleMatch[2], 10);
    const b = parseInt(tripleMatch[3], 10);
    if (r > 255 || g > 255 || b > 255) return null;
    return `${r} ${g} ${b}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Default primary palette channel values
//
// Hex source (app.css @theme block):
//   50 → #f0f9ff   100 → #e0f2fe   200 → #bae6fd   300 → #7dd3fc
//   400 → #38bdf8  500 → #0ea5e9   600 → #0284c7   700 → #0369a1
//   800 → #075985  900 → #082f49
// ---------------------------------------------------------------------------
const DEFAULT_PRIMARY: Omit<ThemeColors, "accent" | "primaryFg"> = {
  primary50: "240 249 255",
  primary100: "224 242 254",
  primary200: "186 230 253",
  primary300: "125 211 252",
  primary400: "56 189 248",
  primary500: "14 165 233",
  primary600: "2 132 199",
  primary700: "3 105 161",
  primary800: "7 89 133",
  primary900: "8 47 73"
};

// ---------------------------------------------------------------------------
// Theme derivation from a single primary color
// ---------------------------------------------------------------------------

/**
 * Derives the full primary ramp from a single validated channel string.
 *
 * The approach: linearly interpolate between white (255 255 255) and the
 * supplied base color across the 50-500 lighter steps, and between the base
 * color and black (0 0 0) for the 600-900 darker steps.
 *
 * This produces a perceptually reasonable ramp without a full palette
 * generator.  The base color is treated as the "700" anchor, matching the
 * typical Tailwind convention where -700 is the darkest used tone for
 * interactive elements.
 */
function deriveRamp(baseChannel: string): Omit<ThemeColors, "accent" | "primaryFg"> {
  const parts = baseChannel.split(/\s+/).map(Number);
  const [br, bg, bb] = parts;

  function mix(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number,
    t: number
  ): string {
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `${r} ${g} ${b}`;
  }

  // White → base for the light end (50..500).  t=0 → white, t=1 → base.
  // 50: t=0.08, 100: t=0.15, 200: t=0.25, 300: t=0.40, 400: t=0.60, 500: t=0.80
  const wr = 255,
    wg = 255,
    wb = 255;
  // Base → black for the dark end (600..900).  t=0 → base, t=1 → black.
  // 600: t=0.15, 700: t=0.30 (≈ original anchor), 800: t=0.50, 900: t=0.70

  return {
    primary50: mix(wr, wg, wb, br, bg, bb, 0.08),
    primary100: mix(wr, wg, wb, br, bg, bb, 0.15),
    primary200: mix(wr, wg, wb, br, bg, bb, 0.25),
    primary300: mix(wr, wg, wb, br, bg, bb, 0.4),
    primary400: mix(wr, wg, wb, br, bg, bb, 0.6),
    primary500: mix(wr, wg, wb, br, bg, bb, 0.8),
    primary600: mix(br, bg, bb, 0, 0, 0, 0.15),
    primary700: mix(br, bg, bb, 0, 0, 0, 0.3),
    primary800: mix(br, bg, bb, 0, 0, 0, 0.5),
    primary900: mix(br, bg, bb, 0, 0, 0, 0.7)
  };
}

// ---------------------------------------------------------------------------
// Memoization
// ---------------------------------------------------------------------------

let _memo: RuntimeBranding | undefined;

/** Clears the memo.  Only used in tests — do not call from application code. */
export function _resetMemo(): void {
  _memo = undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves and memoizes the runtime branding config from process environment.
 * Safe to call on every SSR request; the work is done once per process.
 */
export function getRuntimeBranding(): RuntimeBranding {
  if (_memo) return _memo;

  const brandName = env.SECURITYPORTAL_BRAND_NAME?.trim() || undefined;
  const subtitle = env.SECURITYPORTAL_BRAND_SUBTITLE?.trim() || undefined;
  const logoPath = env.SECURITYPORTAL_LOGO_PATH?.trim() || "";
  const legalDir = env.SECURITYPORTAL_LEGAL_DIR?.trim() || "";

  // --- Theme ---
  // Operator can supply SECURITYPORTAL_THEME_PRIMARY as a single base color.
  // All other ramp steps are derived from it.  Individual per-step overrides
  // are not supported in v1 (spec §16.3).
  const rawPrimary = env.SECURITYPORTAL_THEME_PRIMARY;
  const rawPrimaryFg = env.SECURITYPORTAL_THEME_PRIMARY_FG;
  const rawAccent = env.SECURITYPORTAL_THEME_ACCENT;

  let theme: ThemeColors | undefined;

  if (rawPrimary) {
    const baseChannel = parseColor(rawPrimary);
    if (baseChannel) {
      const ramp = deriveRamp(baseChannel);
      const primaryFg = rawPrimaryFg ? (parseColor(rawPrimaryFg) ?? undefined) : undefined;
      const accent = rawAccent ? (parseColor(rawAccent) ?? undefined) : undefined;

      if (!primaryFg && rawPrimaryFg) {
        console.warn(
          "[securityportal] SECURITYPORTAL_THEME_PRIMARY_FG is set but failed validation — ignored."
        );
      }
      if (!accent && rawAccent) {
        console.warn(
          "[securityportal] SECURITYPORTAL_THEME_ACCENT is set but failed validation — ignored."
        );
      }

      theme = { ...ramp, primaryFg, accent };
    } else {
      console.warn(
        "[securityportal] SECURITYPORTAL_THEME_PRIMARY is set but failed color validation — " +
          "expected #rrggbb or 'R G B' channel triple.  Theme override ignored."
      );
    }
  }

  _memo = {
    brandName,
    subtitle,
    theme,
    logoConfigured: logoPath.length > 0,
    legalDir
  };

  return _memo;
}

// Re-export defaults so tests can assert against them.
export { DEFAULT_PRIMARY };
