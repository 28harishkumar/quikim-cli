/**
 * Prisma Schema Generation Workflow
 * Handles Prisma schema generation from ER diagram
 */

import { CodebaseContext } from '../session/types.js';
import { extractProjectName } from '../utils/project-name.js';
import { generatePrismaSchemaInstructions as generateInstructions } from '../instructions/prisma-schema.js';

export interface PrismaSchemaGenerationContext {
  erDiagram: string;
  projectName: string;
  databaseType: string;
}

/**
 * Extract Prisma schema generation context from codebase
 */
export function extractPrismaSchemaContext(
  codebase: CodebaseContext
): PrismaSchemaGenerationContext | null {
  const erDiagramFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/er-diagram\.md/)
  );

  if (!erDiagramFile) {
    return null;
  }

  const projectName = extractProjectName(codebase);

  // Determine database type from HLD or default to PostgreSQL
  const hldFile = codebase.files.find((f) =>
    f.path.match(/\.quikim\/v\d+\/hld\.md/)
  );
  let databaseType = "postgresql";

  if (hldFile) {
    const hldContent = hldFile.content.toLowerCase();
    if (hldContent.includes("mysql")) {
      databaseType = "mysql";
    } else if (hldContent.includes("mongodb")) {
      databaseType = "mongodb";
    } else if (hldContent.includes("sqlite")) {
      databaseType = "sqlite";
    }
  }

  return {
    erDiagram: erDiagramFile.content,
    projectName,
    databaseType,
  };
}

/**
 * Generate Prisma schema instructions for Cursor
 */
export function generatePrismaSchemaInstructions(
  context: PrismaSchemaGenerationContext,
  codebase?: CodebaseContext
): string {
  // Determine Prisma schema location from project structure
  let projectStructure: any = {};
  if (codebase) {
    const prismaSchemaFile = codebase.files.find(
      (f) =>
        f.path.includes("prisma/schema.prisma") ||
        f.path.includes("schema.prisma")
    );
    const prismaDir = codebase.files.find((f) => f.path.includes("prisma/"));

    projectStructure = {
      rootPath:
        codebase.projectStructure?.rootPath || extractProjectName(codebase),
      hasPrisma: !!prismaDir || !!prismaSchemaFile,
      prismaPath: prismaSchemaFile
        ? prismaSchemaFile.path
        : prismaDir
        ? "prisma/schema.prisma"
        : undefined,
    };
  }

  return generateInstructions({
    projectName: context.projectName,
    databaseType: context.databaseType,
    projectStructure:
      Object.keys(projectStructure).length > 0 ? projectStructure : undefined,
  });
}

/**
 * Validate Prisma schema generation prerequisites
 */
export function validatePrismaSchemaPrerequisites(codebase: CodebaseContext): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  const hasERDiagram = codebase.files.some(
    (f) =>
      f.path.match(/\.quikim\/v\d+\/er-diagram\.md/) &&
      f.content.trim().length > 0
  );

  if (!hasERDiagram) missing.push("er-diagram");

  return {
    valid: missing.length === 0,
    missing,
  };
}
