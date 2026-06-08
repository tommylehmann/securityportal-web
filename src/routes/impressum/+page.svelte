<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<!--
 OPERATOR ACTION REQUIRED (when no Markdown file is mounted): this Impressum
 shows a PLACEHOLDER when SECURITYPORTAL_LEGAL_DIR is not set or the file
 impressum.{locale}.md is missing. Mount the Markdown files and set the env var
 to serve real legal content. (OQ-4 default — spec §16.4)
-->

<script lang="ts">
  import { getI18n } from "$lib/i18n/context.svelte";
  import type { PageData } from "./$types";

  const { t } = getI18n();

  const { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{t("legal.impressum.headTitle")}</title>
</svelte:head>

<article class="mx-auto max-w-3xl">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("legal.impressum.title")}</h1>

  {#if data.source === "file"}
    <!--
      {@html} carve-out — ADR-0010 / SA-6 / R-7:
      This is the ONE permitted {@html} sink in the application.
      `data.html` is operator-authored Markdown rendered server-side via
      renderLegalMarkdown() (markdown-it html:false + sanitize-html allow-list
      + scheme allow-list on anchors).  CSAF-derived data must NEVER use {@html}
      (SA-6 still applies to all CSAF content).
    -->
    <div class="legal-content mt-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- ADR-0010 SA-6 carve-out: operator Markdown, server-sanitized (renderLegalMarkdown). NOT for CSAF data. -->
      {@html data.html}
    </div>
  {:else}
    <!-- Fallback: SECURITYPORTAL_LEGAL_DIR unset or file missing — render i18n placeholder. -->

    <!-- Clearly-marked placeholder banner so an accidental launch with stub copy
         is obvious to a reader and a reviewer. -->
    <p
      class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      role="note"
    >
      {t("legal.placeholderNotice")}
    </p>

    <div class="mt-6 space-y-6 text-sm text-gray-700 dark:text-gray-300">
      <section>
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t("legal.impressum.tmgHeading")}
        </h2>
        <p class="mt-1 whitespace-pre-line">{t("legal.impressum.operator")}</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t("legal.impressum.contactHeading")}
        </h2>
        <p class="mt-1 whitespace-pre-line">{t("legal.impressum.contact")}</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t("legal.impressum.responsibleHeading")}
        </h2>
        <p class="mt-1 whitespace-pre-line">{t("legal.impressum.responsible")}</p>
      </section>

      <section>
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t("legal.impressum.disclaimerHeading")}
        </h2>
        <p class="mt-1 whitespace-pre-line">{t("legal.impressum.disclaimer")}</p>
      </section>
    </div>
  {/if}
</article>
