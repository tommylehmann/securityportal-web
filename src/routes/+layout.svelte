<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import "../app.css";
  // Boxicons glyph font, used by the vendored CSAFWebview components (chevrons,
  // product-status icons, ...) via `bx bx-*` classes — the same icon set the
  // upstream csaf_webview uses. Importing the stylesheet makes those glyphs
  // render; without it the classes are inert. (Runtime dep: boxicons.)
  import "boxicons/css/boxicons.min.css";
  import { untrack } from "svelte";
  import { resolve } from "$app/paths";
  import { LOCALES, type Locale, type MessageKey } from "$lib/i18n";
  import { setI18n } from "$lib/i18n/context.svelte";
  import { setLocale } from "$lib/i18n/client";
  import type { ThemeColors } from "$lib/server/runtime-config";
  import type { LayoutData } from "./$types";

  // Static map keeps the translation keys literal (and therefore type-checked)
  // even though we iterate over LOCALES to render the toggle.
  const localeKey: Record<Locale, MessageKey> = {
    en: "nav.locale.en",
    de: "nav.locale.de"
  };

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

  // Provide the reactive i18n context from the server-resolved locale + catalog.
  // Done once at the root so every descendant can call `getI18n().t(...)`. The
  // handle is reactive: rather than re-providing a fresh context, we push the new
  // locale into the same handle below whenever `data` changes (after the toggle
  // invalidates the loads), so every `t(...)` consumer — including child route
  // components — re-renders in place. `setI18n` runs during init so the context
  // exists before children mount (and stays request-scoped on the server). The
  // initial value seeds the SSR render (effects do not run on the server); the
  // effect below keeps it current on the client, so we read `data` untracked here.
  const i18n = untrack(() => setI18n(data.locale, data.messages));

  // Keep the handle in sync with the load data. On the server this runs once with
  // the SSR-resolved locale; on the client it re-runs after the toggle's
  // `invalidateAll()` swaps `data`, switching the whole chrome without a reload.
  $effect(() => {
    i18n.update(data.locale, data.messages);
  });

  // Re-apply `<html lang>` on a client-side locale change. SSR sets it via the
  // `transformPageChunk` placeholder for the first paint; that placeholder is not
  // touched again on an in-place toggle or client navigation, so we mirror the
  // active locale onto the document element here for assistive tech.
  $effect(() => {
    document.documentElement.lang = i18n.locale;
  });

  const t = $derived(i18n.t);

  // Brand name and subtitle: operator override wins; i18n fallback ensures the
  // portal has sensible defaults when no env is set.
  const brandName = $derived(data.branding.brandName ?? t("nav.brand"));
  const brandSubtitle = $derived(data.branding.subtitle ?? t("nav.subtitle"));

  // Build inline CSS custom property overrides for the runtime theme (ADR-0009).
  //
  // We set the --sp-primary-* channel variables on the root <div> rather than
  // injecting a <style> block, because vitePreprocess treats <svelte:head>
  // content as CSS and rejects non-CSS syntax.  Setting the vars directly on
  // the element's style attribute scopes them to the subtree (which is the
  // full page) and keeps the same cascade effect as a :root override.
  //
  // Safety (SA-22):
  //   All channel values come from runtime-config.ts parseColor(), which
  //   accepts ONLY #rrggbb hex or "R G B" decimal triples and normalises to
  //   "R G B" form.  Decimal-only strings cannot break out of a CSS property
  //   value context.  The CHANNEL_TRIPLE_RE and HEX_COLOR_RE patterns reject
  //   any value containing semicolons, braces, quotes, or angle brackets, so
  //   CSS injection through this path is not possible.
  //
  // The operator-supplied values are validated before they ever reach this
  // derivation; if validation fails, branding.theme is undefined and no style
  // attribute is emitted (defaults from app.css remain in force).
  function buildThemeVars(theme: ThemeColors | undefined): string {
    if (!theme) return "";
    const parts = [
      `--sp-primary-50:${theme.primary50}`,
      `--sp-primary-100:${theme.primary100}`,
      `--sp-primary-200:${theme.primary200}`,
      `--sp-primary-300:${theme.primary300}`,
      `--sp-primary-400:${theme.primary400}`,
      `--sp-primary-500:${theme.primary500}`,
      `--sp-primary-600:${theme.primary600}`,
      `--sp-primary-700:${theme.primary700}`,
      `--sp-primary-800:${theme.primary800}`,
      `--sp-primary-900:${theme.primary900}`
    ];
    if (theme.accent) parts.push(`--sp-accent:${theme.accent}`);
    if (theme.primaryFg) parts.push(`--sp-primary-fg:${theme.primaryFg}`);
    return parts.join(";");
  }

  const themeVars = $derived(buildThemeVars(data.branding.theme));

  const home = resolve("/");
  const impressum = resolve("/impressum");
  const datenschutz = resolve("/datenschutz");

  // Year for the footer copyright line. Computed once at module init; a public
  // read-only portal does not need it to roll over mid-session.
  const year = new Date().getUTCFullYear();
