/**
 * Quikim - Base Handler Class
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { ServiceAwareAPIClient } from "../api/service-client.js";
import { AIAgent } from "../agent/index.js";
import { APIService } from "../services/api-service.js";
import { ContentExtractor } from "../utils/content-extractor.js";
import { ResponseFormatter } from "../utils/response-formatter.js";
import { HandlerResponse, ArtifactType, ToolName } from "../types/handler-types.js";
import { logger } from "../utils/logger.js";

export abstract class BaseHandler {
  protected apiService: APIService;
  protected aiAgent: AIAgent;

  constructor(apiClient: ServiceAwareAPIClient) {
    this.apiService = new APIService(apiClient);
    this.aiAgent = new AIAgent({
      apiClient,
      maxRetries: 3,
      verbose: true,
    });
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle push operation (sync to server)
   */
  protected async handlePushOperation(
    toolName: ToolName,
    artifactType: ArtifactType,
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext
  ): Promise<HandlerResponse> {
    const requestId = this.generateRequestId();

    try {
      const projectData = await ContentExtractor.extractProjectData(codebase, projectContext);
      const pathPattern = ContentExtractor.getPathPattern(artifactType);
      const content = ContentExtractor.extractFileContent(codebase, pathPattern);

      if (!content) {
        throw new Error(`No ${artifactType} file found. Expected pattern: ${pathPattern}`);
      }

      logger.info(`[${toolName}] Extracted ${artifactType} content, length: ${content.length}`);

      const result = await this.apiService.syncArtifact(
        artifactType,
        content,
        projectData
      );

      return ResponseFormatter.formatAPIResult(
        requestId,
        result,
        `${artifactType} sync`
      );
    } catch (error) {
      logger.logError(`[${toolName}] Error`, error);
      return ResponseFormatter.formatError(requestId, error as Error);
    }
  }

  /**
   * Handle pull operation (fetch from server)
   */
  protected async handlePullOperation(
    toolName: ToolName,
    intent: string,
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    const requestId = this.generateRequestId();

    try {
      const projectData = await ContentExtractor.extractProjectData(codebase, projectContext);

      const response = await this.aiAgent.processRequest({
        requestId,
        intent: `${intent}\n\nUser request: ${userPrompt}`,
        projectId: projectData.projectId,
        data: data as Record<string, unknown> | undefined,
        context: {
          codebase: ContentExtractor.buildContextString(codebase),
          latestVersion: projectContext.latestVersion,
          organizationId: projectContext.organizationId,
          userId: projectContext.userId,
        },
      });

      return ResponseFormatter.formatAIResponse(response);
    } catch (error) {
      logger.logError(`[${toolName}] Error`, error);
      return ResponseFormatter.formatError(requestId, error as Error);
    }
  }
}