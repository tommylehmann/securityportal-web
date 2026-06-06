<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import { onDestroy } from "svelte";
  import { resolve } from "$app/paths";
  import { convertToDocModel } from "$lib/CSAFWebview/docmodel/docmodel";
  import { appStore } from "$lib/CSAFWebview/store.svelte";
  import Webview from "$lib/CSAFWebview/Webview.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Feed the verbatim CSAF JSON through the vendored viewer's entry contract:
  // convertToDocModel(json) → appStore.setDocument → <Webview> (spec §10,
  // ADR-0003). Done in an effect so it re-runs when navigating between detail
  // pages (same component instance, new `data`). The Webview reads window size
  // and uses Flowbite Tabs, so it is mounted client-side only.
  $effect(() => {
    const docModel = convertToDocModel(data.document);
    appStore.setDocument(docModel);
  });

  // Clear the shared store when leaving so a stale document never flashes on the
  // next detail view before its effect runs.
  onDestroy(() => {
    appStore.reset();
  });
</script>

<svelte:head>
  <title>Advisory {data.id} — SecurityPortal</title>
</svelte:head>

<section>
  <a
    href={resolve("/")}
    class="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
  >
    <i class="bx bx-chevron-left" aria-hidden="true"></i>
    Back to advisories
  </a>

  <div
    class="mt-4 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
  >
    <Webview position="" basePath="" widthOffset={0} />
  </div>
</section>
