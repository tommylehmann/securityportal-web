<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import { onDestroy } from "svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { convertToDocModel } from "$lib/CSAFWebview/docmodel/docmodel";
  import { appStore } from "$lib/CSAFWebview/store.svelte";
  import Webview from "$lib/CSAFWebview/Webview.svelte";
  import SeverityBadge from "$lib/components/SeverityBadge.svelte";
  import { formatDate } from "$lib/format";
  import { getI18n } from "$lib/i18n/context.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();
  const { t } = i18n;

  // The stable permalink for this advisory: the canonical `/advisories/{publisher}/{trackingId}`
  // URL (ADR-0016). The detail page's own URL *is* the permalink, so we read origin+pathname
  // off `page.url` (correct behind any host/base-path).
  const permalinkPath = $derived(page.url.pathname);
  const permalink = $derived(`${page.url.origin}${permalinkPath}`);

  // Copy-permalink affordance: copies the canonical URL and shows a brief
  // confirmation. Falls back silently when the clipboard API is unavailable; the
  // visible canonical link is always present as the non-JS path.
  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyPermalink() {
    try {
      await navigator.clipboard?.writeText(permalink);
      copied = true;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => (copied = false), 2000);
    } catch {
      // Clipboard denied/unavailable — the visible link below remains usable.
    }
  }

  // Feed the verbatim CSAF JSON through the vendored viewer's entry contract:
  // convertToDocModel(json) → appStore.setDocument → <Webview> (spec §10,
  // ADR-0003). Only runs when the advisory is live (not withdrawn).
  $effect(() => {
    if (!data.withdrawn) {
      const docModel = convertToDocModel(data.document);
      appStore.setDocument(docModel);
    }
  });

  // Clear the shared store when leaving so a stale document never flashes on the
  // next detail view before its effect runs.
  onDestroy(() => {
    appStore.reset();
    clearTimeout(copyResetTimer);
  });

  // meta is only available when data.withdrawn === false; reference it only in
  // the non-withdrawn branch of the template.
  const meta = $derived(!data.withdrawn ? data.metadata : null);
</script>

<svelte:head>
  <!--
    Use trackingId (the CSAF tracking_id) for the head title so the page title
    is stable and human-readable across re-seeds/re-imports (ADR-0016).
    C-21/SA-31: data.trackingId is the stored DB value — plain escaped {text},
    not {@html}.
  -->
  <title>{t("detail.headTitle", { trackingId: data.trackingId })}</title>
  <link rel="canonical" href={permalink} />
</svelte:head>

<section>
  <a
    href={resolve("/")}
    class="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
  >
    <i class="bx bx-chevron-left" aria-hidden="true"></i>
    {t("detail.back")}
  </a>

  {#if data.withdrawn}
    <!--
      Withdrawn notice (ADR-0013 §2, OQ-3).
      C-21/SA-31: data.trackingId and data.withdrawnAt are rendered as escaped
      {text} only — no {@html}, no innerHTML, no raw attribute interpolation.
    -->
    <div
      class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
      role="status"
      data-testid="withdrawn-notice"
    >
      <div class="flex items-start gap-3">
        <i
          class="bx bx-info-circle mt-0.5 text-xl text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        ></i>
        <div>
          <h1 class="text-base font-semibold text-amber-900 dark:text-amber-100">
            {t("detail.withdrawn.title")}
          </h1>
          <p class="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {t("detail.withdrawn.body")}
          </p>
          <p class="mt-3 font-mono text-sm text-amber-700 dark:text-amber-300">
            {data.trackingId}
          </p>
          {#if data.withdrawnAt}
            <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {t("detail.withdrawn.date", { date: formatDate(data.withdrawnAt, i18n.locale) })}
            </p>
          {/if}
        </div>
      </div>
    </div>
  {:else if meta}
    <!-- Detail header band: the advisory's key metadata above the rendered viewer
         (spec §13). Mirrors the list styling (same card/border/token set). The
         data-testid lets the e2e suite scope CVE/title assertions to the rendered
         document below the band, since both now show the same text. -->
    <header
      class="mt-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-900"
      data-testid="advisory-header"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={meta.severity} score={meta.score} />
            {#if meta.tlp}
              <span
                class="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 ring-inset dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600"
              >
                {t("detail.meta.tlp")}: {meta.tlp}
              </span>
            {/if}
          </div>
          <h1
            class="mt-2 text-xl font-bold break-words text-gray-900 sm:text-2xl dark:text-gray-100"
          >
            {meta.title ?? meta.trackingId ?? data.trackingId}
          </h1>
          {#if meta.trackingId}
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.trackingId}</p>
          {/if}
        </div>

        <!-- Permalink affordance: copy button plus the visible canonical link. -->
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            onclick={copyPermalink}
            aria-label={t("detail.permalink")}
          >
            <i class="bx bx-link" aria-hidden="true"></i>
            {copied ? t("detail.permalink.copied") : t("detail.permalink")}
          </button>
        </div>
      </div>

      <!-- Metadata grid: publisher, dates, category, version, CVE(s). -->
      <dl
        class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-800"
      >
        <div>
          <dt
            class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {t("detail.meta.publisher")}
          </dt>
          <dd class="mt-0.5 text-gray-900 dark:text-gray-100">{meta.publisher ?? "—"}</dd>
        </div>
        <div>
          <dt
            class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {t("detail.meta.released")}
          </dt>
          <dd class="mt-0.5 text-gray-900 dark:text-gray-100">
            {formatDate(meta.currentReleaseDate, i18n.locale)}
          </dd>
        </div>
        <div>
          <dt
            class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {t("detail.meta.initialRelease")}
          </dt>
          <dd class="mt-0.5 text-gray-900 dark:text-gray-100">
            {formatDate(meta.initialReleaseDate, i18n.locale)}
          </dd>
        </div>
        <div>
          <dt
            class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {t("detail.meta.category")}
          </dt>
          <dd class="mt-0.5 break-words text-gray-900 dark:text-gray-100">
            {meta.category ?? "—"}
          </dd>
        </div>
        <div>
          <dt
            class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {t("detail.meta.version")}
          </dt>
          <dd class="mt-0.5 text-gray-900 tabular-nums dark:text-gray-100">
            {meta.version ?? "—"}
          </dd>
        </div>
        <div>
          <dt
            class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {t("detail.meta.cves")}
          </dt>
          <dd class="mt-0.5 text-gray-900 dark:text-gray-100">
            {#if meta.cves.length > 0}
              <ul class="flex flex-wrap gap-x-3 gap-y-0.5">
                {#each meta.cves as cve (cve)}
                  <li class="whitespace-nowrap tabular-nums">{cve}</li>
                {/each}
              </ul>
            {:else}
              —
            {/if}
          </dd>
        </div>
      </dl>

      <!-- The canonical permalink, always visible (the non-JS fallback for copy). -->
      <p class="mt-4 truncate text-xs text-gray-500 dark:text-gray-400">
        <a href={permalinkPath} class="hover:underline">{permalink}</a>
      </p>
    </header>

    <div
      class="mt-4 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      data-testid="advisory-viewer"
    >
      <Webview position="" basePath="" widthOffset={0} />
    </div>
  {/if}
</section>
