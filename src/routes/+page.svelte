<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { listQueryToSearchParams } from "$lib/api/client";
  import type { Filters, ListQuery, SortColumn } from "$lib/api/types";
  import { severityOf } from "$lib/api/client";
  import { formatDate } from "$lib/format";
  import SeverityBadge from "$lib/components/SeverityBadge.svelte";
  import FilterSidebar from "$lib/components/FilterSidebar.svelte";
  import { getI18n } from "$lib/i18n/context.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();
  const { t } = i18n;

  const query = $derived(data.query);
  const list = $derived(data.list);
  const facets = $derived(data.facets);
  const advisories = $derived(list?.advisories ?? []);

  // Sidebar visibility on narrow screens. The sidebar is always shown on lg+
  // (left column); below that it is a toggleable drawer above the list.
  let sidebarOpen = $state(false);

  // The 1-based index range of the current page, for the "showing X–Y of N" line.
  const rangeStart = $derived(list && list.total > 0 ? query.offset + 1 : 0);
  const rangeEnd = $derived(list ? Math.min(query.offset + advisories.length, list.total) : 0);
  const hasPrev = $derived(query.offset > 0);
  const hasNext = $derived(list ? query.offset + query.limit < list.total : false);

  // Navigates to a new list query by rewriting the URL. `keepFocus`/`noScroll`
  // keep the interaction smooth; the load function re-runs and refreshes both the
  // list and the facet counts from the new filter state.
  function navigate(next: ListQuery) {
    const qs = listQueryToSearchParams(next).toString();
    goto(resolve(qs ? `/?${qs}` : "/"), {
      keepFocus: true,
      noScroll: true
    });
  }

  // Applies a new filter set: filters always reset to the first page so the user
  // never lands on an out-of-range page of a now-smaller result set. Sort and
  // page size are preserved.
  function applyFilters(filters: Filters) {
    navigate({ ...query, filters, offset: 0 });
  }

  // Toggles sort: clicking the active column flips direction; a new column starts
  // descending (newest / highest first). Sorting resets to the first page.
  function sortBy(column: SortColumn) {
    const direction = query.sort === column && query.direction === "desc" ? "asc" : "desc";
    navigate({ ...query, sort: column, direction, offset: 0 });
  }

  function goPrev() {
    navigate({ ...query, offset: Math.max(0, query.offset - query.limit) });
  }
  function goNext() {
    navigate({ ...query, offset: query.offset + query.limit });
  }

  function sortIndicator(column: SortColumn): string {
    if (query.sort !== column) return "";
    return query.direction === "desc" ? "↓" : "↑";
  }

  // Maps the active sort onto the `aria-sort` token a sortable column header
  // carries. The sortable headers give the `th` its own `aria-label` (the column
  // label) so the columnheader is identifiable by its localized text, while the
  // inner button keeps a distinct "sort by ..." `aria-label` for the action.
  function ariaSort(column: SortColumn): "ascending" | "descending" | "none" {
    if (query.sort !== column) return "none";
    return query.direction === "desc" ? "descending" : "ascending";
  }
</script>

<svelte:head>
  <title>{t("home.headTitle")}</title>
</svelte:head>

