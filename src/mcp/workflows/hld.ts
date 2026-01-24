/**
 * HLD (High-Level Design) Generation Workflow
 * Handles HLD generation from requirements and project configuration
 */

import { CodebaseContext } from '../session/types.js';
import { extractProjectName } from '../utils/project-name.js';
import { generateHLDInstructions as generateInstructions } from '../instructions/hld.js';

export interface HLDGenerationContext {
  requirements: string;
  projectName: string;
  components: {
    websites: number;
    portals: number;
    mobileApps: number;
  };
  erDiagram: string;
  prismaSchema: string;
}

/**
 * Extract HLD generation context from codebase
 */
export function extractHLDContext(
  codebase: CodebaseContext
): HLDGenerationContext | null {
  const requirementsFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/requirements\.md/)
  );
  const erDiagramFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/er-diagram\.md/)
  );
  const prismaSchemaFile = codebase.files.find((f) =>
    f.path.includes("prisma/schema.prisma")
  );

  if (!requirementsFile) {
    return null;
  }

  const projectName = extractProjectName(codebase);
  const requirements = requirementsFile.content;

  // Parse requirements to determine components
  const components = {
    websites: (requirements.match(/website/gi) || []).length,
    portals: (requirements.match(/portal|dashboard/gi) || []).length,
    mobileApps: (requirements.match(/mobile app|ios|android/gi) || []).length,
  };

  return {
    requirements,
    projectName,
    components,
    erDiagram: erDiagramFile?.content || "",
    prismaSchema: prismaSchemaFile?.content || "",
  };
}

/**
 * Generate HLD instructions for Cursor
 */
export function generateHLDInstructions(context: HLDGenerationContext): string {
  return generateInstructions({
    projectName: context.projectName,
    components: context.components,
    requirements: context.requirements,
  });
}

/**
 * Validate HLD generation prerequisites
 */
export function validateHLDPrerequisites(codebase: CodebaseContext): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  const hasRequirements = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/) &&
      f.content.trim().length > 0
  );

  if (!hasRequirements) missing.push("requirements");

  return {
    valid: missing.length === 0,
    missing,
  };
}
