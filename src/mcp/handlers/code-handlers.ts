/**
 * Code Handlers
 * Update code and pull rules handlers
 */

import { XMLResponse } from '../types.js';
import { CodebaseContext } from '../session/types.js';
import { ProjectContext } from '../services/project-context.js';
import { generateCodeImplementationInstructions } from '../instructions/code.js';
import { extractProjectName } from '../utils/project-name.js';
import { generateCodeImplementationMissingInstructions } from '../instructions/tool-responses.js';
import { BaseHandler } from './base-handler.js';
import { codeGuidelinesService } from '../services/code-guidelines.js';
import { logger } from '../utils/logger.js';

export class CodeHandlers extends BaseHandler {
  /**
   * Update Code - Use RAG pipeline to find relevant snippets and provide guidelines
   */
  async handleUpdateCode(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    const requirementsFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/)
    );
    const hldFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/hld\.md/)
    );
    const tasksFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/tasks\.md/)
    );

    if (!requirementsFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateCodeImplementationMissingInstructions([
          "requirements",
        ]),
        parameters: {
          filePath: ".quikim/v1/requirements.md",
          content: "# Requirements\n\n[To be created]",
        },
        reasoning: "Prerequisites missing",
        finalResponse:
          "Please create requirements first using pull_requirements tool.",
      };
      return this.formatToolResponse(response);
    }

    if (!hldFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateCodeImplementationMissingInstructions(["hld"]),
        parameters: {
          filePath: ".quikim/v1/hld.md",
          content: "# High-Level Design\n\n[To be created]",
        },
        reasoning: "Prerequisites missing",
        finalResponse: "Please create HLD first using pull_hld tool.",
      };
      return this.formatToolResponse(response);
    }

    // Fetch code guidelines
    let codeGuidelines: string[] = [];
    if (projectContext.projectId) {
      try {
        const guidelines = await codeGuidelinesService.getGuidelines(
          projectContext.projectId,
          projectContext.organizationId,
          projectContext.userId
        );
        codeGuidelines = guidelines.guidelines;
      } catch (error) {
        logger.warn("Failed to fetch code guidelines", { error });
      }
    }

    // Use RAG pipeline to find relevant code snippets
    let sampleSnippets: any[] = [];
    if (projectContext.projectId || projectContext.organizationId) {
      try {
        sampleSnippets = await this.ragService.searchSnippets({
          query: userPrompt,
          projectId: projectContext.projectId,
          organizationId: projectContext.organizationId,
          limit: 10,
        });
      } catch (error) {
        logger.warn("RAG search failed", { error });
      }
    }

    // Fetch components
    let components: any[] = [];
    if (projectContext.organizationId) {
      try {
        components = await this.apiClient.searchComponents(
          userPrompt,
          projectContext.organizationId,
          5
        );
      } catch (error) {
        logger.warn("Failed to fetch components", { error });
      }
    }

    const projectName = extractProjectName(codebase);
    const codeInstructions = generateCodeImplementationInstructions({
      projectName,
      userPrompt,
      requirementsPath: requirementsFile.path,
      hldPath: hldFile.path,
      tasksPath: tasksFile?.path,
      codeGuidelines: codeGuidelines.length > 0 ? codeGuidelines : undefined,
      sampleSnippets: sampleSnippets.length > 0 ? sampleSnippets : undefined,
      components:
        components.length > 0
          ? components.map((c) => ({
              name: c.name,
              description: c.description || c.name,
              code: c.code,
            }))
          : undefined,
    });

    const response: XMLResponse = {
      requestId,
      action: "modify_file",
      instructions: codeInstructions,
      parameters: { filePath: "", content: "" },
      reasoning:
        "Providing code implementation instructions with guidelines and snippets",
      finalResponse:
        "Please implement the code following the provided instructions.",
      quikimFiles: tasksFile
        ? [{ path: tasksFile.path, content: tasksFile.content }]
        : [],
      codeGuidelines: codeGuidelines.length > 0 ? codeGuidelines : undefined,
      sampleSnippets: sampleSnippets.length > 0 ? sampleSnippets : undefined,
    };
    return this.formatToolResponse(response);
  }

  /**
   * Pull Rules - Get Quikim cursor rules
   */
  async handlePullRules(
    _codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    // Fetch code guidelines
    let codeGuidelines: string[] = [];
    if (projectContext.projectId) {
      try {
        const guidelines = await codeGuidelinesService.getGuidelines(
          projectContext.projectId,
          projectContext.organizationId,
          projectContext.userId
        );
        codeGuidelines = guidelines.guidelines;
      } catch (error) {
        logger.warn("Failed to fetch code guidelines", { error });
      }
    }

    const rulesContent =
      codeGuidelines.length > 0
        ? `# Quikim Code Guidelines\n\n${codeGuidelines.join("\n\n")}`
        : "# Quikim Code Guidelines\n\nNo custom guidelines configured. Using default best practices.";

    const response: XMLResponse = {
      requestId,
      action: "create_file",
      instructions: "Save the Quikim cursor rules to .cursor/rules/quikim.mdc",
      parameters: {
        filePath: ".cursor/rules/quikim.mdc",
        content: rulesContent,
      },
      reasoning: "Providing Quikim cursor rules",
      finalResponse: "Quikim cursor rules have been retrieved.",
      codeGuidelines,
    };
    return this.formatToolResponse(response);
  }
}
