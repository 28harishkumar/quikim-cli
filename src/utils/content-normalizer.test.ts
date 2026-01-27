/**
 * Quikim - Content Normalizer Tests
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  stripHtmlTags,
  collapseWhitespace,
  normalizeForComparison,
  computeContentHash,
} from "./content-normalizer.js";

describe("stripHtmlTags", () => {
  it("should remove simple HTML tags", () => {
    const html = "<p>Hello World</p>";
    const result = stripHtmlTags(html);
    assert.strictEqual(result.trim(), "Hello World");
  });

  it("should remove nested HTML tags", () => {
    const html = "<div><p>Hello <strong>World</strong></p></div>";
    const result = stripHtmlTags(html);
    assert.ok(result.includes("Hello"));
    assert.ok(result.includes("World"));
  });

  it("should remove tags with attributes", () => {
    const html = "<p class=\"text\" id=\"para\">Content</p>";
    const result = stripHtmlTags(html);
    assert.strictEqual(result.trim(), "Content");
  });

  it("should remove script and style tags with content", () => {
    const html = "<p>Before</p><script>alert(\"test\");</script><p>After</p>";
    const result = stripHtmlTags(html);
    assert.ok(result.includes("Before"));
    assert.ok(result.includes("After"));
    assert.ok(!result.includes("alert"));
  });

  it("should decode HTML entities", () => {
    const html = "&lt;div&gt; &amp; &quot;test&quot;";
    const result = stripHtmlTags(html);
    assert.ok(result.includes("<div>"));
    assert.ok(result.includes("&"));
  });

  it("should handle empty and null input", () => {
    assert.strictEqual(stripHtmlTags(""), "");
    assert.strictEqual(stripHtmlTags(null as unknown as string), "");
  });
});

describe("collapseWhitespace", () => {
  it("should collapse multiple spaces", () => {
    const text = "Hello    World";
    const result = collapseWhitespace(text);
    assert.strictEqual(result, "Hello World");
  });

  it("should collapse tabs and newlines", () => {
    const text = "Hello\t\tWorld\n\nTest";
    const result = collapseWhitespace(text);
    assert.strictEqual(result, "Hello World Test");
  });

  it("should trim leading and trailing whitespace", () => {
    const text = "   Hello World   ";
    const result = collapseWhitespace(text);
    assert.strictEqual(result, "Hello World");
  });

  it("should handle empty and null input", () => {
    assert.strictEqual(collapseWhitespace(""), "");
    assert.strictEqual(collapseWhitespace(null as unknown as string), "");
  });
});

describe("normalizeForComparison", () => {
  it("should strip HTML and normalize whitespace", () => {
    const html = "<p>Hello   World</p>";
    const result = normalizeForComparison(html);
    assert.strictEqual(result, "hello world");
  });

  it("should convert to lowercase", () => {
    const text = "Hello WORLD Test";
    const result = normalizeForComparison(text);
    assert.strictEqual(result, "hello world test");
  });

  it("should handle complex HTML", () => {
    const html = "<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text</p></div>";
    const result = normalizeForComparison(html);
    assert.strictEqual(result, "title paragraph with bold text");
  });

  it("should produce same result for equivalent HTML", () => {
    const html1 = "<p>Hello World</p>";
    const html2 = "<div>Hello   World</div>";
    const html3 = "HELLO WORLD";
    
    const result1 = normalizeForComparison(html1);
    const result2 = normalizeForComparison(html2);
    const result3 = normalizeForComparison(html3);
    
    assert.strictEqual(result1, result2);
    assert.strictEqual(result2, result3);
  });

  it("should handle empty and null input", () => {
    assert.strictEqual(normalizeForComparison(""), "");
    assert.strictEqual(normalizeForComparison(null as unknown as string), "");
  });
});

describe("computeContentHash", () => {
  it("should generate consistent hash", () => {
    const content = "Hello World";
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);
    assert.strictEqual(hash1, hash2);
  });

  it("should generate same hash for equivalent content", () => {
    const content1 = "<p>Hello World</p>";
    const content2 = "<div>HELLO   WORLD</div>";
    const hash1 = computeContentHash(content1);
    const hash2 = computeContentHash(content2);
    assert.strictEqual(hash1, hash2);
  });

  it("should generate different hash for different content", () => {
    const content1 = "Hello World";
    const content2 = "Goodbye World";
    const hash1 = computeContentHash(content1);
    const hash2 = computeContentHash(content2);
    assert.notStrictEqual(hash1, hash2);
  });

  it("should return valid SHA-256 hash format", () => {
    const content = "Test content";
    const hash = computeContentHash(content);
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[a-f0-9]{64}$/);
  });

  it("should handle empty and null input", () => {
    const hash1 = computeContentHash(null as unknown as string);
    const hash2 = computeContentHash("");
    assert.strictEqual(hash1, hash2);
  });

  it("should normalize before hashing", () => {
    const content1 = "<p>Test   Content</p>";
    const content2 = "TEST CONTENT";
    const hash1 = computeContentHash(content1);
    const hash2 = computeContentHash(content2);
    assert.strictEqual(hash1, hash2);
  });
});

describe("Round-trip consistency", () => {
  it("should produce consistent results across normalizations", () => {
    const original = "<div><p>Hello   <strong>World</strong></p></div>";
    const normalized1 = normalizeForComparison(original);
    const normalized2 = normalizeForComparison(normalized1);
    assert.strictEqual(normalized1, normalized2);
  });

  it("should handle complex HTML structures consistently", () => {
    const html = "<div><h1>Title</h1><p>Text</p></div>";
    const hash1 = computeContentHash(html);
    const hash2 = computeContentHash(html);
    assert.strictEqual(hash1, hash2);
  });
});
