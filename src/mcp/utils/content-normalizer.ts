/**
 * Quikim - Content Normalizer for MCP Artifacts
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Strips markdown code fences and wrappers so only raw mermaid/ER diagram
 * syntax remains. Server expects raw mermaid; extra data breaks parsing.
 *
 * @param raw - Content that may be wrapped in ```mermaid ... ``` or ``` ... ```
 * @returns Raw diagram syntax only, trimmed
 */
export function normalizeMermaidContent(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.trim();
  // Strip ```mermaid ... ```
  const mermaidFence = /^```\s*mermaid\s*\n?([\s\S]*?)```\s*$/im;
  const match = s.match(mermaidFence);
  if (match) return match[1].trim();
  // Strip generic ``` ... ```
  const genericFence = /^```\s*\w*\n?([\s\S]*?)```\s*$/im;
  const genericMatch = s.match(genericFence);
  if (genericMatch) return genericMatch[1].trim();
  return s;
}
