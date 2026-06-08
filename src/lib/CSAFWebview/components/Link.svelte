<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

<!--
  Self-contained anchor used by the vendored CSAFWebview components. ISDuBA's
  Link couples to its SPA router; the portal relies on SvelteKit's own
  navigation, so a plain anchor with an optional onclick handler is enough.

  Security: every href that derives from CSAF content passes through this
  component. The scheme allow-list (isSafeUrl, decisions/0007) ensures that
  javascript:, data:, vbscript:, and other non-allow-listed schemes are never
  placed in an anchor attribute. Instead they render as inert escaped text so
  the URL is visible but not clickable. All _blank links carry
  rel="noopener noreferrer" regardless of whether the caller set it.
  See threat-model control C-1 / SA-8.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { isSafeUrl } from "$lib/CSAFWebview/safeUrl";

  type Props = {
    onclick?: (e: Event) => void;
    ariaLabel?: string;
    href: string;
    id?: string;
    children?: Snippet;
  } & HTMLAnchorAttributes;

  let { ariaLabel, href, id, onclick, children, ...restProps }: Props = $props();

  const safe = $derived(isSafeUrl(href));

  // Ensure _blank links can never open a page that navigates the opener.
  const rel = $derived(
    restProps.target === "_blank" ? "noopener noreferrer" : (restProps.rel ?? undefined)
  );
</script>

{#if safe}
  <!--
    These are in-document anchors used by the viewer (e.g. jump to a CVE/product
    within the rendered advisory), not SvelteKit route navigations, so the
    resolve() helper does not apply here.
  -->
  <!-- eslint-disable svelte/no-navigation-without-resolve -->
  <a
    {onclick}
    class={restProps.class ?? ""}
    aria-label={ariaLabel}
    {href}
    {id}
    target={restProps.target}
    {rel}
  >
    {@render children?.()}
  </a>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
  <!--
    Unsafe scheme (javascript:, data:, vbscript:, or unknown): render the URL
    as inert escaped text so it is visible to the user but cannot be clicked.
    The span preserves any class the caller set (e.g. "underline") so the visual
    context is unchanged.
  -->
  <span class={restProps.class ?? ""} aria-label={ariaLabel} {id}>
    {@render children?.()}
  </span>
{/if}
