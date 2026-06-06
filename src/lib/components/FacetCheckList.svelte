<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import type { FacetGroup } from "$lib/api/types";

  interface Props {
    /** The counted values for this dimension (from /api/facets). */
    group: FacetGroup | undefined;
    /** Currently selected raw values for this dimension. */
    selected: string[];
    /**
     * Optional label mapping for a value (e.g. severity band -> "Critical"). The
     * raw value is shown when no mapping is supplied. The value passed to
     * `onToggle` is always the raw facet value, never the label.
     */
    labelOf?: (value: string) => string;
    /** Called with the full new selection when a checkbox is toggled. */
    onToggle: (next: string[]) => void;
  }

  let { group, selected, labelOf, onToggle }: Props = $props();

  const values = $derived(group?.values ?? []);

  function isSelected(value: string): boolean {
    return selected.includes(value);
  }

  // Surface a selected value even when the current (narrowed) facet response no
  // longer lists it, so a user can always un-check what they selected.
  const orphanSelected = $derived(
    selected.filter((value) => !values.some((entry) => entry.value === value))
  );

  function toggle(value: string, checked: boolean) {
    const next = checked
      ? [...selected.filter((entry) => entry !== value), value]
      : selected.filter((entry) => entry !== value);
    onToggle(next);
  }
</script>

{#if values.length === 0 && orphanSelected.length === 0}
  <p class="text-xs text-gray-500 dark:text-gray-400">No values.</p>
{:else}
  <ul class="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
    {#each values as entry (entry.value)}
      <li>
        <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            class="size-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
            checked={isSelected(entry.value)}
            onchange={(event) => toggle(entry.value, event.currentTarget.checked)}
          />
          <span
            class="min-w-0 flex-1 truncate"
            title={labelOf ? labelOf(entry.value) : entry.value}
          >
            {labelOf ? labelOf(entry.value) : entry.value}
          </span>
          <span class="tabular-nums text-xs text-gray-500 dark:text-gray-400">{entry.count}</span>
        </label>
      </li>
    {/each}
    {#each orphanSelected as value (value)}
      <li>
        <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            class="size-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
            checked={true}
            onchange={(event) => toggle(value, event.currentTarget.checked)}
          />
          <span class="min-w-0 flex-1 truncate" title={labelOf ? labelOf(value) : value}>
            {labelOf ? labelOf(value) : value}
          </span>
          <span class="tabular-nums text-xs text-gray-500 dark:text-gray-400">0</span>
        </label>
      </li>
    {/each}
  </ul>
  {#if group?.capped}
    <p class="mt-2 text-xs italic text-gray-500 dark:text-gray-400">
      Showing the most frequent values; refine the search to narrow this list.
    </p>
  {/if}
{/if}
