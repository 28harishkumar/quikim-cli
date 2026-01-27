/**
 * Quikim - Content Converter Round-trip Tests
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ContentConverter,
  htmlToMarkdown,
  markdownToHtml,
} from "./content-converter.js";

describe("ContentConverter - Round-trip conversion", () => {
  it("should maintain content through HTML → Markdown → HTML", async () => {
    const originalHtml = "<h1>Title</h1><p>Paragraph with <strong>bold</strong> text</p>";
    const markdown = htmlToMarkdown(originalHtml);
    const finalHtml = await markdownToHtml(markdown);
    
    assert.ok(finalHtml.includes("Title"));
    assert.ok(finalHtml.includes("Paragraph"));
    assert.ok(finalHtml.includes("bold"));
  });

  it("should maintain content through Markdown → HTML → Markdown", async () => {
    const originalMarkdown = "# Title\n\nParagraph with **bold** text";
    const html = await markdownToHtml(originalMarkdown);
    const finalMarkdown = htmlToMarkdown(html);
    
    assert.ok(finalMarkdown.includes("Title"));
    assert.ok(finalMarkdown.includes("Paragraph"));
    assert.ok(finalMarkdown.includes("bold"));
  });

  it("should handle lists in round-trip conversion", async () => {
    const markdown = "- Item 1\n- Item 2\n- Item 3";
    const html = await markdownToHtml(markdown);
    const backToMarkdown = htmlToMarkdown(html);
    
    assert.ok(backToMarkdown.includes("Item 1"));
    assert.ok(backToMarkdown.includes("Item 2"));
    assert.ok(backToMarkdown.includes("Item 3"));
  });

  it("should handle links in round-trip conversion", async () => {
    const markdown = "[Example](http://example.com)";
    const html = await markdownToHtml(markdown);
    const backToMarkdown = htmlToMarkdown(html);
    
    assert.ok(backToMarkdown.includes("Example"));
    assert.ok(backToMarkdown.includes("http://example.com"));
  });

  it("should handle code blocks in round-trip conversion", async () => {
    const markdown = "```javascript\nconst x = 1;\n```";
    const html = await markdownToHtml(markdown);
    const backToMarkdown = htmlToMarkdown(html);
    
    assert.ok(backToMarkdown.includes("const x = 1;"));
  });

  it("should handle nested lists", async () => {
    const markdown = "- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2";
    const html = await markdownToHtml(markdown);
    const backToMarkdown = htmlToMarkdown(html);
    
    assert.ok(backToMarkdown.includes("Item 1"));
    assert.ok(backToMarkdown.includes("Nested 1"));
  });

  it("should handle mixed content", async () => {
    const markdown = "# Title\n\nParagraph with **bold** and *italic* and [link](http://example.com)\n\n- List item\n\n```\ncode\n```";
    const html = await markdownToHtml(markdown);
    const backToMarkdown = htmlToMarkdown(html);
    
    assert.ok(backToMarkdown.includes("Title"));
    assert.ok(backToMarkdown.includes("bold"));
    assert.ok(backToMarkdown.includes("italic"));
    assert.ok(backToMarkdown.includes("link"));
    assert.ok(backToMarkdown.includes("List item"));
    assert.ok(backToMarkdown.includes("code"));
  });
});

describe("ContentConverter - Error handling", () => {
  it("should throw error for invalid HTML conversion", () => {
    const converter = new ContentConverter();
    
    try {
      const result = converter.htmlToMarkdown("<<<<>>>>");
      assert.ok(typeof result === "string");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok((error as Error).message.includes("Failed to convert"));
    }
  });

  it("should handle unicode in round-trip", async () => {
    const markdown = "# 你好世界 🌍";
    const html = await markdownToHtml(markdown);
    const backToMarkdown = htmlToMarkdown(html);
    
    assert.ok(backToMarkdown.includes("你好世界"));
    assert.ok(backToMarkdown.includes("🌍"));
  });
});
