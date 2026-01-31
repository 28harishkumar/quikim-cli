/**
 * Quikim - Content Extractor Utility
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Content field formats that may be returned from different API endpoints
 */
type ContentFormat = 
  | string 
  | { text: string } 
  | { content: string }
  | Record<string, unknown>
  | unknown;

/**
 * Artifact type for content preparation
 */
export type ArtifactType = 
  | "requirement" 
  | "hld" 
  | "lld" 
  | "context" 
  | "code_guideline" 
  | "wireframe_files" 
  | "flow_diagram" 
  | "er_diagram" 
  | "tasks"
  | "tests";

/**
 * Extract content from various artifact formats
 * Handles different content field formats from various API endpoints:
 * - String content: returned as-is
 * - Object with text property: extracts text value
 * - Object with content property: extracts content value
 * - JSON object: stringified for local storage
 * 
 * @param artifact - The artifact object from the server
 * @returns Extracted content as string
 */
export function extractContent(artifact: { content?: ContentFormat } | { content: unknown }): string {
  if (!artifact || artifact.content === undefined || artifact.content === null) {
    return "";
  }

  const content = artifact.content;

  // Handle string content (most common case)
  if (typeof content === "string") {
    return content;
  }

  // Handle object with text property
  if (typeof content === "object" && content !== null && "text" in content) {
    const textValue = (content as { text: unknown }).text;
    return typeof textValue === "string" ? textValue : String(textValue);
  }

  // Handle object with content property (nested content)
  if (typeof content === "object" && content !== null && "content" in content) {
    const contentValue = (content as { content: unknown }).content;
    return typeof contentValue === "string" ? contentValue : String(contentValue);
  }

  // Handle JSON content - stringify for local storage
  if (typeof content === "object" && content !== null) {
    try {
      return JSON.stringify(content, null, 2);
    } catch (error) {
      // If JSON.stringify fails, convert to string
      return String(content);
    }
  }

  // Fallback: convert to string
  return String(content);
}

/**
 * Prepare content for pushing to server
 * Converts content to the format expected by the API endpoint
 * 
 * @param content - The content string to prepare
 * @param artifactType - The type of artifact being pushed
 * @returns Content in the format expected by the server API
 */
export function prepareContentForPush(
  content: string,
  artifactType: ArtifactType
): string | { content: string; format: string } {
  // Send content as string; requirements and tasks send markdown as-is (no conversion).

  switch (artifactType) {
    case "requirement":
    case "hld":
    case "lld":
    case "context":
    case "code_guideline":
    case "tests":
      return content;

    case "wireframe_files":
      // Wireframes may expect JSON format
      try {
        // Try to parse as JSON if it looks like JSON
        if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
          JSON.parse(content); // Validate JSON
          return content; // Return as string, server will parse
        }
      } catch {
        // Not valid JSON, return as-is
      }
      return content;

    case "flow_diagram":
    case "er_diagram":
      return content;

    case "tasks":
      // Tasks are handled separately by TaskFileManager
      // This shouldn't be called for tasks, but return as-is if it is
      return content;

    default:
      // Default: return content as-is
      return content;
  }
}

/**
 * Check if content is in a specific format
 * 
 * @param content - The content to check
 * @returns Object indicating the detected format
 */
export function detectContentFormat(content: ContentFormat): {
  isString: boolean;
  isObjectWithText: boolean;
  isObjectWithContent: boolean;
  isJSON: boolean;
} {
  return {
    isString: typeof content === "string",
    isObjectWithText: 
      typeof content === "object" && 
      content !== null && 
      "text" in content,
    isObjectWithContent: 
      typeof content === "object" && 
      content !== null && 
      "content" in content,
    isJSON: 
      typeof content === "object" && 
      content !== null && 
      !("text" in content) && 
      !("content" in content),
  };
}

/**
 * Validate that content was extracted successfully
 * 
 * @param content - The extracted content
 * @param artifactName - Name of the artifact for error messages
 * @throws Error if content is invalid
 */
export function validateExtractedContent(
  content: string,
  artifactName: string
): void {
  if (content === undefined || content === null) {
    throw new Error(
      `Failed to extract content for artifact: ${artifactName} - content is null or undefined`
    );
  }

  if (typeof content !== "string") {
    throw new Error(
      `Failed to extract content for artifact: ${artifactName} - content is not a string (type: ${typeof content})`
    );
  }
}
