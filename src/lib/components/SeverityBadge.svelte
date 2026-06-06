<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<script lang="ts">
  import type { Severity } from "$lib/api/types";

  interface Props {
    severity: Severity;
    /** Effective CVSS score, shown alongside the label when present. */
    score?: number | null;
  }
  let { severity, score = null }: Props = $props();

  // Colour tokens per CSAF/CVSS bucket. Distinct, high-contrast hues so the
  // severity reads at a glance in the result list (spec §13).
  const styles: Record<Severity, string> = {
    none: "bg-gray-100 text-gray-700 ring-gray-300 dark:bg-gray-700 dark:text-gray-200",
    low: "bg-green-100 text-green-800 ring-green-300 dark:bg-green-900 dark:text-green-200",
    medium: "bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 ring-red-300 dark:bg-red-900 dark:text-red-200"
  };

  const labels: Record<Severity, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical"
  };
</script>

<span
  class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset {styles[
    severity
  ]}"
  title={score !== null ? `CVSS ${score.toFixed(1)}` : labels[severity]}
>
  {labels[severity]}
  {#if score !== null && score > 0}
    <span class="font-normal tabular-nums">{score.toFixed(1)}</span>
  {/if}
</span>
