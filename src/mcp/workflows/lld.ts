/**
 * Quikim - LLD (Low-Level Design) Generation Workflow
 * Handles LLD generation from HLD and requirements
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { CodebaseContext } from "../session/types.js";
import { extractProjectName } from "../utils/project-name.js";
import {
  LLDContext,
  LLDComponentType,
  generateLLDInstructions as generateInstructions,
} from "../instructions/lld.js";

export interface LLDGenerationContext {
  requirements: string;
  hldContent: string;
  projectName: string;
  componentName: string;
  componentType: LLDComponentType;
  existingLLDs: Array<{
    name: string;
    type: LLDComponentType;
    filePath: string;
    content: string;
  }>;
}

export interface LLDFileInfo {
  name: string;
  type: LLDComponentType;
  filePath: string;
  content: string;
  version: number;
}

/**
 * Extract LLD generation context from codebase
 */
export function extractLLDContext(
  codebase: CodebaseContext,
  componentName?: string
): LLDGenerationContext | null {
  const requirementsFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/requirements\.md/)
  );
  const hldFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/hld\.md/)
  );

  if (!requirementsFile) {
    return null;
  }

  const projectName = extractProjectName(codebase);
  const requirements = requirementsFile.content;
  const hldContent = hldFile?.content || "";

  // Find existing LLD files
  const existingLLDs = extractExistingLLDs(codebase);

  // Determine component type from name or HLD content
  const componentType = componentName
    ? inferComponentType(componentName, hldContent)
    : "other";

  return {
    requirements,
    hldContent,
    projectName,
    componentName: componentName || "",
    componentType,
    existingLLDs,
  };
}

/**
 * Extract all existing LLD files from codebase
 */
export function extractExistingLLDs(codebase: CodebaseContext): LLDFileInfo[] {
  const lldFiles = codebase.files.filter((f) =>
    f.path.match(/\.quikim\/v\d+\/lld\/.*\.md$/)
  );

  return lldFiles.map((file) => {
    const nameMatch = file.path.match(/\/lld\/(.+)\.md$/);
    const versionMatch = file.path.match(/\/v(\d+)\//);
    const name = nameMatch ? nameMatch[1] : "unknown";
    const version = versionMatch ? parseInt(versionMatch[1], 10) : 1;

    return {
      name,
      type: inferComponentTypeFromContent(file.content),
      filePath: file.path,
      content: file.content,
      version,
    };
  });
}

/**
 * Infer component type from component name and HLD content
 */
export function inferComponentType(
  componentName: string,
  hldContent: string
): LLDComponentType {
  const nameLower = componentName.toLowerCase();

  // Check name patterns first
  if (nameLower.includes("service") || nameLower.includes("svc")) {
    return "service";
  }
  if (nameLower.includes("api") || nameLower.includes("endpoint")) {
    return "api";
  }
  if (
    nameLower.includes("ui") ||
    nameLower.includes("component") ||
    nameLower.includes("page") ||
    nameLower.includes("view")
  ) {
    return "ui";
  }
  if (
    nameLower.includes("db") ||
    nameLower.includes("database") ||
    nameLower.includes("repository") ||
    nameLower.includes("model")
  ) {
    return "database";
  }
  if (nameLower.includes("module") || nameLower.includes("lib")) {
    return "module";
  }
  if (nameLower.includes("feature")) {
    return "feature";
  }

  // Check HLD context for the component
  const componentSection = extractHLDSection(hldContent, componentName);
  if (componentSection) {
    if (componentSection.includes("REST") || componentSection.includes("GraphQL")) {
      return "api";
    }
    if (componentSection.includes("React") || componentSection.includes("component")) {
      return "ui";
    }
    if (componentSection.includes("Prisma") || componentSection.includes("database")) {
      return "database";
    }
  }

  return "other";
}

/**
 * Infer component type from LLD file content
 */
function inferComponentTypeFromContent(content: string): LLDComponentType {
  const contentLower = content.toLowerCase();

  if (contentLower.includes("service overview") || contentLower.includes("service-specific")) {
    return "service";
  }
  if (contentLower.includes("api-specific") || contentLower.includes("endpoint definitions")) {
    return "api";
  }
  if (contentLower.includes("ui component") || contentLower.includes("props interface")) {
    return "ui";
  }
  if (contentLower.includes("database-specific") || contentLower.includes("table schema")) {
    return "database";
  }
  if (contentLower.includes("module-specific") || contentLower.includes("module exports")) {
    return "module";
  }
  if (contentLower.includes("feature-specific") || contentLower.includes("feature flag")) {
    return "feature";
  }

  return "other";
}

/**
 * Extract a specific section from HLD content related to component
 */
function extractHLDSection(hldContent: string, componentName: string): string | null {
  if (!hldContent || !componentName) {
    return null;
  }

  const lines = hldContent.split("\n");
  const nameLower = componentName.toLowerCase();
  let capturing = false;
  let section: string[] = [];
  let headerLevel = 0;

  for (const line of lines) {
    // Check if this is a header containing the component name
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const currentLevel = headerMatch[1].length;
      const headerText = headerMatch[2].toLowerCase();

      if (headerText.includes(nameLower)) {
        capturing = true;
        headerLevel = currentLevel;
        section = [line];
        continue;
      }

      // Stop capturing if we hit a header of same or higher level
      if (capturing && currentLevel <= headerLevel) {
        break;
      }
    }

    if (capturing) {
      section.push(line);
    }
  }

  return section.length > 0 ? section.join("\n") : null;
}

