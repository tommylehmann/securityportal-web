// This file is Free Software under the Apache-2.0 License
// without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileCopyrightText: 2026 Tommy Lehmann

// Unit tests for the legal-markdown render helper (SA-19 / ADR-0010).
//
// This is the security boundary for the one permitted {@html} sink.  All
// fixtures that carry a payload must produce output that is inert when injected
// into the DOM — the payload must not appear as a live HTML tag.
//
// Pipeline recap (for test reasoning):
//   1. markdown-it html:false  — raw HTML tags in the source are HTML-escaped
//      and appear as visible text (e.g. &lt;script&gt;), NOT as live elements.
//   2. sanitize-html allow-list — the rendered HTML passes through the allow-
//      list; only allow-listed tags/attributes survive as live elements.
//   3. Scheme allow-list on <a href> — javascript:/data:/vbscript: hrefs are
//      dropped; the anchor text remains (dead anchor without href).
//
// Consequence: a test that checks for the absence of a live <script> tag must
// check that the output does NOT contain the string "<script" (i.e. the live
// opening tag), not that the escaped representation &lt;script&gt; is absent —
// because the escaped form is safe (it renders as visible text, not code).

import { describe, expect, it } from "vitest";
import { renderLegalMarkdown } from "./legal-markdown";

// ---------------------------------------------------------------------------
// Happy-path: well-formed Markdown produces the expected safe HTML
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — happy path", () => {
  it("renders a heading", () => {
    const html = renderLegalMarkdown("## Heading");
    expect(html).toContain("<h2>Heading</h2>");
  });

  it("renders a paragraph", () => {
    const html = renderLegalMarkdown("Hello world.");
    expect(html).toContain("<p>Hello world.</p>");
  });

  it("renders an unordered list", () => {
    const html = renderLegalMarkdown("- item one\n- item two");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item one</li>");
    expect(html).toContain("<li>item two</li>");
  });

  it("renders a safe https anchor with rel=noopener and target=_blank", () => {
    const html = renderLegalMarkdown("[link](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("renders a safe http anchor with rel and target", () => {
    const html = renderLegalMarkdown("[link](http://example.com)");
    expect(html).toContain('href="http://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("renders a safe mailto anchor with rel and target", () => {
    const html = renderLegalMarkdown("[contact](mailto:hello@example.com)");
    expect(html).toContain('href="mailto:hello@example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("renders a combined heading + link + list correctly", () => {
    const html = renderLegalMarkdown("## Heading\n\n[link](https://example.com)\n\n- item");
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("<li>item</li>");
  });

  it("renders strong and em", () => {
    const html = renderLegalMarkdown("**bold** and _italic_");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders inline code and pre/code blocks", () => {
    const inlineHtml = renderLegalMarkdown("`inline code`");
    expect(inlineHtml).toContain("<code>inline code</code>");

    const blockHtml = renderLegalMarkdown("```\ncode block\n```");
    expect(blockHtml).toContain("<pre>");
    expect(blockHtml).toContain("code block");
  });

  it("renders a blockquote", () => {
    const html = renderLegalMarkdown("> quoted");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted");
  });

  it("renders a horizontal rule", () => {
    const html = renderLegalMarkdown("---");
    expect(html).toContain("<hr");
  });
});

// ---------------------------------------------------------------------------
// Security: script injection must not produce a live <script> tag (SA-19)
//
// markdown-it html:false escapes raw HTML — <script> becomes &lt;script&gt; in
// the text content.  sanitize-html then processes the resulting HTML; any <script>
// tag that somehow survived would be discarded.  The net result is that the
// output contains no live <script> opening tag.
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — <script> injection", () => {
  it("produces no live <script> tag for a raw <script> in source", () => {
    // markdown-it html:false escapes it; sanitize-html would discard it anyway.
    const html = renderLegalMarkdown('<script>alert("xss")</script>');
    // No live opening <script tag.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script>");
  });

  it("produces no live <script> tag for a <script src=...>", () => {
    const html = renderLegalMarkdown('<script src="https://evil.com/x.js"></script>');
    expect(html).not.toContain("<script");
  });

  it("produces no live on* attribute in any tag from markdown syntax", () => {
    // markdown-it does not produce on* attributes from markdown syntax.
    // Use a heading + paragraph to confirm no on* leaks.
    const html = renderLegalMarkdown("## Title\n\nParagraph.");
    // The live tag text must not contain on*= event handlers.
    // We check the live tags only (not escaped content — that is safe text).
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bon\w+=/i);
    }
  });

  it("produces no live on* attribute when a raw tag with onclick is in source", () => {
    // markdown-it html:false escapes the tag to &lt;p onclick=…&gt; — safe text.
    // sanitize-html would also strip on* attributes from any live tag anyway.
    const html = renderLegalMarkdown('<p onclick="alert(1)">text</p>');
    // There must be no live element carrying an on* handler.
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bon\w+=/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Security: <img> with onerror must not appear as a live tag (SA-19)
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — <img onerror> injection", () => {
  it("produces no live <img> for raw <img src=x onerror=...> in source", () => {
    // markdown-it html:false escapes it to visible text; img not in allow-list.
    const html = renderLegalMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("<img");
    // No live on* attribute anywhere in the output tags.
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bon\w+=/i);
    }
  });

  it("produces no live <img> for a markdown image syntax", () => {
    // Markdown images (![alt](url)) render to <img> which is not in the allow-list.
    const html = renderLegalMarkdown("![alt](https://example.com/img.png)");
    expect(html).not.toContain("<img");
  });
});

