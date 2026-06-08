<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<!--
 OPERATOR ACTION REQUIRED before launch: this Impressum is a PLACEHOLDER. The
 German required-section structure (Angaben gemäß § 5 TMG, responsible person,
 contact, disclaimer) is in place, but every value is a "[ tbd ]" placeholder via
 i18n. Replace the corresponding keys in src/lib/i18n/{de,en}.json with the real
 legal information (operator/company, address, contact, responsible person,
 disclaimers). Do NOT ship the placeholders publicly. (OQ-4 default.)
-->

<script lang="ts">
  import { getI18n } from "$lib/i18n/context.svelte";

  const { t } = getI18n();
</script>

<svelte:head>
  <title>{t("legal.impressum.headTitle")}</title>
</svelte:head>

<article class="mx-auto max-w-3xl">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("legal.impressum.title")}</h1>

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
</article>
