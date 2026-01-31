/**
 * Quikim - Content Normalizer
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { createHash } from "crypto";

/**
 * Strips all HTML tags from the given HTML string
 * @param html - The HTML string to strip tags from
 * @returns Plain text without HTML tags
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Remove HTML tags using regex
  // This handles nested tags, self-closing tags, and tags with attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ") // Remove script tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ") // Remove style tags and content
    .replace(/<[^>]+>/g, " ") // Remove all other HTML tags, replace with space
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .replace(/&lt;/g, "<") // Replace &lt; with <
    .replace(/&gt;/g, ">") // Replace &gt; with >
    .replace(/&amp;/g, "&") // Replace &amp; with &
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/&[a-z]+;/gi, ""); // Remove other HTML entities
}

/**
 * Strips one layer of leading/trailing double-quotes if content looks double-encoded.
 * E.g. "\"<p>...</p>\"" becomes "<p>...</p>". Used when server or storage wraps content in extra quotes.
 * @param content - The content that may be wrapped in quotes
 * @returns Content with outer quotes removed if present
 */
export function stripWrappedQuotes(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }
  const trimmed = content.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  return content;
}

/**
 * Collapses multiple whitespace characters into single spaces
 * @param text - The text to collapse whitespace in
 * @returns Text with collapsed whitespace
 */
export function collapseWhitespace(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\s+/g, " ") // Replace multiple whitespace with single space
    .trim(); // Remove leading and trailing whitespace
}

/**
 * Normalizes content for comparison by stripping HTML tags,
 * collapsing whitespace, and converting to lowercase
 * @param content - The content to normalize
 * @returns Normalized content string
 */
export function normalizeForComparison(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // Strip HTML tags
  let normalized = stripHtmlTags(content);

  // Collapse whitespace
  normalized = collapseWhitespace(normalized);

  // Convert to lowercase for case-insensitive comparison
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Computes a SHA-256 hash of the given content
 * @param content - The content to hash
 * @returns Hexadecimal hash string
 */
export function computeContentHash(content: string): string {
  if (!content || typeof content !== "string") {
    return createHash("sha256").update("").digest("hex");
  }

  // Normalize content before hashing for consistent comparison
  const normalized = normalizeForComparison(content);

  return createHash("sha256").update(normalized).digest("hex");
}