</script>

<!--
  Runtime theme override applied as inline CSS custom properties on the root
  element (ADR-0009, SA-22).  The style attribute is populated only when the
  operator has configured SECURITYPORTAL_THEME_PRIMARY; otherwise the
  attribute is absent and app.css channel defaults are in force.
  All values are validated decimal channel strings — safe as CSS property
  values (no injection vector).
-->
<div
  class="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
  style={themeVars || undefined}
>
  <header class="border-b border-primary-900/40 bg-primary-800 text-white shadow-sm">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
      <a
        href={home}
        class="flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {#if data.branding.logoConfigured}
          <!-- Operator-mounted logo served from same-origin /branding/logo.
               CSP img-src 'self' data: is unchanged (SA-25).  SVG is
               served via <img> which neutralises inline scripts. -->
          <img src="/branding/logo" alt={brandName} class="h-8 w-auto" />
        {:else}
          <i class="bx bx-shield-quarter text-3xl text-primary-200" aria-hidden="true"></i>
        {/if}
        <span class="flex flex-col leading-tight">
          <span class="text-lg font-semibold tracking-tight">{brandName}</span>
          <span class="hidden text-xs font-normal text-primary-200 sm:block">
            {brandSubtitle}
          </span>
        </span>
      </a>
      <div class="flex items-center gap-4">
        <nav aria-label={t("nav.primaryLabel")}>
          <a
            href={home}
            class="rounded px-3 py-1.5 text-sm font-medium hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t("nav.advisories")}
          </a>
        </nav>
        <!-- Locale toggle. Setting the cookie + invalidateAll() keeps the server
             (SSR) and client in agreement; localStorage alone would not. -->
        <div
          class="flex items-center gap-1 rounded border border-primary-600 p-0.5"
          role="group"
          aria-label={t("nav.localeLabel")}
        >
          {#each LOCALES as locale (locale)}
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white {data.locale ===
              locale
                ? 'bg-white text-primary-800'
                : 'text-primary-100 hover:bg-primary-700'}"
              aria-pressed={data.locale === locale}
              onclick={() => setLocale(locale)}
            >
              {t(localeKey[locale])}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </header>

  <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
    {@render children?.()}
  </main>

  <footer
    class="border-t border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"
  >
    <div
      class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{t("footer.tagline")}</p>
      <nav class="flex items-center gap-4" aria-label={t("footer.legalLabel")}>
        <a
          href={impressum}
          class="hover:text-primary-700 hover:underline dark:hover:text-primary-400"
        >
          {t("footer.impressum")}
        </a>
        <a
          href={datenschutz}
          class="hover:text-primary-700 hover:underline dark:hover:text-primary-400"
        >
          {t("footer.datenschutz")}
        </a>
        <span class="text-gray-400 dark:text-gray-500">{t("footer.copyright", { year })}</span>
      </nav>
    </div>
  </footer>
</div>
