<!--
 This file is Free Software under the Apache-2.0 License
 without warranty, see README.md and LICENSES/Apache-2.0.txt for details.

 SPDX-License-Identifier: Apache-2.0

 SPDX-FileCopyrightText: 2026 German Federal Office for Information Security (BSI) <https://www.bsi.bund.de>
 Software-Engineering: 2026 Intevation GmbH <https://intevation.de>
-->

<!--
  Renders a CSAF free-text field. The component name is kept from the upstream
  csaf_webview/ISDuBA viewer (where it also drove search-match highlighting),
  but in the public portal it has a single, security-relevant job:

    - render the value as ESCAPED PLAIN TEXT (Svelte `{text}`), never `{@html}`,
      so untrusted vendor content can never inject markup; and
    - preserve author line breaks via `white-space: pre-wrap`.

  See decisions/0001-csaf-free-text-rendering.md. The reference viewers put the
  text in normal flow (collapsing `\n` to spaces) and referenced a never-defined
  `display-markdown` class; both defects are corrected here.
-->
<script lang="ts">
  interface Props {
    text: number | string | undefined;
    // Retained for call-site compatibility with the upstream components, which
    // used the JSON pointer to drive search highlighting. The public viewer has
    // no search feature, so it is intentionally accepted and ignored.
    textPath?: string;
  }
  let { text, textPath: _textPath }: Props = $props();
</script>

<span class="csaf-free-text">{text}</span>

<style>
  .csaf-free-text {
    /* Preserve author line breaks and runs of whitespace while still wrapping
       long lines (ADR 0001). */
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