// ---------------------------------------------------------------------------
// Security: javascript: anchor hrefs (SA-19 / ADR-0007)
//
// markdown-it with linkify:false does NOT auto-link javascript: URLs — the
// markdown link syntax [text](javascript:url) does produce an <a> tag which
// sanitize-html then processes, dropping the disallowed scheme.
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — javascript: href injection", () => {
  it("produces no javascript: href from a Markdown [text](javascript:...) link", () => {
    // markdown-it renders [click](javascript:alert(1)) as <a href="javascript:…">
    // sanitize-html drops the disallowed-scheme href (link text is preserved).
    const html = renderLegalMarkdown("[click](javascript:alert(1))");
    // No live javascript: href anywhere.
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toMatch(/href=["']javascript:/i);
  });

  it("produces no JAVASCRIPT: href (scheme allow-list is case-insensitive via sanitize-html)", () => {
    const html = renderLegalMarkdown("[click](JAVASCRIPT:alert(1))");
    expect(html).not.toMatch(/href=["']javascript:/i);
  });

  it("produces no data: href from a Markdown link", () => {
    const html = renderLegalMarkdown("[x](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toMatch(/href=["']data:/i);
  });

  it("produces no vbscript: href from a Markdown link", () => {
    const html = renderLegalMarkdown("[x](vbscript:MsgBox(1))");
    expect(html).not.toMatch(/href=["']vbscript:/i);
  });

  it("produces no live javascript: href from a raw <a href=javascript:...> tag", () => {
    // markdown-it html:false escapes the raw tag to visible text.  The escaped
    // output may contain the literal characters href="javascript:... as text
    // content, but there must be no LIVE <a> element carrying that href.
    const html = renderLegalMarkdown('<a href="javascript:alert(document.domain)">click</a>');
    // Check that no live <a ...> opening tag carries a javascript: href.
    // We extract the live opening tags and inspect each one individually.
    const liveAnchorTags = html.match(/<a\b[^>]*>/gi) ?? [];
    for (const tag of liveAnchorTags) {
      expect(tag).not.toMatch(/href=["']javascript:/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Security: <iframe> must not appear as a live tag (SA-19)
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — <iframe> injection", () => {
  it("produces no live <iframe> for a raw <iframe src=...>", () => {
    // markdown-it html:false escapes it; sanitize-html would discard it anyway.
    const html = renderLegalMarkdown('<iframe src="https://evil.com"></iframe>');
    expect(html).not.toContain("<iframe");
  });

  it("produces no live <iframe> or <script> for iframe with srcdoc script", () => {
    const html = renderLegalMarkdown('<iframe srcdoc="<script>alert(1)</script>"></iframe>');
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<script");
  });
});

// ---------------------------------------------------------------------------
// Security: on* event attributes must not appear in any live tag (SA-19)
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — on* attribute injection", () => {
  it("produces no live on* attribute from safe markdown syntax", () => {
    // Normal markdown never produces on* attributes — this is a baseline check.
    const html = renderLegalMarkdown("## Heading\n\n[link](https://example.com)\n\n- item");
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bon\w+=/i);
    }
  });

  it("produces no live on* attribute from a raw tag with onmouseover", () => {
    // markdown-it html:false escapes the tag; sanitize-html strips on* anyway.
    const html = renderLegalMarkdown(
      '<a href="https://example.com" onmouseover="steal()">link</a>'
    );
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bon\w+=/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Security: HTML comment injection
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — HTML comment injection", () => {
  it("removes HTML conditional comment with embedded script", () => {
    // markdown-it html:false escapes or ignores comments.
    // sanitize-html strips HTML comments entirely.
    const html = renderLegalMarkdown("<!--[if IE]><script>alert(1)</script><![endif]-->");
    expect(html).not.toContain("<script");
    // No live comment delimiter.
    expect(html).not.toContain("<!--");
  });

  it("removes a plain HTML comment — no live comment delimiter in output", () => {
    // markdown-it html:false escapes the comment to visible text.  The
    // important security property is that there is no live <!-- --> comment
    // node (a live comment could carry IE conditional-comment payloads).
    const html = renderLegalMarkdown("<!-- secret comment -->");
    // No live comment opening delimiter.
    expect(html).not.toContain("<!--");
    // The output may contain the escaped text &lt;!-- but no live comment.
    // Verify the entire output contains no unescaped comment syntax.
    expect(html.includes("<!--")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Security: id, class, style attributes must not appear in any live tag
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — id/class/style attribute stripping", () => {
  it("produces no id attribute in any live tag from markdown syntax", () => {
    // markdown-it does not add id attributes to headings by default.
    const html = renderLegalMarkdown("## Heading");
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bid=/i);
    }
  });

  it("produces no style attribute in any live tag (CSS injection blocked)", () => {
    // Raw HTML is escaped by markdown-it (html:false); sanitize-html also strips style.
    const html = renderLegalMarkdown(
      '<p style="color:red;background:url(javascript:alert(1))">text</p>'
    );
    // No live <p> or other tag with a style attribute.
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bstyle=/i);
    }
  });

  it("produces no class attribute in any live tag", () => {
    const html = renderLegalMarkdown('<p class="evil">text</p>');
    const liveTagMatches = html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of liveTagMatches) {
      expect(tag).not.toMatch(/\bclass=/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Security: object, embed, svg must not appear as live tags
// ---------------------------------------------------------------------------

describe("renderLegalMarkdown — forbidden elements", () => {
  it("produces no live <object> tag", () => {
    // markdown-it html:false escapes raw tags.
    const html = renderLegalMarkdown('<object data="https://evil.com/x.swf"></object>');
    expect(html).not.toContain("<object");
  });

  it("produces no live <embed> tag", () => {
    const html = renderLegalMarkdown('<embed src="https://evil.com/x.swf">');
    expect(html).not.toContain("<embed");
  });

  it("produces no live <svg> tag or embedded <script>", () => {
    const html = renderLegalMarkdown(
      '<svg onload="alert(1)"><foreignObject><script>alert(1)</script></foreignObject></svg>'
    );
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<script");
  });
});
