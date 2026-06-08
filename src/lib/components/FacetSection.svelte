<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Section heading (already-localized text supplied by the caller). */
    title: string;
    /** Whether the section starts expanded. */
    open?: boolean;
    /** A small badge (e.g. count of active selections) shown next to the title. */
    activeCount?: number;
    children: Snippet;
  }

  let { title, open = true, activeCount = 0, children }: Props = $props();
</script>

<!-- A collapsible facet group. Native <details> gives keyboard/AX behaviour for
     free and degrades without JS, matching the no-frills government-portal feel. -->
<details class="group border-b border-gray-200 py-3 dark:border-gray-700" {open}>
  <summary
    class="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-200"
  >
    <span class="flex items-center gap-2">
      {title}
      {#if activeCount > 0}
        <span
          class="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900 dark:text-primary-200"
        >
          {activeCount}
        </span>
      {/if}
    </span>
    <i
      class="bx bx-chevron-down text-lg text-gray-500 transition-transform group-open:rotate-180"
      aria-hidden="true"
    ></i>
  </summary>
  <div class="mt-3">
    {@render children()}
  </div>
</details>