<div class="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6">
  <!-- Left filter sidebar (WID three-region layout). A drawer below lg, a sticky
       left column from lg up so the facets stay in view while the list scrolls. -->
  <aside
    class="lg:block lg:self-start lg:sticky lg:top-6 {sidebarOpen ? 'block' : 'hidden'}"
    aria-label={t("filter.heading")}
  >
    <div
      class="rounded-md border border-gray-200 bg-white p-4 shadow-sm lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto dark:border-gray-700 dark:bg-gray-800"
    >
      <FilterSidebar filters={query.filters} {facets} onChange={applyFilters} />
    </div>
  </aside>

  <section class="mt-4 lg:mt-0">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("home.title")}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t("home.subtitle")}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:hidden dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-expanded={sidebarOpen}
        onclick={() => (sidebarOpen = !sidebarOpen)}
      >
        <i class="bx bx-filter-alt" aria-hidden="true"></i>
        {t("home.filtersButton")}
      </button>
    </div>

    {#if list}
      <p class="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        {list.total === 1
          ? t("home.count.one", { count: list.total })
          : t("home.count.other", { count: list.total })}
      </p>
    {/if}

    {#if data.error}
      <!-- Error state: the API was unreachable or returned an error. The framing
           is localized; the upstream detail (data.error) is appended verbatim. -->
      <div
        class="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
        role="alert"
      >
        <p class="font-semibold">{t("home.error.title")}</p>
        <p class="mt-1">{t("home.error.intro")}</p>
        <p class="mt-1 font-mono text-xs opacity-80">{data.error}</p>
      </div>
    {:else if advisories.length === 0}
      <!-- Empty state: the API responded but there are no advisories to show. -->
      <div
        class="mt-6 rounded-md border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
      >
        <i class="bx bx-folder-open text-3xl" aria-hidden="true"></i>
        <p class="mt-2 text-sm font-medium">{t("home.empty")}</p>
        <p class="mt-1 text-xs">{t("home.empty.hint")}</p>
      </div>
    {:else}
      <div
        class="mt-4 overflow-x-auto rounded-md border border-gray-200 shadow-sm dark:border-gray-700"
      >
        <table
          class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"
          aria-label={t("list.tableLabel")}
        >
          <thead
            class="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <tr>
              <th
                scope="col"
                class="px-3 py-2"
                aria-sort={ariaSort("critical")}
                aria-label={t("list.column.severity")}
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-primary-700"
                  onclick={() => sortBy("critical")}
                  aria-label={t("list.sortBySeverity")}
                >
                  {t("list.column.severity")}
                  <span aria-hidden="true">{sortIndicator("critical")}</span>
                </button>
              </th>
              <th scope="col" class="px-3 py-2">{t("list.column.title")}</th>
              <th scope="col" class="px-3 py-2">{t("list.column.cves")}</th>
              <th scope="col" class="px-3 py-2">{t("list.column.publisher")}</th>
              <th
                scope="col"
                class="px-3 py-2"
                aria-sort={ariaSort("current_release_date")}
                aria-label={t("list.column.released")}
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-primary-700"
                  onclick={() => sortBy("current_release_date")}
                  aria-label={t("list.sortByReleased")}
                >
                  {t("list.column.released")}
                  <span aria-hidden="true">{sortIndicator("current_release_date")}</span>
                </button>
              </th>
              <th scope="col" class="px-3 py-2">{t("list.column.tlp")}</th>
              <th scope="col" class="px-3 py-2">{t("list.column.category")}</th>
              <th scope="col" class="px-3 py-2">{t("list.column.lang")}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {#each advisories as advisory (advisory.tracking_id)}
              <tr
                class="odd:bg-white even:bg-gray-50/60 hover:bg-primary-50/60 dark:odd:bg-gray-900 dark:even:bg-gray-800/40 dark:hover:bg-gray-800"
              >
                <td class="px-3 py-2 align-top whitespace-nowrap">
                  <SeverityBadge severity={severityOf(advisory)} score={advisory.critical} />
                </td>
                <td class="px-3 py-2 align-top">
                  <!--
                    Link to the canonical 2-segment permalink (ADR-0016).
                    advisory.publisher_name may be null for malformed advisory
                    data; in that case we render the title as plain text rather
                    than emitting a `/advisories//{trackingId}` URL that cannot
                    resolve (C-21/SA-31).
                  -->
                  {#if advisory.publisher_name !== null}
                    <a
                      href={resolve("/advisories/[publisher]/[trackingId]", {
                        publisher: advisory.publisher_name,
                        trackingId: advisory.tracking_id
                      })}
                      class="font-medium text-primary-700 hover:underline dark:text-primary-400"
                    >
                      {advisory.title ?? advisory.tracking_id}
                    </a>
                  {:else}
                    <span class="font-medium text-gray-900 dark:text-gray-100">
                      {advisory.title ?? advisory.tracking_id}
                    </span>
                  {/if}
                  <div class="text-xs text-gray-500 dark:text-gray-400">{advisory.tracking_id}</div>
                </td>
                <td class="px-3 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                  {#if advisory.cves.length > 0}
                    <ul class="space-y-0.5">
                      {#each advisory.cves as cve (cve)}
                        <li class="whitespace-nowrap tabular-nums">{cve}</li>
                      {/each}
                    </ul>
                  {:else}
                    —
                  {/if}
                </td>
                <td class="px-3 py-2 align-top text-gray-700 dark:text-gray-300">
                  {advisory.publisher_name ?? "—"}
                </td>
                <td class="px-3 py-2 align-top whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {formatDate(advisory.current_release_date, i18n.locale)}
                </td>
                <td class="px-3 py-2 align-top whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {advisory.tlp ?? "—"}
                </td>
                <td class="px-3 py-2 align-top text-gray-700 dark:text-gray-300">
                  {advisory.category ?? "—"}
                </td>
                <td class="px-3 py-2 align-top whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {advisory.lang ?? "—"}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination footer. -->
      <div class="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {t("pagination.showing", {
            start: rangeStart,
            end: rangeEnd,
            total: list?.total ?? 0
          })}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
            onclick={goPrev}
            disabled={!hasPrev}
          >
            {t("pagination.previous")}
          </button>
          <button
            type="button"
            class="rounded border border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
            onclick={goNext}
            disabled={!hasNext}
          >
            {t("pagination.next")}
          </button>
        </div>
      </div>
    {/if}
  </section>
</div>
