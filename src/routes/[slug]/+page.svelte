<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<!--
 Generic content page (ADR-0018, tasks 49-51).

 Renders operator-mounted legal pages (kind:'legal') and bundled repo pages
 (kind:'repo') from the closed content registry.

 {@html} carve-out — ADR-0010 / SA-6 / ADR-0018:
   This is the ONE permitted {@html} sink in the application.
   data.html is Markdown rendered server-side via renderLegalMarkdown()
   (markdown-it html:false + sanitize-html allow-list + scheme allow-list).
   This covers BOTH legal (operator-authored) and repo (bundled) content —
   the same single sanitizer pipeline (ADR-0018 §2, SA-19).
   CSAF-derived data must NEVER use {@html} (SA-6 still applies).
-->

<script lang="ts">
  import { getI18n } from "$lib/i18n/context.svelte";
  import type { PageData } from "./$types";

  const { t } = getI18n();

  const { data }: { data: PageData } = $props();

  // Resolve the page title from the registry titleKey.
  // `t()` with a dynamic key: since titleKey is a string that is always a
  // valid MessageKey (enforced by the registry type), this is safe.
  const headTitle = $derived(t(data.titleKey as Parameters<typeof t>[0]));
</script>

<svelte:head>
  <title>{headTitle}</title>
</svelte:head>

<article class="mx-auto max-w-3xl">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{headTitle}</h1>

  {#if data.source === "file" || data.source === "repo"}
    <!--
      {@html} carve-out — ADR-0010 / ADR-0018 / SA-6:
      This is the ONE permitted {@html} sink in the application.
      data.html is operator-authored or repo-bundled Markdown rendered
      server-side via renderLegalMarkdown() (markdown-it html:false +
      sanitize-html allow-list + ADR-0007 scheme allow-list on anchors).
      NOT for CSAF data (SA-6 still applies to all CSAF content).
    -->
    <div class="legal-content mt-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- ADR-0010/ADR-0018 SA-6 carve-out: sanitized Markdown (renderLegalMarkdown). NOT for CSAF data. -->
      {@html data.html}
    </div>
  {:else}
    <!-- Fallback: SECURITYPORTAL_LEGAL_DIR unset or file missing — render i18n placeholder. -->

    <p
      class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      role="note"
    >
      {t("legal.placeholderNotice")}
    </p>

    {#if data.slug === "impressum"}
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
    {:else if data.slug === "datenschutz"}
      <div class="mt-6 space-y-6 text-sm text-gray-700 dark:text-gray-300">
        <section>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("legal.datenschutz.controllerHeading")}
          </h2>
          <p class="mt-1 whitespace-pre-line">{t("legal.datenschutz.controller")}</p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("legal.datenschutz.purposesHeading")}
          </h2>
          <p class="mt-1 whitespace-pre-line">{t("legal.datenschutz.purposes")}</p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("legal.datenschutz.legalBasisHeading")}
          </h2>
          <p class="mt-1 whitespace-pre-line">{t("legal.datenschutz.legalBasis")}</p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("legal.datenschutz.rightsHeading")}
          </h2>
          <p class="mt-1 whitespace-pre-line">{t("legal.datenschutz.rights")}</p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("legal.datenschutz.contactHeading")}
          </h2>
          <p class="mt-1 whitespace-pre-line">{t("legal.datenschutz.contact")}</p>
        </section>
      </div>
    {/if}
  {/if}
</article>
