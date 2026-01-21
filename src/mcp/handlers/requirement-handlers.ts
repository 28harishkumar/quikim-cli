/**
 * Requirement Handlers
 * Push and pull handlers for requirements
 */

import { XMLResponse } from '../types.js';
import { CodebaseContext } from '../session/types.js';
import { ProjectContext, projectContextResolver } from '../services/project-context.js';
import { RequirementHandler } from '../workflows/requirement-handler.js';
import {
  generateRequirementsMissingInstructions,
  generateArtifactSyncedInstructions,
  generateProjectContextInstructions,
  generateSyncFailureInstructions,
} from '../instructions/tool-responses.js';
import { BaseHandler } from './base-handler.js';
import { QuikimAPIClient } from '../api/client.js';
import { XMLProtocolParser } from '../xml/parser.js';
import { RAGService } from '../services/rag.js';
import { logger } from '../utils/logger.js';

export class RequirementHandlers extends BaseHandler {
  constructor(
    private requirementHandler: RequirementHandler,
    apiClient: QuikimAPIClient,
    xmlParser: XMLProtocolParser,
    ragService: RAGService
  ) {
    super(apiClient, xmlParser, ragService);
  }

  /**
   * Push Requirements - Sync local requirements to server
   */
  async handlePushRequirements(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();
    const requirementsFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/)
    );

    if (!requirementsFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateRequirementsMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/requirements.md",
          content: "# Requirements\n\n[To be created]",
        },
        reasoning: "Requirements file missing",
        finalResponse: "Please create requirements using pull_requirements tool first.",
      };
      return this.formatToolResponse(response);
    }

    if (!projectContext.projectId) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateProjectContextInstructions(),
        parameters: {
          filePath: ".quikim/project.json",
          content: JSON.stringify({ projectId: "", organizationId: "" }, null, 2),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context in .quikim/project.json first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      await this.apiClient.syncArtifact({
        projectId: projectContext.projectId,
        artifactType: "requirements",
        content: requirementsFile.content,
      });

      logger.info("Requirements synced to platform", { projectId: projectContext.projectId });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateArtifactSyncedInstructions("Requirements", requirementsFile.path),
        parameters: {},
        reasoning: "Requirements synchronized to database",
        finalResponse: `Requirements from ${requirementsFile.path} have been successfully synced.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync requirements", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions("requirements", (error as Error).message),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to sync requirements. Please check your API configuration.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Pull Requirements - Fetch from server or generate new
   */
  async handlePullRequirements(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();
    const existingRequirements = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/)
    );
    const latestVersion = projectContext.latestVersion || projectContextResolver.getLatestVersion(codebase);
    const isCreate = !existingRequirements;

    // Try to fetch from platform first
    if (projectContext.projectId && !isCreate) {
      try {
        const platformRequirements = await this.apiClient.fetchRequirements(projectContext.projectId);
        if (platformRequirements) {
          const newVersion = platformRequirements.version;
          const filePath = `.quikim/v${newVersion}/requirements.md`;

          const response: XMLResponse = {
            requestId,
            action: "create_file",
            instructions: `Update requirements from platform (v${newVersion}).`,
            parameters: {
              filePath,
              content:
                typeof platformRequirements.content === "string"
                  ? platformRequirements.content
                  : JSON.stringify(platformRequirements.content, null, 2),
            },
            reasoning: "Fetched requirements from platform",
            finalResponse: `Requirements v${newVersion} fetched from platform.`,
            quikimFiles: [{ path: filePath, content: typeof platformRequirements.content === "string" ? platformRequirements.content : JSON.stringify(platformRequirements.content, null, 2) }],
          };
          return this.formatToolResponse(response);
        }
      } catch (error) {
        logger.warn("Failed to fetch requirements from platform", { error });
      }
    }

    // Generate requirements locally
    let response: XMLResponse;
    if (isCreate) {
      const analysis = {
        workflow_type: "requirement_create",
        requested_artifact: "requirements",
        is_create: true,
        is_new_project: true,
        has_quikim_directory: false,
        existing_artifact_versions: [],
        latest_version: null,
        artifacts_in_latest_version: [],
      } as any;

      response = this.requirementHandler.handleCreate(userPrompt, analysis, requestId);
    } else {
      const analysis = {
        workflow_type: "requirement_update",
        requested_artifact: "requirements",
        is_create: false,
        is_new_project: false,
        has_quikim_directory: true,
        existing_artifact_versions: [],
        latest_version: latestVersion,
        artifacts_in_latest_version: ["requirements"],
      } as any;

      response = this.requirementHandler.handleUpdate(userPrompt, analysis, codebase, requestId);
    }

    return this.formatToolResponse(response);
  }
}
