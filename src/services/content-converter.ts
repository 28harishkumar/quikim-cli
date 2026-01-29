/**
 * Quikim - Content Converter
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import TurndownService from "turndown";
import { marked } from "marked";

/**
 * Content Converter Service
 * Provides bidirectional conversion between HTML and Markdown formats
 */
export class ContentConverter {
  private turndownService: TurndownService;

  constructor() {
    // Configure turndown for HTML → Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
      strongDelimiter: "**",
      hr: "---",
    });

    // Configure marked for Markdown → HTML conversion
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Single newlines become <br> (GFM-style)
      pedantic: false,
    });
  }

  /**
   * Converts HTML content to Markdown format
   * @param html - The HTML string to convert
   * @returns Markdown formatted string
   * @throws Error if conversion fails
   */
  htmlToMarkdown(html: string): string {
    if (!html || typeof html !== "string") {
      return "";
    }

    try {
      // Check if content is actually HTML
      if (!this.isHtmlContent(html)) {
        return html;
      }

      const markdown = this.turndownService.turndown(html);
      return markdown;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to convert HTML to Markdown: ${errorMessage}`);
    }
  }

  /**
   * Converts Markdown content to HTML format
   * @param markdown - The Markdown string to convert
   * @returns HTML formatted string
   * @throws Error if conversion fails
   */
  async markdownToHtml(markdown: string): Promise<string> {
    if (!markdown || typeof markdown !== "string") {
      return "";
    }

    try {
      // Skip conversion if content is already HTML
      if (this.isHtmlContent(markdown)) {
        return markdown;
      }

      // Parse as markdown (plain text with newlines becomes <br> when breaks: true)
      const html = await marked.parse(markdown);
      return html;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to convert Markdown to HTML: ${errorMessage}`);
    }
  }

  /**
   * Checks if content appears to be HTML
   * @param content - The content to check
   * @returns True if content contains HTML tags
   */
  isHtmlContent(content: string): boolean {
    if (!content || typeof content !== "string") {
      return false;
    }

    // Check for common HTML patterns
    const htmlPatterns = [
      /<[a-z][\s\S]*>/i, // Any HTML tag
      /&[a-z]+;/i, // HTML entities
      /&#\d+;/i, // Numeric HTML entities
    ];

    return htmlPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Checks if content appears to be Markdown
   * @param content - The content to check
   * @returns True if content contains Markdown syntax
   */
  isMarkdownContent(content: string): boolean {
    if (!content || typeof content !== "string") {
      return false;
    }

    // Check for common Markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s/m, // Headers
      /\*\*[^*]+\*\*/m, // Bold
      /\*[^*]+\*/m, // Italic
      /\[[^\]]+\]\([^)]+\)/m, // Links
      /^[-*+]\s/m, // Unordered lists
      /^\d+\.\s/m, // Ordered lists
      /```[\s\S]*```/m, // Code blocks
      /`[^`]+`/m, // Inline code
    ];

    return markdownPatterns.some((pattern) => pattern.test(content));
  }
}

/**
 * Singleton instance of ContentConverter
 */
export const contentConverter = new ContentConverter();

/**
 * Converts HTML to Markdown using the singleton instance
 * @param html - The HTML string to convert
 * @returns Markdown formatted string
 */
export function htmlToMarkdown(html: string): string {
  return contentConverter.htmlToMarkdown(html);
}

/**
 * Converts Markdown to HTML using the singleton instance
 * @param markdown - The Markdown string to convert
 * @returns HTML formatted string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  return contentConverter.markdownToHtml(markdown);
}

/**
 * Checks if content appears to be HTML
 * @param content - The content to check
 * @returns True if content contains HTML tags
 */
export function isHtmlContent(content: string): boolean {
  return contentConverter.isHtmlContent(content);
}

/**
 * Checks if content appears to be Markdown
 * @param content - The content to check
 * @returns True if content contains Markdown syntax
 */
export function isMarkdownContent(content: string): boolean {
  return contentConverter.isMarkdownContent(content);
}
