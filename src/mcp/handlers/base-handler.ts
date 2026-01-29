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
  getPushContentAndNameFromLocal,
  ensureLocalArtifactAfterPush,
  readLocalArtifactsForPull,
  mcpToCLIArtifactType,
  type MCPArtifactType,
} from "../../services/artifact-operations.js";
import { isVersionedArtifactType } from "../../types/artifacts.js";
import { extractFetchedArtifacts } from "../utils/fetch-result-parser.js";
import { normalizeMermaidContent } from "../utils/content-normalizer.js";
import { markdownToHtml, isHtmlContent } from "../../services/content-converter.js";

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
   * Extract artifactId and rootId from sync API response.
   * Backend returns { success, data: { id, rootId, ... } }; client may wrap again so result.data is one or two levels of .data.
   */
  private extractArtifactIdsFromResponse(responseData: unknown): {
    artifactId: string | undefined;
    rootId: string | undefined;
  } {
    const raw =
      responseData != null && typeof responseData === "object"
        ? (responseData as Record<string, unknown>)
        : null;
    if (!raw) return { artifactId: undefined, rootId: undefined };
    // One level: result.data = { success, data: entity } (backend body)
    const one = raw.data;
    const oneEntity =
      one != null &&
      typeof one === "object" &&
      ((one as Record<string, unknown>).id != null ||
        (one as Record<string, unknown>).artifactId != null);
    if (oneEntity) {
      const entity = one as Record<string, unknown>;
      return {
        artifactId: (entity.id ?? entity.artifactId) as string | undefined,
        rootId: (entity.rootId ?? entity.root_id) as string | undefined,
      };
    }
    // Two levels: result.data = { success, data: { success, data: entity } } (client wrapped backend body)
    const two = one != null && typeof one === "object" ? (one as Record<string, unknown>).data : undefined;
    const twoEntity =
      two != null &&
      typeof two === "object" &&
      ((two as Record<string, unknown>).id != null ||
        (two as Record<string, unknown>).artifactId != null);
    if (twoEntity) {
      const entity = two as Record<string, unknown>;
      return {
        artifactId: (entity.id ?? entity.artifactId) as string | undefined,
        rootId: (entity.rootId ?? entity.root_id) as string | undefined,
      };
    }
    // Top level entity
    const artifactId = (raw.id ?? raw.artifactId) as string | undefined;
    const rootId = (raw.rootId ?? raw.root_id) as string | undefined;
    return { artifactId, rootId };
  }

  /**
   * Build metadata (name, title) from tool args for server sync
   */
  private buildPushMetadata(data?: unknown): Record<string, unknown> | undefined {
    if (!data || typeof data !== "object") return undefined;
    const d = data as Record<string, unknown>;
    const name = d.name as string | undefined;
    const title = d.title as string | undefined;
    if (!name && !title) return undefined;
    const out: Record<string, unknown> = {};
    if (name) out.name = name;
    if (title) out.title = title;
    return Object.keys(out).length ? out : undefined;
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Push: save to local first (markdown for tasks/requirements), then sync to server in background (non-blocking).
   * Requirements and tasks: local = markdown (Kiro format); server = HTML (converted like CLI).
   */
  protected async handlePushOperation(
    toolName: ToolName,
    artifactType: ArtifactType,
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
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

      let content: string;
      let artifactName: string;

      const fromCodebase = ContentExtractor.extractFileContentAndName(codebase, artifactType);
      if (fromCodebase) {
        content = fromCodebase.content;
        artifactName = fromCodebase.artifactName;
      } else {
        const fromLocal = await getPushContentAndNameFromLocal(
          this.fileManager,
          specName,
          artifactType as MCPArtifactType
        );
        if (!fromLocal) {
          const pathHint = ContentExtractor.getExpectedPathHint(artifactType);
          throw new Error(
            `No content. Add a file matching ${pathHint} to codebase or create it locally.`
          );
        }
        content = fromLocal.content;
        artifactName = fromLocal.artifactName;
      }

      if (artifactType === "mermaid" || artifactType === "er_diagram") {
        content = normalizeMermaidContent(content);
      }

      const contentToSave = content;
      let contentForServer = content;
      if (artifactType === "requirements" || artifactType === "tasks") {
        if (!isHtmlContent(content)) {
          try {
            contentForServer = await markdownToHtml(content);
          } catch (convErr) {
            logger.logError(`[${toolName}] Markdown to HTML conversion failed; sending as-is`, convErr as Error);
          }
        }
      }

      const cliType = mcpToCLIArtifactType(artifactType as MCPArtifactType);
      const initialArtifactName = artifactName;
      await ensureLocalArtifactAfterPush(
        this.fileManager,
        specName,
        artifactType as MCPArtifactType,
        artifactName,
        contentToSave,
        undefined
      );
      const localPath = `.quikim/artifacts/${specName}/${cliType}_${artifactName}.md`;
      logger.info(`[${toolName}] Saved locally at ${localPath}; syncing to server in background`);

      const metadata = this.buildPushMetadata(data);
      this.apiService
        .syncArtifact(artifactType, contentForServer, projectData, metadata)
        .then((result) => {
          if (!result.success || !result.data) return;
          const { artifactId, rootId } = this.extractArtifactIdsFromResponse(result.data);
          if (!artifactId) return;
          if (isVersionedArtifactType(cliType) && !rootId) return;
          const nameForFile = isVersionedArtifactType(cliType) ? rootId : artifactId;
          ensureLocalArtifactAfterPush(
            this.fileManager,
            specName,
            artifactType as MCPArtifactType,
            artifactId,
            contentToSave,
            isVersionedArtifactType(cliType) ? rootId : undefined
          ).then(() => {
            if (nameForFile !== initialArtifactName) {
              return this.fileManager
                .deleteArtifactFile(specName, cliType, initialArtifactName)
                .then(() => {
                  logger.info(
                    `[${toolName}] Renamed to convention: ${cliType}_${nameForFile}.md`
                  );
                });
            }
          });
        })
        .catch((err) => {
          logger.logError(`[${toolName}] Background sync failed`, err as Error);
        });

      return ResponseFormatter.formatSuccess(
        requestId,
        "Saved locally. Syncing to server in background; filename will update to server ID when sync completes.",
        { localPath, artifactType, artifactName }
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