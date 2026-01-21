/**
 * Wireframe Generation Workflow
 * Handles wireframe generation from requirements
 */

import { CodebaseContext } from '../session/types.js';
import { extractProjectName } from '../utils/project-name.js';

export interface WireframeGenerationContext {
  requirements: string;
  projectName: string;
  components: {
    websites: number;
    portals: number;
    mobileApps: number;
  };
}

/**
 * Extract wireframe generation context from codebase
 */
export function extractWireframeContext(
  codebase: CodebaseContext
): WireframeGenerationContext | null {
  const requirementsFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/requirements\.md/)
  );

  if (!requirementsFile) {
    return null;
  }

  const projectName = extractProjectName(codebase);

  // Parse requirements to determine components
  const requirements = requirementsFile.content;
  const components = {
    websites: (requirements.match(/website/gi) || []).length,
    portals: (requirements.match(/portal|dashboard/gi) || []).length,
    mobileApps: (requirements.match(/mobile app|ios|android/gi) || []).length,
  };

  return {
    requirements,
    projectName,
    components,
  };
}

/**
 * Generate wireframe instructions for Cursor
 */
export function generateWireframeInstructions(
  context: WireframeGenerationContext
): string {
  const {
    generateWireframeInstructions: generateInstructions,
  } = require("../instructions/wireframes");
  return generateInstructions({
    projectName: context.projectName,
    components: context.components,
  });
}

/**
 * Validate wireframe generation prerequisites
 */
export function validateWireframePrerequisites(codebase: CodebaseContext): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  const hasRequirements = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/) &&
      f.content.trim().length > 0
  );

  if (!hasRequirements) {
    missing.push("requirements");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
