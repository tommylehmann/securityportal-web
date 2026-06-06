<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";

  const status = $derived(page.status);
  const message = $derived(page.error?.message ?? "Something went wrong");
</script>

<svelte:head>
  <title>{status === 404 ? "Advisory not found" : "Error"} — SecurityPortal</title>
</svelte:head>

<section
  class="mt-6 rounded-md border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
>
  <i class="bx bx-error-circle text-4xl text-gray-400" aria-hidden="true"></i>
  <h1 class="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
    {#if status === 404}
      Advisory not found
    {:else}
      Unable to load advisory
    {/if}
  </h1>
  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
  <a
    href={resolve("/")}
    class="mt-4 inline-flex items-center gap-1 rounded bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
  >
    <i class="bx bx-chevron-left" aria-hidden="true"></i>
    Back to advisories
  </a>
</section>
