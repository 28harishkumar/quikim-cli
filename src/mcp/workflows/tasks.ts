/**
 * Tasks Generation Workflow
 * Handles tasks generation from all project artifacts
 */

import { CodebaseContext } from '../session/types.js';
import { extractProjectName } from '../utils/project-name.js';

export interface TasksGenerationContext {
  requirements: string;
  hld: string;
  erDiagram: string;
  wireframes: string;
  projectName: string;
}

/**
 * Extract tasks generation context from codebase
 */
export function extractTasksContext(
  codebase: CodebaseContext
): TasksGenerationContext | null {
  const requirementsFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/requirements\.md/)
  );
  const hldFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/hld\.md/)
  );
  const erDiagramFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/er-diagram\.md/)
  );
  const wireframesFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/wireframes\.md/)
  );

  if (!requirementsFile || !hldFile || !erDiagramFile) {
    return null;
  }

  const projectName = extractProjectName(codebase);

  return {
    requirements: requirementsFile.content,
    hld: hldFile.content,
    erDiagram: erDiagramFile.content,
    wireframes: wireframesFile?.content || "",
    projectName,
  };
}

/**
 * Generate tasks instructions for Cursor
 */
export function generateTasksInstructions(
  context: TasksGenerationContext
): string {
  const {
    generateTasksInstructions: generateInstructions,
  } = require("../instructions/tasks");
  return generateInstructions({
    projectName: context.projectName,
    hasWireframes: !!context.wireframes,
  });
}

/**
 * Validate tasks generation prerequisites
 */
export function validateTasksPrerequisites(codebase: CodebaseContext): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  const hasRequirements = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/) &&
      f.content.trim().length > 0
  );
  const hasHLD = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/hld\.md/) && f.content.trim().length > 0
  );
  const hasERDiagram = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/er-diagram\.md/) &&
      f.content.trim().length > 0
  );
  const hasPrismaSchema = codebase.files.some(
    (f) =>
      f.path.includes("prisma/schema.prisma") && f.content.trim().length > 0
  );

  if (!hasRequirements) missing.push("requirements");
  if (!hasHLD) missing.push("hld");
  if (!hasERDiagram) missing.push("er-diagram");
  if (!hasPrismaSchema) missing.push("prisma-schema");

  return {
    valid: missing.length === 0,
    missing,
  };
}
