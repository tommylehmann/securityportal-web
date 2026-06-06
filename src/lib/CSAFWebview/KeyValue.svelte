<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2023 German Federal Office for Information Security (BSI) <https://www.bsi.bund.de>
 Software-Engineering: 2023 Intevation GmbH <https://intevation.de>
-->

<script lang="ts">
  import { Table, TableBody, TableBodyCell, TableBodyRow } from "flowbite-svelte";
  import CVSS from "./general/CVSS.svelte";
  import Link from "$lib/CSAFWebview/components/Link.svelte";
  import SearchableText from "./SearchableText.svelte";

  interface Props {
    keys: Array<string>;
    paths?: Array<string>;
    values: any;
  }
  let { keys, values, paths }: Props = $props();

  const uid = $props.id();

  const cellStyle = "px-6 py-1";
</script>

<div class="ml-2 w-fit">
  <Table border={false}>
    <TableBody>
      {#each keys as key, index (`keyvalue-${uid}-${index}`)}
        {#if key === "text" || key === "Text"}
          <!--
            Free-text cell: render as escaped plain text with preserved line
            breaks (ADR 0001). The upstream branch printed the loop index and
            used a never-defined `display-markdown` class; both are corrected.
          -->
          <TableBodyRow color="default">
            <TableBodyCell class={cellStyle}>{key}</TableBodyCell>
            <TableBodyCell class={cellStyle}>
              <div class="free-text-cell max-w-2/3">
                <SearchableText text={values[index]} textPath={paths?.[index] ?? ""} />
              </div>
            </TableBodyCell>
          </TableBodyRow>
        {:else if key === "baseScore" || key === "baseSeverity"}
          <TableBodyRow color="default">
            <TableBodyCell class={cellStyle}>{key}</TableBodyCell>
            <TableBodyCell class={cellStyle}>
              {#if key === "baseScore"}
                <CVSS baseScore={values[index]}></CVSS>
              {:else}
                <CVSS baseSeverity={values[index]}></CVSS>
              {/if}
            </TableBodyCell>
          </TableBodyRow>
        {:else}
          <TableBodyRow color="default"
            ><TableBodyCell class={cellStyle}>{key}</TableBodyCell>
            <TableBodyCell class={cellStyle}>
              {#if typeof values[index] === "string" && values[index].startsWith && values[index].startsWith("https://")}
                <Link class="underline" href={values[index]}>
                  <i class="bx bx-link"></i>
                  <SearchableText text={values[index]} textPath={paths?.[index] ?? ""} />
                </Link>
              {:else if Array.isArray(values[index])}
                <div class="flex flex-wrap gap-1">
                  {#each values[index] as value, j (`keyvalue-2-${uid}-${j}`)}
                    <SearchableText
                      text={`${value}${j < values[index].length - 1 ? "," : ""}`}
                      textPath={`${paths?.[index] ?? ""}[${j}]`}
                    />
                  {/each}
                </div>
              {:else}
                <SearchableText text={values[index]} textPath={paths?.[index] ?? ""} />
              {/if}
            </TableBodyCell>
          </TableBodyRow>
        {/if}
      {/each}
    </TableBody>
  </Table>
</div>

<style>
  .free-text-cell {
    padding: 0.5rem;
    border: 1px solid lightgray;
  }
</style>
