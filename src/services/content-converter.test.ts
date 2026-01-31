/**
 * Quikim - Content Converter Tests
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  isHtmlContent,
  isMarkdownContent,
} from "./content-converter.js";

describe("ContentConverter - isHtmlContent", () => {
  it("should detect HTML tags", () => {
    assert.strictEqual(isHtmlContent("<p>Hello</p>"), true);
    assert.strictEqual(isHtmlContent("<div>Content</div>"), true);
    assert.strictEqual(isHtmlContent("<h1>Title</h1>"), true);
  });

  it("should detect HTML entities", () => {
    assert.strictEqual(isHtmlContent("&nbsp;"), true);
    assert.strictEqual(isHtmlContent("&lt;div&gt;"), true);
    assert.strictEqual(isHtmlContent("&#39;"), true);
  });

  it("should return false for plain text", () => {
    assert.strictEqual(isHtmlContent("Hello World"), false);
    assert.strictEqual(isHtmlContent("Just plain text"), false);
  });

  it("should return false for Markdown", () => {
    assert.strictEqual(isHtmlContent("# Header"), false);
    assert.strictEqual(isHtmlContent("**bold**"), false);
  });

  it("should handle empty and null input", () => {
    assert.strictEqual(isHtmlContent(""), false);
    assert.strictEqual(isHtmlContent(null as unknown as string), false);
  });
});

describe("ContentConverter - isMarkdownContent", () => {
  it("should detect Markdown headers", () => {
    assert.strictEqual(isMarkdownContent("# Header 1"), true);
    assert.strictEqual(isMarkdownContent("## Header 2"), true);
    assert.strictEqual(isMarkdownContent("### Header 3"), true);
  });

  it("should detect Markdown emphasis", () => {
    assert.strictEqual(isMarkdownContent("**bold text**"), true);
    assert.strictEqual(isMarkdownContent("*italic text*"), true);
  });

  it("should detect Markdown links", () => {
    assert.strictEqual(isMarkdownContent("[link](http://example.com)"), true);
  });

  it("should detect Markdown lists", () => {
    assert.strictEqual(isMarkdownContent("- item"), true);
    assert.strictEqual(isMarkdownContent("* item"), true);
    assert.strictEqual(isMarkdownContent("1. item"), true);
  });

  it("should detect Markdown code", () => {
    assert.strictEqual(isMarkdownContent("`code`"), true);
    assert.strictEqual(isMarkdownContent("```\ncode block\n```"), true);
  });

  it("should return false for plain text", () => {
    assert.strictEqual(isMarkdownContent("Hello World"), false);
    assert.strictEqual(isMarkdownContent("Just plain text"), false);
  });

  it("should handle empty and null input", () => {
    assert.strictEqual(isMarkdownContent(""), false);
    assert.strictEqual(isMarkdownContent(null as unknown as string), false);
  });
});
