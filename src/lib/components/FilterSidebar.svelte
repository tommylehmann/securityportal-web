<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import { untrack } from "svelte";
  import { emptyFilters, filtersAreEmpty } from "$lib/api/client";
  import type { Facets, Filters, Severity } from "$lib/api/types";
  import FacetSection from "$lib/components/FacetSection.svelte";
  import FacetCheckList from "$lib/components/FacetCheckList.svelte";
  import { getI18n } from "$lib/i18n/context.svelte";
  import { severityLabelKey } from "$lib/i18n/labels";

  const { t } = getI18n();

  interface Props {
    /** The active filter state (canonical; comes from the URL via the load). */
    filters: Filters;
    /** Facet counts for the current filter state, or null when the API failed. */
    facets: Facets | null;
    /** Emits a new, complete filter set; the page reflects it into the URL. */
    onChange: (next: Filters) => void;
  }

  let { filters, facets, onChange }: Props = $props();

  const scoreText = (value: number | null): string => (value === null ? "" : String(value));

  // Local draft state for the free-form controls (text, CVE, score, dates).
  // These do not re-navigate on every keystroke; they apply on submit (Enter or
  // the Apply button), so typing stays smooth. Checkbox facets apply
  // immediately. The draft is initialised once from the incoming filters and then
  // kept in sync via $effect so back/forward navigation and "clear all" reset the
  // inputs too.
  const initial = untrack(() => filters);
  let q = $state(initial.q);
  let cve = $state(initial.cve);
  let scoreMin = $state(scoreText(initial.scoreMin));
  let scoreMax = $state(scoreText(initial.scoreMax));
  let from = $state(initial.from);
  let to = $state(initial.to);

  $effect(() => {
    q = filters.q;
    cve = filters.cve;
    scoreMin = scoreText(filters.scoreMin);
    scoreMax = scoreText(filters.scoreMax);
    from = filters.from;
    to = filters.to;
  });

  function parseScore(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  // Applies the free-form draft alongside the (immediately-applied) facet
  // selections. Always emits a complete Filters object so the canonical mapping
  // stays the single source of truth.
  function applyDraft() {
    onChange({
      ...filters,
      q: q.trim(),
      cve: cve.trim(),
      scoreMin: parseScore(scoreMin),
      scoreMax: parseScore(scoreMax),
      from: from.trim(),
      to: to.trim()
    });
  }

  function clearAll() {
    onChange(emptyFilters());
  }

  const hasActiveFilters = $derived(!filtersAreEmpty(filters));
</script>

<div class="flex flex-col gap-1">
  <div class="flex items-center justify-between">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
      {t("filter.heading")}
    </h2>
    {#if hasActiveFilters}
      <button
        type="button"
        class="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400"
        onclick={clearAll}
      >
        {t("filter.clearAll")}
      </button>
    {/if}
  </div>

  {#if facets === null}
    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("filter.countsUnavailable")}</p>
  {/if}

  <!-- Free-text + CVE + score + date apply together on submit; Enter submits. -->
  <form
    onsubmit={(event) => {
      event.preventDefault();
      applyDraft();
    }}
  >
    <FacetSection title={t("filter.section.search")}>
      <div class="space-y-2">
        <label class="block">
          <span class="mb-1 block text-xs text-gray-600 dark:text-gray-400"
            >{t("filter.label.fullText")}</span
          >
          <input
            type="search"
            bind:value={q}
            placeholder={t("filter.placeholder.fullText")}
            class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-gray-600 dark:text-gray-400"
            >{t("filter.label.cve")}</span
          >
          <input
            type="text"
            bind:value={cve}
            placeholder={t("filter.placeholder.cve")}
            class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
      </div>
    </FacetSection>

    <FacetSection
      title={t("filter.section.cvssScore")}
      activeCount={(filters.scoreMin !== null ? 1 : 0) + (filters.scoreMax !== null ? 1 : 0)}
    >
      <div class="flex items-center gap-2">
        <label class="flex-1">
          <span class="mb-1 block text-xs text-gray-600 dark:text-gray-400"
            >{t("filter.label.scoreMin")}</span
          >
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            bind:value={scoreMin}
            class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
        <label class="flex-1">
          <span class="mb-1 block text-xs text-gray-600 dark:text-gray-400"
            >{t("filter.label.scoreMax")}</span
          >
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            bind:value={scoreMax}
            class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
      </div>
    </FacetSection>

    <FacetSection
      title={t("filter.section.releaseDate")}
      activeCount={(filters.from !== "" ? 1 : 0) + (filters.to !== "" ? 1 : 0)}
    >
      <div class="space-y-2">
        <label class="block">
          <span class="mb-1 block text-xs text-gray-600 dark:text-gray-400"
            >{t("filter.label.dateFrom")}</span
          >
          <input
            type="date"
            bind:value={from}
            class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-gray-600 dark:text-gray-400"
            >{t("filter.label.dateTo")}</span
          >
          <input
            type="date"
            bind:value={to}
            class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
      </div>
    </FacetSection>

    <div class="py-3">
      <button
        type="submit"
        class="w-full rounded bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800"
      >
        {t("filter.apply")}
      </button>
    </div>
  </form>

  <!-- Multi-select facets apply immediately on toggle. -->
  <FacetSection title={t("filter.section.severity")} activeCount={filters.severity.length}>
    <FacetCheckList
      group={facets?.severity}
      selected={filters.severity}
      labelOf={(value) => t(severityLabelKey(value as Severity))}
      onToggle={(next) => onChange({ ...filters, severity: next as Severity[] })}
    />
  </FacetSection>

  <FacetSection
    title={t("filter.section.publisher")}
    activeCount={filters.publisher !== "" ? 1 : 0}
  >
    <FacetCheckList
      group={facets?.publisher}
      selected={filters.publisher !== "" ? [filters.publisher] : []}
      onToggle={(next) => onChange({ ...filters, publisher: next[next.length - 1] ?? "" })}
    />
  </FacetSection>

  <FacetSection title={t("filter.section.vendor")} activeCount={filters.vendor !== "" ? 1 : 0}>
    <FacetCheckList
      group={facets?.vendor}
      selected={filters.vendor !== "" ? [filters.vendor] : []}
      onToggle={(next) => onChange({ ...filters, vendor: next[next.length - 1] ?? "" })}
    />
  </FacetSection>

  <FacetSection title={t("filter.section.product")} activeCount={filters.product !== "" ? 1 : 0}>
    <FacetCheckList
      group={facets?.product}
      selected={filters.product !== "" ? [filters.product] : []}
      onToggle={(next) => onChange({ ...filters, product: next[next.length - 1] ?? "" })}
    />
  </FacetSection>

  <FacetSection title={t("filter.section.category")} activeCount={filters.category !== "" ? 1 : 0}>
    <FacetCheckList
      group={facets?.category}
      selected={filters.category !== "" ? [filters.category] : []}
      onToggle={(next) => onChange({ ...filters, category: next[next.length - 1] ?? "" })}
    />
  </FacetSection>

  <FacetSection title={t("filter.section.tlp")} activeCount={filters.tlp.length}>
    <FacetCheckList
      group={facets?.tlp}
      selected={filters.tlp}
      onToggle={(next) => onChange({ ...filters, tlp: next })}
    />
  </FacetSection>

  <FacetSection title={t("filter.section.language")} activeCount={filters.lang !== "" ? 1 : 0}>
    <FacetCheckList
      group={facets?.lang}
      selected={filters.lang !== "" ? [filters.lang] : []}
      onToggle={(next) => onChange({ ...filters, lang: next[next.length - 1] ?? "" })}
    />
  </FacetSection>
</div>
