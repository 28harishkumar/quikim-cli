/**
 * Quikim - Content Converter HTML to Markdown Tests
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { htmlToMarkdown } from "./content-converter.js";

describe("ContentConverter - htmlToMarkdown", () => {
  it("should convert simple HTML to Markdown", () => {
    const html = "<p>Hello World</p>";
    const result = htmlToMarkdown(html);
    assert.strictEqual(result.trim(), "Hello World");
  });

  it("should convert headers", () => {
    const html = "<h1>Title</h1>";
    const result = htmlToMarkdown(html);
    assert.strictEqual(result.trim(), "# Title");
  });

  it("should convert bold and italic", () => {
    const html = "<strong>bold</strong> and <em>italic</em>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("**bold**"));
    assert.ok(result.includes("*italic*"));
  });

  it("should convert links", () => {
    const html = '<a href="http://example.com">link</a>';
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("[link](http://example.com)"));
  });

  it("should convert unordered lists", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("Item 1"));
    assert.ok(result.includes("Item 2"));
    assert.ok(result.includes("*") || result.includes("-"));
  });

  it("should convert ordered lists", () => {
    const html = "<ol><li>First</li><li>Second</li></ol>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("First"));
    assert.ok(result.includes("Second"));
    assert.ok(/\d+\.\s/.test(result));
  });

  it("should convert code blocks", () => {
    const html = "<pre><code>const x = 1;</code></pre>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("```"));
    assert.ok(result.includes("const x = 1;"));
  });

  it("should handle nested HTML", () => {
    const html = "<div><p>Paragraph with <strong>bold</strong> text</p></div>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("**bold**"));
    assert.ok(result.includes("Paragraph"));
  });

  it("should return plain text as-is", () => {
    const text = "Just plain text";
    const result = htmlToMarkdown(text);
    assert.strictEqual(result, text);
  });

  it("should handle empty input", () => {
    assert.strictEqual(htmlToMarkdown(""), "");
    assert.strictEqual(htmlToMarkdown(null as unknown as string), "");
  });

  it("should handle malformed HTML gracefully", () => {
    const html = "<p>Unclosed paragraph";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("Unclosed paragraph"));
  });

  it("should handle special characters", () => {
    const html = "<p>&lt;script&gt;alert('xss')&lt;/script&gt;</p>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("script"));
  });

  it("should handle blockquotes", () => {
    const html = "<blockquote>Quote text</blockquote>";
    const result = htmlToMarkdown(html);
    assert.ok(result.includes("Quote text"));
  });
});
