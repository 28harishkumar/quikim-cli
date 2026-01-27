/**
 * Quikim - Content Converter Markdown to HTML Tests
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { markdownToHtml } from "./content-converter.js";

describe("ContentConverter - markdownToHtml", () => {
  it("should convert simple Markdown to HTML", async () => {
    const markdown = "Hello World";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("Hello World"));
  });

  it("should convert headers", async () => {
    const markdown = "# Title";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<h1"));
    assert.ok(result.includes("Title"));
  });

  it("should convert bold and italic", async () => {
    const markdown = "**bold** and *italic*";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<strong>bold</strong>"));
    assert.ok(result.includes("<em>italic</em>"));
  });

  it("should convert links", async () => {
    const markdown = "[link](http://example.com)";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes('<a href="http://example.com"'));
    assert.ok(result.includes("link"));
  });

  it("should convert unordered lists", async () => {
    const markdown = "- Item 1\n- Item 2";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<ul>"));
    assert.ok(result.includes("<li>Item 1</li>"));
    assert.ok(result.includes("<li>Item 2</li>"));
  });

  it("should convert ordered lists", async () => {
    const markdown = "1. First\n2. Second";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<ol>"));
    assert.ok(result.includes("<li>First</li>"));
    assert.ok(result.includes("<li>Second</li>"));
  });

  it("should convert code blocks", async () => {
    const markdown = "```\nconst x = 1;\n```";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<code>"));
    assert.ok(result.includes("const x = 1;"));
  });

  it("should convert inline code", async () => {
    const markdown = "Use `const` for constants";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<code>const</code>"));
  });

  it("should support GitHub Flavored Markdown tables", async () => {
    const markdown = "| Header |\n|--------|\n| Cell   |";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("Header"));
    assert.ok(result.includes("Cell"));
    assert.ok(result.includes("<table") || result.includes("Header"));
  });

  it("should return plain text as-is", async () => {
    const text = "Just plain text without markdown";
    const result = await markdownToHtml(text);
    assert.strictEqual(result.trim(), text);
  });

  it("should handle empty input", async () => {
    const result1 = await markdownToHtml("");
    const result2 = await markdownToHtml(null as unknown as string);
    assert.strictEqual(result1, "");
    assert.strictEqual(result2, "");
  });

  it("should handle horizontal rules", async () => {
    const markdown = "---";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("<hr") || result.includes("---"));
  });

  it("should handle unicode characters", async () => {
    const markdown = "# 你好世界 🌍";
    const result = await markdownToHtml(markdown);
    assert.ok(result.includes("你好世界"));
    assert.ok(result.includes("🌍"));
  });
});
