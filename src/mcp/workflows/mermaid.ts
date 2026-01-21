/**
 * Quikim - Mermaid Diagram Workflow
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { CodebaseContext } from "../session/types.js";
import { extractProjectName } from "../utils/project-name.js";
import { MermaidDiagramType } from "../api/types.js";

export interface MermaidDiagramContext {
  projectName: string;
  diagrams: MermaidDiagramInfo[];
  requirements?: string;
  hld?: string;
}

export interface MermaidDiagramInfo {
  name: string;
  type: MermaidDiagramType;
  content: string;
  filePath: string;
}

/**
 * Detect mermaid diagram type from content
 */
export function detectMermaidDiagramType(content: string): MermaidDiagramType {
  const trimmedContent = content.trim().toLowerCase();
  
  if (trimmedContent.includes("flowchart") || trimmedContent.includes("graph ")) {
    return "flowchart";
  }
  if (trimmedContent.includes("sequencediagram") || trimmedContent.startsWith("sequencediagram")) {
    return "sequence";
  }
  if (trimmedContent.includes("classdiagram")) {
    return "classDiagram";
  }
  if (trimmedContent.includes("statediagram")) {
    return "stateDiagram";
  }
  if (trimmedContent.includes("erdiagram")) {
    return "erDiagram";
  }
  if (trimmedContent.includes("gantt")) {
    return "gantt";
  }
  if (trimmedContent.includes("pie")) {
    return "pie";
  }
  if (trimmedContent.includes("mindmap")) {
    return "mindmap";
  }
  if (trimmedContent.includes("timeline")) {
    return "timeline";
  }
  if (trimmedContent.includes("journey")) {
    return "journey";
  }
  
  return "other";
}

/**
 * Extract mermaid code blocks from markdown content
 */
export function extractMermaidFromMarkdown(content: string): string[] {
  const mermaidBlocks: string[] = [];
  const regex = /```mermaid\s*([\s\S]*?)```/gi;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      mermaidBlocks.push(match[1].trim());
    }
  }
  
  return mermaidBlocks;
}

/**
 * Extract mermaid diagram context from codebase
 */
export function extractMermaidContext(
  codebase: CodebaseContext,
): MermaidDiagramContext | null {
  const projectName = extractProjectName(codebase);
  const diagrams: MermaidDiagramInfo[] = [];
  
  // Find all mermaid diagram files in .quikim directory
  const mermaidFiles = codebase.files.filter((f) =>
    f.path.match(/\.quikim\/v\d+\/diagrams\/.*\.md$/) ||
    f.path.match(/\.quikim\/v\d+\/mermaid\/.*\.md$/)
  );
  
  for (const file of mermaidFiles) {
    const mermaidBlocks = extractMermaidFromMarkdown(file.content);
    
    for (const block of mermaidBlocks) {
      const diagramType = detectMermaidDiagramType(block);
      const fileName = file.path.split("/").pop() || "diagram";
      const name = fileName.replace(/\.md$/, "");
      
      diagrams.push({
        name,
        type: diagramType,
        content: block,
        filePath: file.path,
      });
    }
  }
  
  // Also check HLD and ER diagram files for embedded mermaid
  const hldFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/hld\.md/)
  );
  const erDiagramFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/er-diagram\.md/)
  );
  
  if (hldFile) {
    const hldMermaidBlocks = extractMermaidFromMarkdown(hldFile.content);
    for (let i = 0; i < hldMermaidBlocks.length; i++) {
      const block = hldMermaidBlocks[i];
      if (block) {
        const diagramType = detectMermaidDiagramType(block);
        diagrams.push({
          name: `hld-diagram-${i + 1}`,
          type: diagramType,
          content: block,
          filePath: hldFile.path,
        });
      }
    }
  }
  
  if (erDiagramFile) {
    const erMermaidBlocks = extractMermaidFromMarkdown(erDiagramFile.content);
    for (let i = 0; i < erMermaidBlocks.length; i++) {
      const block = erMermaidBlocks[i];
      if (block) {
        diagrams.push({
          name: `er-diagram-${i + 1}`,
          type: "erDiagram",
          content: block,
          filePath: erDiagramFile.path,
        });
      }
    }
  }
  
  // Get requirements and HLD content for context
  const requirementsFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/requirements\.md/)
  );
  
  return {
    projectName,
    diagrams,
    requirements: requirementsFile?.content,
    hld: hldFile?.content,
  };
}

/**
 * Validate mermaid diagram syntax (basic validation)
 */
export function validateMermaidSyntax(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const trimmed = content.trim();
  
  // Check for common mermaid diagram type declarations
  const validStarts = [
    "flowchart",
    "graph",
    "sequencediagram",
    "classdiagram",
    "statediagram",
    "erdiagram",
    "gantt",
    "pie",
    "mindmap",
    "timeline",
    "journey",
  ];
  
  const lowerContent = trimmed.toLowerCase();
  const hasValidStart = validStarts.some((start) =>
    lowerContent.startsWith(start)
  );
  
  if (!hasValidStart) {
    errors.push("Mermaid diagram must start with a valid diagram type declaration");
  }
  
  // Check for balanced brackets
  const openBrackets = (trimmed.match(/\{/g) || []).length;
  const closeBrackets = (trimmed.match(/\}/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push("Unbalanced curly brackets in diagram");
  }
  
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push("Unbalanced parentheses in diagram");
  }
  
  const openSquare = (trimmed.match(/\[/g) || []).length;
  const closeSquare = (trimmed.match(/\]/g) || []).length;
  if (openSquare !== closeSquare) {
    errors.push("Unbalanced square brackets in diagram");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format mermaid diagram for storage (wrap in markdown code block)
 */
export function formatMermaidForMarkdown(content: string, title?: string): string {
  const lines: string[] = [];
  
  if (title) {
    lines.push(`# ${title}`);
    lines.push("");
  }
  
  lines.push("```mermaid");
  lines.push(content.trim());
  lines.push("```");
  
  return lines.join("\n");
}

/**
 * Get suggested file path for a mermaid diagram
 */
export function getMermaidFilePath(
  version: number,
  diagramType: MermaidDiagramType,
  name: string,
): string {
  const sanitizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  return `.quikim/v${version}/diagrams/${diagramType}-${sanitizedName}.md`;
}
