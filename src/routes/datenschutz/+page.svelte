<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<!--
 OPERATOR ACTION REQUIRED before launch: this Datenschutzerklärung is a
 PLACEHOLDER. The standard GDPR section structure (controller, processed data +
 purposes, legal basis, data-subject rights, contact) is in place, but every
 value is a "[ tbd ]" placeholder via i18n. Replace the corresponding keys in
 src/lib/i18n/{de,en}.json with the real privacy information (controller, actual
 data processed — e.g. server logs, cookies, retention — legal bases, and the
 data-protection contact). Do NOT ship the placeholders publicly. (OQ-4 default.)
-->

<script lang="ts">
  import { getI18n } from "$lib/i18n/context.svelte";

  const { t } = getI18n();
</script>

<svelte:head>
  <title>{t("legal.datenschutz.headTitle")}</title>
</svelte:head>

<article class="mx-auto max-w-3xl">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
    {t("legal.datenschutz.title")}
  </h1>

  <p
    class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    role="note"
  >
    {t("legal.placeholderNotice")}
  </p>

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
</article>