/**
 * Generate LLD instructions for Cursor
 */
export function generateLLDInstructions(context: LLDGenerationContext): string {
  const lldContext: LLDContext = {
    projectName: context.projectName,
    componentName: context.componentName,
    componentType: context.componentType,
    hldContent: extractHLDSection(context.hldContent, context.componentName) || "",
    requirements: context.requirements,
    existingLLDs: context.existingLLDs.map((lld) => ({
      name: lld.name,
      type: lld.type,
    })),
  };

  return generateInstructions(lldContext);
}

/**
 * Validate LLD generation prerequisites
 */
export function validateLLDPrerequisites(codebase: CodebaseContext): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const hasRequirements = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/) &&
      f.content.trim().length > 0
  );

  if (!hasRequirements) {
    missing.push("requirements");
  }

  const hasHLD = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/hld\.md/) &&
      f.content.trim().length > 0
  );

  if (!hasHLD) {
    warnings.push("HLD not found - LLD will be created without HLD reference");
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get LLD file path for a component
 */
export function getLLDFilePath(
  version: number,
  componentName: string
): string {
  const kebabName = componentName
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

  return `.quikim/v${version}/lld/${kebabName}.md`;
}

/**
 * Format LLD content for markdown file
 */
export function formatLLDForMarkdown(
  content: string,
  componentName: string,
  componentType: LLDComponentType
): string {
  return `# Low-Level Design: ${componentName}

**Component Type:** ${componentType}
**Generated:** ${new Date().toISOString()}

---

${content}`;
}

/**
 * Parse component name from user prompt
 */
export function parseComponentFromPrompt(prompt: string): {
  componentName: string | null;
  componentType: LLDComponentType | null;
} {
  // Match patterns like "LLD for auth service", "authentication module LLD"
  const patterns = [
    /(?:lld|low.level.design)\s+(?:for|of)\s+(?:the\s+)?([a-z0-9\-_\s]+?)(?:\s+(?:service|module|feature|api|component|ui))?$/i,
    /([a-z0-9\-_\s]+?)\s+(?:service|module|feature|api|component|ui)?\s*(?:lld|low.level.design)/i,
    /create\s+(?:lld|low.level.design)\s+(?:for\s+)?([a-z0-9\-_\s]+)/i,
    /generate\s+(?:lld|low.level.design)\s+(?:for\s+)?([a-z0-9\-_\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const componentName = match[1].trim();
      const typeMatch = prompt.match(
        /\b(service|module|feature|api|component|ui|database)\b/i
      );
      const componentType = typeMatch
        ? (typeMatch[1].toLowerCase() as LLDComponentType)
        : null;

      return { componentName, componentType };
    }
  }

  return { componentName: null, componentType: null };
}

/**
 * List suggested components that need LLDs based on HLD
 */
export function suggestComponentsForLLD(hldContent: string): Array<{
  name: string;
  type: LLDComponentType;
  reason: string;
}> {
  const suggestions: Array<{
    name: string;
    type: LLDComponentType;
    reason: string;
  }> = [];

  // Look for service mentions
  const serviceMatches = hldContent.match(/([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s*(?:Service|Svc)/g);
  if (serviceMatches) {
    serviceMatches.forEach((match) => {
      const name = match.replace(/\s+/g, "");
      if (!suggestions.find((s) => s.name === name)) {
        suggestions.push({
          name,
          type: "service",
          reason: "Identified as a service in HLD",
        });
      }
    });
  }

  // Look for API/endpoint mentions
  const apiMatches = hldContent.match(/([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s*(?:API|Endpoint|Controller)/gi);
  if (apiMatches) {
    apiMatches.forEach((match) => {
      const name = match.replace(/\s+/g, "");
      if (!suggestions.find((s) => s.name === name)) {
        suggestions.push({
          name,
          type: "api",
          reason: "Identified as an API endpoint in HLD",
        });
      }
    });
  }

  // Look for module mentions
  const moduleMatches = hldContent.match(/([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s*(?:Module|Library)/gi);
  if (moduleMatches) {
    moduleMatches.forEach((match) => {
      const name = match.replace(/\s+/g, "");
      if (!suggestions.find((s) => s.name === name)) {
        suggestions.push({
          name,
          type: "module",
          reason: "Identified as a module in HLD",
        });
      }
    });
  }

  return suggestions;
}
