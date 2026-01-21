/**
 * Project Context Resolver
 * Extracts project ID and organization context from codebase or MCP session
 */

import { CodebaseContext } from '../session/types.js';
import { logger } from '../utils/logger.js';

export interface ProjectContext {
  projectId?: string;
  organizationId?: string;
  userId?: string;
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
        const projectData = JSON.parse(projectFile.content);
        return {
          projectId: projectData.projectId,
          organizationId: projectData.organizationId,
          userId: projectData.userId,
          latestVersion: projectData.latestVersion,
        };
      } catch (error) {
        logger.warn("Failed to parse project.json", { error });
      }
    }

    // Extract version from .quikim/v*/ paths
    const versionDirs = codebase.files
      .map((f) => {
        const match = f.path.match(/\.quikim\/v(\d+)\//);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((v): v is number => v !== null);

    const latestVersion =
      versionDirs.length > 0 ? Math.max(...versionDirs) : undefined;

    return {
      latestVersion,
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
   * Get latest version number from codebase
   */
  getLatestVersion(codebase: CodebaseContext): number {
    const versionDirs = codebase.files
      .map((f) => {
        const match = f.path.match(/\.quikim\/v(\d+)\//);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((v): v is number => v !== null);

    return versionDirs.length > 0 ? Math.max(...versionDirs) : 0;
  }
}

export const projectContextResolver = new ProjectContextResolver();
