/**
 * Project Context Resolver
 * Extracts project ID, spec name, and organization context from codebase or MCP session
 */

import { CodebaseContext } from "../session/types.js";
import { logger } from "../utils/logger.js";
import { ContentExtractor } from "../utils/content-extractor.js";
import { FileContent } from "../types/handler-types.js";

export interface ProjectContext {
  projectId?: string;
  organizationId?: string;
  userId?: string;
  /** Spec name under .quikim/artifacts/<specName>/ */
  specName?: string;
  latestVersion?: number;
  // Code generation settings
  framework?: string;
  styling?: string;
  typescript?: boolean;
  componentPath?: string;
  pagePath?: string;
}

export class ProjectContextResolver {
  /**
   * Resolve project context from codebase
   * Checks for .quikim/project.json or extracts from file paths
   */
  async resolveFromCodebase(
    codebase: CodebaseContext,
  ): Promise<ProjectContext> {
    // Check for .quikim/project.json file
    const projectFile = codebase.files.find(
      (f) =>
        f.path === ".quikim/project.json" ||
        f.path.includes(".quikim/project.json"),
    );

    if (projectFile) {
      try {
        const contentStr = ContentExtractor.extractStringContent(projectFile as FileContent);
        const projectData = JSON.parse(contentStr) as {
          projectId?: string;
          organizationId?: string;
          userId?: string;
          specName?: string;
          latestVersion?: number;
        };
        const specName =
          projectData.specName ??
          ContentExtractor.getSpecNameFromCodebase(codebase) ??
          "default";
        return {
          projectId: projectData.projectId,
          organizationId: projectData.organizationId,
          userId: projectData.userId,
          specName,
          latestVersion: projectData.latestVersion,
        };
      } catch (error) {
        logger.warn("Failed to parse project.json", { error });
      }
    }

    // Resolve spec name from .quikim/artifacts/<spec>/ paths
    const specName = ContentExtractor.getSpecNameFromCodebase(codebase) ?? "default";

    return {
      specName,
    };
  }

  /**
   * Resolve project context from MCP session token
   * This would be called when session token is available
   */
  async resolveFromSession(
    _sessionToken: string,
  ): Promise<ProjectContext | null> {
    // This would query the database for MCPSession
    // For now, return null - implementation depends on auth setup
    logger.warn("Session-based context resolution not yet implemented");
    return null;
  }

  /**
   * Get default spec name from codebase (first artifact path or "default")
   */
  getDefaultSpecName(codebase: CodebaseContext): string {
    return ContentExtractor.getSpecNameFromCodebase(codebase) ?? "default";
  }
}

export const projectContextResolver = new ProjectContextResolver();
