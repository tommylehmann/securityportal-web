<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { getI18n } from "$lib/i18n/context.svelte";

  const { t } = getI18n();

  const status = $derived(page.status);
  // Body copy is localized off the HTTP status, not off `page.error.message`:
  // the server throws a stable, non-user-facing tag for the detail (F2), so the
  // user always sees translated text. 404 → "not found" wording; anything else
  // → a generic "could not load" line.
  const message = $derived(status === 404 ? t("error.notFound.body") : t("error.generic.body"));
</script>

<svelte:head>
  <title>{status === 404 ? t("error.notFound.headTitle") : t("error.generic.headTitle")}</title>
</svelte:head>

<section
  class="mt-6 rounded-md border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
>
  <i class="bx bx-error-circle text-4xl text-gray-400" aria-hidden="true"></i>
  <h1 class="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
    {#if status === 404}
      {t("error.notFound.title")}
    {:else}
      {t("error.generic.title")}
    {/if}
  </h1>
  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
  <a
    href={resolve("/")}
    class="mt-4 inline-flex items-center gap-1 rounded bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
  >
    <i class="bx bx-chevron-left" aria-hidden="true"></i>
    {t("detail.back")}
  </a>
</section>
