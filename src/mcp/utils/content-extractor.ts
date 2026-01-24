/**
 * Quikim - Content Extraction Utilities
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { ArtifactType, FileContent, ProjectData } from "../types/handler-types.js";

export class ContentExtractor {
  /**
   * Extract project ID from context or codebase
   */
  static extractProjectId(codebase: CodebaseContext, projectContext: ProjectContext): string | undefined {
    if (projectContext.projectId) {
      return projectContext.projectId;
    }

    const projectFile = codebase.files.find(
      f => f.path === ".quikim/project.json" || f.path.includes(".quikim/project.json")
    );

    if (projectFile) {
      try {
        const contentStr = this.extractStringContent(projectFile as FileContent);
        const data = JSON.parse(contentStr);
        return data.projectId;
      } catch {
        // Ignore parse errors
      }
    }

    return undefined;
  }

  /**
   * Extract string content from various content formats
   */
  static extractStringContent(file: FileContent): string {
    const content = file.content;
    
    if (typeof content === "string") {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content.map((block: unknown) => {
        const blockObj = block as Record<string, unknown>;
        return blockObj.text || "";
      }).join("\n");
    }
    
    if (content && typeof content === "object" && "text" in content) {
      return (content as { text: string }).text;
    }
    
    return "";
  }

  /**
   * Extract file content by path pattern
   */
  static extractFileContent(codebase: CodebaseContext, pathPattern: RegExp): string | null {
    const file = codebase.files.find(f => pathPattern.test(f.path));
    if (file && "content" in file) {
      return this.extractStringContent(file as FileContent);
    }
    return null;
  }

  /**
   * Get path pattern for artifact type
   */
  static getPathPattern(artifactType: ArtifactType): RegExp {
    const patterns: Record<ArtifactType, RegExp> = {
      requirements: /\.quikim\/v\d+\/requirements\.md$/,
      hld: /\.quikim\/v\d+\/hld\.md$/,
      lld: /\.quikim\/v\d+\/lld\/.*\.md$/,
      tasks: /\.quikim\/v\d+\/tasks\.md$/,
      wireframes: /\.quikim\/v\d+\/wireframes\.md$/,
      er_diagram: /\.quikim\/v\d+\/er-diagram\.md$/,
      mermaid: /\.quikim\/v\d+\/mermaid\/.*\.mmd$/,
    };

    return patterns[artifactType];
  }

  /**
   * Build context string from codebase
   */
  static buildContextString(codebase: CodebaseContext): string {
    const fileList = codebase.files
      .map(f => `- ${f.path}`)
      .join("\n");

    return `Codebase context:
Files: ${codebase.files.length}

${fileList}`;
  }

  /**
   * Extract project data from contexts
   */
  static extractProjectData(codebase: CodebaseContext, projectContext: ProjectContext): ProjectData {
    const projectId = this.extractProjectId(codebase, projectContext);
    
    if (!projectId) {
      throw new Error("Project ID not found. Make sure .quikim/project.json exists.");
    }

    return {
      projectId,
      organizationId: projectContext.organizationId,
      userId: projectContext.userId,
    };
  }
}