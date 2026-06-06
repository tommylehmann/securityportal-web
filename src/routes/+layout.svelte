<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import "../app.css";
  // Boxicons glyph font, used by the vendored CSAFWebview components (chevrons,
  // product-status icons, ...) via `bx bx-*` classes — the same icon set the
  // upstream csaf_webview uses. Importing the stylesheet makes those glyphs
  // render; without it the classes are inert. (Runtime dep: boxicons.)
  import "boxicons/css/boxicons.min.css";
  import { resolve } from "$app/paths";

  let { children } = $props();

  const home = resolve("/");
</script>

<div
  class="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
>
  <!-- Portal header. Kept text-only and English for now; the labels are isolated
       so Phase-5 i18n can swap them without restructuring the shell. -->
  <header class="bg-primary-800 text-white shadow">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
      <a href={home} class="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <i class="bx bx-shield-quarter text-2xl" aria-hidden="true"></i>
        SecurityPortal
      </a>
      <nav aria-label="Primary">
        <a href={home} class="rounded px-3 py-1 text-sm font-medium hover:bg-primary-700">
          Advisories
        </a>
      </nav>
    </div>
  </header>

  <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
    {@render children?.()}
  </main>

  <footer
    class="border-t border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="mx-auto max-w-7xl px-4 py-4 text-xs">Public CSAF 2.0 security advisory portal.</div>
  </footer>
</div>
