/**
 * Quikim - Content Extraction Utilities
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { ArtifactType, FileContent, ProjectData } from "../types/handler-types.js";
import { getQuikimProjectRoot } from "../../config/project-root.js";

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
   * Get spec name from an artifact file path.
   * Path format: .quikim/artifacts/<spec name>/<artifact file>
   * @param filePath - Path like .quikim/artifacts/my-spec/requirement_main.md
   * @returns Spec name or null if path does not match
   */
  static getSpecNameFromPath(filePath: string): string | null {
    if (!filePath.startsWith(".quikim/artifacts/")) return null;
    const parts = filePath.split("/");
    if (parts.length >= 3 && parts[0] === ".quikim" && parts[1] === "artifacts") {
      return parts[2];
    }
    return null;
  }

  /**
   * Get spec name from first artifact path in codebase.
   * Path format: .quikim/artifacts/<spec name>/<artifact file>
   */
  static getSpecNameFromCodebase(codebase: CodebaseContext): string | null {
    const match = codebase.files.find((f) => f.path.startsWith(".quikim/artifacts/"));
    if (!match) return null;
    return this.getSpecNameFromPath(match.path);
  }

  /**
   * Get spec name from the first file matching the given artifact type.
   * Use this when pushing so the spec comes from the file being pushed.
   * @param codebase - Codebase context with files
   * @param artifactType - Artifact type (requirements, hld, etc.)
   * @returns Spec name from matching file path, or null
   */
  static getSpecNameFromMatchingFile(
    codebase: CodebaseContext,
    artifactType: ArtifactType
  ): string | null {
    const pattern = this.getPathPattern(artifactType);
    const match = codebase.files.find((f) => pattern.test(f.path));
    if (!match) return null;
    return this.getSpecNameFromPath(match.path);
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
   * Extract file content and artifact name from first matching file.
   * Used for local-first push: save with this name, then sync to server in background.
   * @param codebase - Codebase context with files
   * @param artifactType - Artifact type (requirements, hld, etc.)
   * @returns { content, artifactName } or null if no matching file
   */
  static extractFileContentAndName(
    codebase: CodebaseContext,
    artifactType: ArtifactType
  ): { content: string; artifactName: string } | null {
    const pathPattern = this.getPathPattern(artifactType);
    const file = codebase.files.find(f => pathPattern.test(f.path));
    if (!file || !("content" in file)) return null;
    const content = this.extractStringContent(file as FileContent);
    const fileName = file.path.split("/").pop() ?? "";
    const base = fileName.replace(/\.md$/, "");
    const prefix = this.getFilePrefixForType(artifactType);
    const artifactName = base.startsWith(prefix) ? base.slice(prefix.length) : base || "main";
    return { content, artifactName };
  }

  /** File prefix per artifact type (e.g. requirement_ -> requirement_) */
  private static getFilePrefixForType(artifactType: ArtifactType): string {
    const filePrefixByType: Record<ArtifactType, string> = {
      requirements: "requirement_",
      hld: "hld_",
      lld: "lld_",
      tasks: "tasks_",
      wireframes: "wireframe_files_",
      er_diagram: "er_diagram_",
      mermaid: "flow_diagram_",
      context: "context_",
      code_guideline: "code_guideline_",
    };
    return filePrefixByType[artifactType] ?? "";
  }

  /** Expected file prefix per tool type (mermaid -> flow_diagram, wireframes -> wireframe_files) */
  static getExpectedPathHint(artifactType: ArtifactType): string {
    const filePrefixByType: Record<ArtifactType, string> = {
      requirements: "requirement_",
      hld: "hld_",
      lld: "lld_",
      tasks: "tasks_",
      wireframes: "wireframe_files_",
      er_diagram: "er_diagram_",
      mermaid: "flow_diagram_",
      context: "context_",
      code_guideline: "code_guideline_",
    };
    const prefix = filePrefixByType[artifactType];
    return `.quikim/artifacts/<spec>/${prefix}<id>.md`;
  }

  /**
   * Get path pattern for artifact type.
   * Directory: .quikim/artifacts/<spec name>/<artifact file>
   * File: <artifact_type>_<artifact_id>.md or <artifact_type>_<root_id>.md for versioned.
   */
  static getPathPattern(artifactType: ArtifactType): RegExp {
    const filePrefixByType: Record<ArtifactType, string> = {
      requirements: "requirement_",
      hld: "hld_",
      lld: "lld_",
      tasks: "tasks_",
      wireframes: "wireframe_files_",
      er_diagram: "er_diagram_",
      mermaid: "flow_diagram_",
      context: "context_",
      code_guideline: "code_guideline_",
    };
    const prefix = filePrefixByType[artifactType];
    return new RegExp(
      `^\\.quikim/artifacts/[^/]+/${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^/]+\\.md$`
    );
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
   * Read project.json from disk (e.g. when QUIKIM_PROJECT_DIR is set and codebase does not include it)
   */
  static async readProjectFromDisk(): Promise<ProjectData | null> {
    try {
      const root = getQuikimProjectRoot();
      const path = join(root, ".quikim", "project.json");
      const raw = await readFile(path, "utf-8");
      const data = JSON.parse(raw) as { projectId?: string; organizationId?: string; userId?: string };
      if (data.projectId) {
        return {
          projectId: data.projectId,
          organizationId: data.organizationId,
          userId: data.userId,
        };
      }
    } catch {
      // File missing or invalid
    }
    return null;
  }

  /**
   * Extract project data from contexts, with filesystem fallback when codebase has no .quikim/project.json
   */
  static async extractProjectData(codebase: CodebaseContext, projectContext: ProjectContext): Promise<ProjectData> {
    let projectId = this.extractProjectId(codebase, projectContext);

    const specName = projectContext.specName ?? this.getSpecNameFromCodebase(codebase) ?? "default";

    if (!projectId) {
      const fromDisk = await this.readProjectFromDisk();
      if (fromDisk) {
        return {
          projectId: fromDisk.projectId,
          organizationId: fromDisk.organizationId ?? projectContext.organizationId,
          userId: fromDisk.userId ?? projectContext.userId,
          specName,
        };
      }
      throw new Error("Project ID not found. Make sure .quikim/project.json exists (or set QUIKIM_PROJECT_DIR to your project root).");
    }

    return {
      projectId,
      organizationId: projectContext.organizationId,
      userId: projectContext.userId,
      specName,
    };
  }
}