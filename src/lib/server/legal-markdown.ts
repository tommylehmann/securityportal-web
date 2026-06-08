// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Server-only Markdown renderer for operator-supplied legal pages (spec §16.4,
// ADR-0010).  The pipeline is:
//
//   operator Markdown source
//     → markdown-it (html:false — raw HTML in source is escaped, not passed
//       through; only markdown syntax produces HTML)
//     → sanitize-html (fixed allow-list — strips every element/attribute not
//       explicitly permitted; drops script/iframe/object/svg/img entirely;
//       enforces ADR-0007 scheme allow-list on anchors; adds
//       rel="noopener noreferrer" + target="_blank" on every anchor)
//     → sanitized HTML string safe for {@html} on legal pages ONLY
//
// {@html} carve-out (R-7 / ADR-0010 / SA-6): this output is the ONE permitted
// {@html} sink in the application.  SA-6 still forbids {@html} for CSAF data;
// this carve-out covers only operator-authored content passed through this
// pipeline.  Defense layers:
//   1. markdown-it html:false — only recognized markdown constructs produce HTML.
//   2. sanitize-html allow-list — strips everything not explicitly permitted.
//   3. Scheme allow-list on anchors — blocks javascript:/data:/vbscript: hrefs.
//   4. CSP script-src 'self' — backstop; blocks injected <script> + inline on*.

import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

// ---------------------------------------------------------------------------
// markdown-it instance
// ---------------------------------------------------------------------------

// html:false — raw HTML tags in the markdown source are escaped and shown as
// text rather than passed through.  This is the primary safeguard against an
// operator accidentally (or maliciously) embedding raw HTML.
// linkify:false — avoid auto-linking surprises; only explicit [text](url)
// markdown syntax produces anchors.
// typographer:false — keep output predictable; no smart quotes.
const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false
});

// ---------------------------------------------------------------------------
// sanitize-html allow-list (spec §16.4 / ADR-0010)
// ---------------------------------------------------------------------------

// Block / structural elements: paragraph, four heading levels, lists,
// blockquote, code blocks, horizontal rule, line break.
// Inline elements: strong, em, inline code.
// Table elements: table, thread, tbody, row, header cell, data cell.
// Anchors: href only; all other attributes are stripped.
// Attributes allowed on table cells: colspan and rowspan only (no class/style).
const ALLOWED_TAGS: sanitizeHtml.IOptions["allowedTags"] = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "strong",
  "em",
  "code",
  "pre",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a"
];

// Attributes permitted per tag.  id/class/style/on* are not listed and will
// therefore be stripped from every element.
//
// Note: rel and target are listed for <a> so that the transformTags callback
// can inject them.  sanitize-html strips attributes that are not in this list
// even when transformTags adds them, so they must be explicitly allowed here.
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "rel", "target"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"]
};

// Scheme allow-list for anchor hrefs (ADR-0007 reuse):
// http, https, mailto only.  javascript:/data:/vbscript: are excluded.
// sanitize-html uses the scheme strings WITHOUT the trailing colon.
const ALLOWED_SCHEMES = ["http", "https", "mailto"];

// ---------------------------------------------------------------------------
// sanitize-html options
// ---------------------------------------------------------------------------

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,

  // Enforce scheme allow-list on <a href>.  Any href with an unlisted scheme
  // (javascript:, data:, vbscript:, or anything else) has the href attribute
  // dropped by sanitize-html; the link text is still rendered as text.
  allowedSchemes: ALLOWED_SCHEMES,

  // Add rel="noopener noreferrer" and target="_blank" to every anchor so that
  // external links do not have access to the opener context (ADR-0007 /
  // threat-model C-1).
  transformTags: {
    a: (tagName, attribs) => {
      return {
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          target: "_blank"
        }
      };
    }
  },

  // Drop any tag that sanitize-html would otherwise render as text by wrapping
  // in its content — we simply discard the elements not on the allow-list.
  disallowedTagsMode: "discard"
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders operator-supplied Markdown to sanitized HTML suitable for injection
 * via {@html} on legal pages only (ADR-0010 / SA-6 carve-out).
 *
 * The pipeline enforces:
 * - markdown-it with `html:false` (raw HTML in source is escaped).
 * - sanitize-html with a fixed allow-list (no script/iframe/object/svg/img).
 * - Scheme allow-list (`http`/`https`/`mailto`) on anchors; unsafe-scheme
 *   hrefs are dropped (link text remains).
 * - `rel="noopener noreferrer"` + `target="_blank"` on every anchor.
 *
 * @param markdownSource - Operator-supplied Markdown text.
 * @returns Sanitized HTML string.
 */
export function renderLegalMarkdown(markdownSource: string): string {
  // Step 1: render Markdown to HTML (only recognized markdown constructs
  //         produce HTML — raw HTML tags are escaped).
  const rendered = md.render(markdownSource);

  // Step 2: sanitize the rendered HTML to the fixed allow-list.
  return sanitizeHtml(rendered, SANITIZE_OPTIONS);
}
