/**
 * Quikim - Content Extractor Tests
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractContent,
  prepareContentForPush,
  detectContentFormat,
  validateExtractedContent,
} from "./content-extractor.js";

describe("extractContent", () => {
  describe("string content format", () => {
    it("should extract string content as-is", () => {
      const artifact = { content: "This is plain text content" };
      const result = extractContent(artifact);
      assert.strictEqual(result, "This is plain text content");
    });

    it("should handle empty string content", () => {
      const artifact = { content: "" };
      const result = extractContent(artifact);
      assert.strictEqual(result, "");
    });

    it("should handle HTML string content", () => {
      const artifact = { content: "<h1>Title</h1><p>Content</p>" };
      const result = extractContent(artifact);
      assert.strictEqual(result, "<h1>Title</h1><p>Content</p>");
    });

    it("should handle Markdown string content", () => {
      const artifact = { content: "# Title\n\nThis is **bold** text" };
      const result = extractContent(artifact);
      assert.strictEqual(result, "# Title\n\nThis is **bold** text");
    });
  });

  describe("object with text property format", () => {
    it("should extract text property from object", () => {
      const artifact = { content: { text: "Content from text property" } };
      const result = extractContent(artifact);
      assert.strictEqual(result, "Content from text property");
    });

    it("should handle empty text property", () => {
      const artifact = { content: { text: "" } };
      const result = extractContent(artifact);
      assert.strictEqual(result, "");
    });

    it("should convert non-string text property to string", () => {
      const artifact = { content: { text: 12345 } };
      const result = extractContent(artifact);
      assert.strictEqual(result, "12345");
    });

    it("should handle object with text property and other fields", () => {
      const artifact = { 
        content: { 
          text: "Main content", 
          metadata: { author: "John" } 
        } 
      };
      const result = extractContent(artifact);
      assert.strictEqual(result, "Main content");
    });
  });

  describe("object with content property format", () => {
    it("should extract content property from nested object", () => {
      const artifact = { content: { content: "Nested content" } };
      const result = extractContent(artifact);
      assert.strictEqual(result, "Nested content");
    });

    it("should handle empty nested content property", () => {
      const artifact = { content: { content: "" } };
      const result = extractContent(artifact);
      assert.strictEqual(result, "");
    });

    it("should convert non-string nested content to string", () => {
      const artifact = { content: { content: true } };
      const result = extractContent(artifact);
      assert.strictEqual(result, "true");
    });
  });

  describe("JSON content format", () => {
    it("should stringify JSON object content", () => {
      const artifact = { 
        content: { 
          title: "Document", 
          body: "Content", 
          metadata: { version: 1 } 
        } 
      };
      const result = extractContent(artifact);
      const parsed = JSON.parse(result);
      assert.deepStrictEqual(parsed, {
        title: "Document",
        body: "Content",
        metadata: { version: 1 },
      });
    });

    it("should handle array content", () => {
      const artifact = { content: { items: ["item1", "item2", "item3"] } };
      const result = extractContent(artifact);
      const parsed = JSON.parse(result);
      assert.deepStrictEqual(parsed.items, ["item1", "item2", "item3"]);
    });

    it("should format JSON with proper indentation", () => {
      const artifact = { content: { key: "value" } };
      const result = extractContent(artifact);
      assert.ok(result.includes("\n")); // Should have newlines from formatting
      assert.ok(result.includes("  ")); // Should have indentation
    });
  });

  describe("edge cases", () => {
    it("should return empty string for undefined content", () => {
      const artifact = { content: undefined };
      const result = extractContent(artifact);
      assert.strictEqual(result, "");
    });

    it("should return empty string for missing content property", () => {
      const artifact = {};
      const result = extractContent(artifact);
      assert.strictEqual(result, "");
    });

    it("should handle number content by converting to string", () => {
      const artifact = { content: 42 as unknown as string };
      const result = extractContent(artifact);
      assert.strictEqual(result, "42");
    });

    it("should handle boolean content by converting to string", () => {
      const artifact = { content: true as unknown as string };
      const result = extractContent(artifact);
      assert.strictEqual(result, "true");
    });
  });
});

describe("prepareContentForPush", () => {
  const testContent = "# Title\n\nThis is test content";

  describe("standard artifact types", () => {
    it("should return content as-is for requirement", () => {
      const result = prepareContentForPush(testContent, "requirement");
      assert.strictEqual(result, testContent);
    });

    it("should return content as-is for hld", () => {
      const result = prepareContentForPush(testContent, "hld");
      assert.strictEqual(result, testContent);
    });

    it("should return content as-is for lld", () => {
      const result = prepareContentForPush(testContent, "lld");
      assert.strictEqual(result, testContent);
    });

    it("should return content as-is for context", () => {
      const result = prepareContentForPush(testContent, "context");
      assert.strictEqual(result, testContent);
    });

    it("should return content as-is for code_guideline", () => {
      const result = prepareContentForPush(testContent, "code_guideline");
      assert.strictEqual(result, testContent);
    });

    it("should return content as-is for flow_diagram", () => {
      const result = prepareContentForPush(testContent, "flow_diagram");
      assert.strictEqual(result, testContent);
    });
  });

  describe("wireframe_files", () => {
    it("should return valid JSON content as-is", () => {
      const jsonContent = '{"viewport": {"width": 1280}, "elements": []}';
      const result = prepareContentForPush(jsonContent, "wireframe_files");
      assert.strictEqual(result, jsonContent);
    });

    it("should return non-JSON content as-is", () => {
      const result = prepareContentForPush(testContent, "wireframe_files");
      assert.strictEqual(result, testContent);
    });

    it("should handle malformed JSON gracefully", () => {
      const malformedJson = '{"incomplete": ';
      const result = prepareContentForPush(malformedJson, "wireframe_files");
      assert.strictEqual(result, malformedJson);
    });
  });

  describe("tasks", () => {
    it("should return content as-is for tasks", () => {
      const result = prepareContentForPush(testContent, "tasks");
      assert.strictEqual(result, testContent);
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const result = prepareContentForPush("", "requirement");
      assert.strictEqual(result, "");
    });

    it("should handle whitespace-only content", () => {
      const result = prepareContentForPush("   \n\n   ", "hld");
      assert.strictEqual(result, "   \n\n   ");
    });
  });
});

describe("detectContentFormat", () => {
  it("should detect string format", () => {
    const format = detectContentFormat("plain text");
    assert.strictEqual(format.isString, true);
    assert.strictEqual(format.isObjectWithText, false);
    assert.strictEqual(format.isObjectWithContent, false);
    assert.strictEqual(format.isJSON, false);
  });

  it("should detect object with text property", () => {
    const format = detectContentFormat({ text: "content" });
    assert.strictEqual(format.isString, false);
    assert.strictEqual(format.isObjectWithText, true);
    assert.strictEqual(format.isObjectWithContent, false);
    assert.strictEqual(format.isJSON, false);
  });

  it("should detect object with content property", () => {
    const format = detectContentFormat({ content: "nested" });
    assert.strictEqual(format.isString, false);
    assert.strictEqual(format.isObjectWithText, false);
    assert.strictEqual(format.isObjectWithContent, true);
    assert.strictEqual(format.isJSON, false);
  });

  it("should detect JSON object", () => {
    const format = detectContentFormat({ title: "doc", body: "text" });
    assert.strictEqual(format.isString, false);
    assert.strictEqual(format.isObjectWithText, false);
    assert.strictEqual(format.isObjectWithContent, false);
    assert.strictEqual(format.isJSON, true);
  });

  it("should prioritize text property over JSON detection", () => {
    const format = detectContentFormat({ text: "main", other: "data" });
    assert.strictEqual(format.isObjectWithText, true);
    assert.strictEqual(format.isJSON, false);
  });

  it("should prioritize content property over JSON detection", () => {
    const format = detectContentFormat({ content: "main", other: "data" });
    assert.strictEqual(format.isObjectWithContent, true);
    assert.strictEqual(format.isJSON, false);
  });
});

describe("validateExtractedContent", () => {
  it("should not throw for valid string content", () => {
    assert.doesNotThrow(() => {
      validateExtractedContent("valid content", "test-artifact");
    });
  });

  it("should not throw for empty string content", () => {
    assert.doesNotThrow(() => {
      validateExtractedContent("", "test-artifact");
    });
  });

  it("should throw for null content", () => {
    assert.throws(
      () => {
        validateExtractedContent(null as unknown as string, "test-artifact");
      },
      /content is null or undefined/
    );
  });

  it("should throw for undefined content", () => {
    assert.throws(
      () => {
        validateExtractedContent(undefined as unknown as string, "test-artifact");
      },
      /content is null or undefined/
    );
  });

  it("should throw for non-string content", () => {
    assert.throws(
      () => {
        validateExtractedContent(12345 as unknown as string, "test-artifact");
      },
      /content is not a string/
    );
  });

  it("should include artifact name in error message", () => {
    assert.throws(
      () => {
        validateExtractedContent(null as unknown as string, "my-artifact");
      },
      /my-artifact/
    );
  });
});
