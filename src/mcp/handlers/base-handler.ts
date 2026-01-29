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
import { ArtifactFileManager } from "../../services/artifact-file-manager.js";
import {
  getPushContentFromLocal,
  ensureLocalArtifactAfterPush,
  readLocalArtifactsForPull,
  mcpToCLIArtifactType,
  type MCPArtifactType,
} from "../../services/artifact-operations.js";
import { extractFetchedArtifacts } from "../utils/fetch-result-parser.js";

export abstract class BaseHandler {
  protected apiService: APIService;
  protected aiAgent: AIAgent;
  private fileManager: ArtifactFileManager;

  constructor(apiClient: ServiceAwareAPIClient) {
    this.apiService = new APIService(apiClient);
    this.aiAgent = new AIAgent({
      apiClient,
      maxRetries: 3,
      verbose: true,
    });
    this.fileManager = new ArtifactFileManager();
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get content for push: codebase first, then local file. Creates local file if missing after push.
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
      const specName =
        projectContext.specName ??
        ContentExtractor.getSpecNameFromMatchingFile(codebase, artifactType) ??
        ContentExtractor.getSpecNameFromCodebase(codebase) ??
        "default";
      projectData.specName = specName;

      let content: string | null = ContentExtractor.extractFileContent(
        codebase,
        ContentExtractor.getPathPattern(artifactType)
      );
      if (!content) {
        content = await getPushContentFromLocal(
          this.fileManager,
          specName,
          artifactType as MCPArtifactType
        );
      }

      if (!content) {
        const pathHint = ContentExtractor.getExpectedPathHint(artifactType);
        throw new Error(
          `No content. Add a file matching ${pathHint} to codebase or create it locally.`
        );
      }

      logger.info(`[${toolName}] Pushing ${artifactType}, length: ${content.length}`);

      const result = await this.apiService.syncArtifact(
        artifactType,
        content,
        projectData
      );

      const data = result.data as { id?: string; artifactId?: string; rootId?: string; data?: { id?: string; rootId?: string } } | undefined;
      const artifactId = data?.id ?? data?.artifactId ?? data?.data?.id;
      const rootId = data?.rootId ?? data?.data?.rootId;

      if (result.success && artifactId) {
        try {
          await ensureLocalArtifactAfterPush(
            this.fileManager,
            specName,
            artifactType as MCPArtifactType,
            artifactId,
            content,
            rootId
          );
          logger.info(`[${toolName}] Ensured local file .quikim/artifacts/${specName}/${artifactType}_*.md`);
        } catch (writeErr) {
          logger.logError(`[${toolName}] Failed to write local file after push`, writeErr as Error);
        }
      }

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
   * Pull: read from local files. If force=true, fetch from API then write to local then return.
   * When options.useApiOnly is true (e.g. update_code), uses AI agent instead of local/force.
   */
  protected async handlePullOperation(
    toolName: ToolName,
    intent: string,
    artifactType: ArtifactType,
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown,
    options?: { useApiOnly?: boolean }
  ): Promise<HandlerResponse> {
    const requestId = this.generateRequestId();

    if (options?.useApiOnly) {
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

    const force = (data as { force?: boolean } | undefined)?.force === true;
    const specName = projectContext.specName ?? ContentExtractor.getSpecNameFromCodebase(codebase) ?? "default";

    try {
      if (force) {
        const projectData = await ContentExtractor.extractProjectData(codebase, projectContext);
        const fetchResult = await this.apiService.fetchArtifact(
          artifactType,
          projectData,
          (data as { componentName?: string } | undefined)?.componentName
        );
        if (!fetchResult.success || !fetchResult.data) {
          return ResponseFormatter.formatError(
            requestId,
            new Error(fetchResult.error ?? "Fetch failed")
          );
        }
        const items = extractFetchedArtifacts(artifactType, fetchResult.data);
        for (const item of items) {
          await ensureLocalArtifactAfterPush(
            this.fileManager,
            specName,
            artifactType as MCPArtifactType,
            item.artifactNameOrId,
            item.content,
            item.rootId
          );
        }
        const text = items.length === 1
          ? items[0].content
          : items.map((i) => `## ${i.artifactNameOrId}\n\n${i.content}`).join("\n\n");
        return ResponseFormatter.formatSuccess(
          requestId,
          "Fetched from API and wrote to local",
          { content: text, filesWritten: items.length }
        );
      }

      const filters = {
        specName,
        artifactType: mcpToCLIArtifactType(artifactType as MCPArtifactType),
      };
      const local = await readLocalArtifactsForPull(this.fileManager, filters);
      if (local.length === 0) {
        return ResponseFormatter.formatSuccess(
          requestId,
          "No local artifacts. Use force: true to fetch from API.",
          { content: "", files: [] }
        );
      }
      const text = local.length === 1
        ? local[0].content
        : local.map((a) => `## ${a.specName}/${a.artifactType}_${a.artifactName}\n\n${a.content}`).join("\n\n");
      return ResponseFormatter.formatSuccess(
        requestId,
        "Read from local files",
        { content: text, files: local.map((a) => a.filePath) }
      );
    } catch (error) {
      logger.logError(`[${toolName}] Error`, error);
      return ResponseFormatter.formatError(requestId, error as Error);
    }
  }
}