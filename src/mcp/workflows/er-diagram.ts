/**
 * ER Diagram Generation Workflow
 * Handles ER diagram generation from requirements and wireframes
 */

import { CodebaseContext } from '../session/types.js';
import { extractProjectName } from '../utils/project-name.js';

export interface ERDiagramGenerationContext {
  requirements: string;
  wireframes: string;
  projectName: string;
}

/**
 * Extract ER diagram generation context from codebase
 */
export function extractERDiagramContext(
  codebase: CodebaseContext
): ERDiagramGenerationContext | null {
  const requirementsFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/requirements\.md/)
  );
  const wireframesFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/wireframes\.md/)
  );

  if (!requirementsFile || !wireframesFile) {
    return null;
  }

  const projectName = extractProjectName(codebase);
  const requirements = requirementsFile.content;

  return {
    requirements,
    wireframes: wireframesFile.content,
    projectName,
  };
}

/**
 * Generate ER diagram instructions for Cursor
 * Note: quikimFeatures should be fetched separately and passed directly to instructions
 */
export function generateERDiagramInstructions(
  context: ERDiagramGenerationContext,
  quikimFeatures?: Array<{
    name: string;
    description: string;
    entities?: any[];
  }>
): string {
  const {
    generateERDiagramInstructions: generateInstructions,
  } = require("../instructions/er-diagram");
  return generateInstructions({
    projectName: context.projectName,
    quikimFeatures,
  });
}

/**
 * Validate ER diagram generation prerequisites
 */
export function validateERDiagramPrerequisites(codebase: CodebaseContext): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  const hasRequirements = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/) &&
      f.content.trim().length > 0
  );
  const hasWireframes = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/wireframes\.md/) &&
      f.content.trim().length > 0
  );

  if (!hasRequirements) missing.push("requirements");
  if (!hasWireframes) missing.push("wireframes");

  return {
    valid: missing.length === 0,
    missing,
  };
}
