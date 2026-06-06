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
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  type Props = {
    onclick?: (e: Event) => void;
    ariaLabel?: string;
    href: string;
    id?: string;
    children?: Snippet;
  } & HTMLAnchorAttributes;

  let { ariaLabel, href, id, onclick, children, ...restProps }: Props = $props();
</script>

<!--
  These are in-document anchors used by the viewer (e.g. jump to a CVE/product
  within the rendered advisory), not SvelteKit route navigations, so the
  resolve() helper does not apply here.
-->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {onclick} class={restProps.class ?? ""} aria-label={ariaLabel} {href} {id}>
  {@render children?.()}
</a>
