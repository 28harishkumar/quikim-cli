/**
 * Quikim - Wireframe Handler
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { BaseHandler } from "./base-handler.js";
import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { HandlerResponse } from "../types/handler-types.js";
import { ServiceAwareAPIClient } from "../api/service-client.js";
import { ResponseFormatter } from "../utils/response-formatter.js";
import { logger } from "../utils/logger.js";

export class WireframeHandler extends BaseHandler {
  async handlePush(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "push_wireframes",
      "wireframes",
      codebase,
      userPrompt,
      projectContext
    );
  }

  async handlePull(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_wireframe",
      "Fetch wireframes from server",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleSyncFromPenpot(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "sync_wireframe_from_penpot",
      "Sync wireframes from Penpot back to Quikim",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleGenerateCode(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "generate_code_from_wireframe",
      "Convert wireframe to React component code",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleListPenpotSyncs(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "list_penpot_syncs",
      "List all Penpot sync states for project",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleProcessQueue(
    _codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
    _data?: unknown
  ): Promise<HandlerResponse> {
    const requestId = this.generateRequestId();

    try {
      // Fetch pending wireframe generation requests
      const apiClient = (this.apiService as any).apiClient as ServiceAwareAPIClient;
      const projectId = projectContext.projectId;
      if (!projectId) {
        return ResponseFormatter.formatError(
          requestId,
          new Error("Project ID is required")
        );
      }
      const pendingRequests = await apiClient.fetchPendingQueueRequests(projectId);
      
      if (!pendingRequests || pendingRequests.length === 0) {
        return ResponseFormatter.formatSuccess(
          requestId,
          "No pending wireframe generation requests",
          { processed: 0 }
        );
      }

      const processed: Array<{ id: string; status: string }> = [];

      for (const request of pendingRequests) {
        if (request.type === "generate_wireframe" && request.status === "pending") {
          try {
            // Update status to processing
            await apiClient.updateQueueRequestStatus(request.id, "processing");

            // Generate wireframe locally
            // This would use local LLM or create boilerplate structure
            const wireframeData = request.context as {
              name: string;
              description?: string;
              requirementId?: string;
              themeId?: string;
              uiTemplateId?: string;
              lldId?: string;
              flowId?: string;
            };

            // Create boilerplate wireframe structure
            const wireframeContent = {
              pageId: wireframeData.name.toLowerCase().replace(/\s+/g, "-"),
              pageName: wireframeData.name,
              viewport: { width: 1440, height: 900 },
              elements: [],
            };

            // Save to local .quikim directory
            const fs = await import("fs/promises");
            const path = await import("path");
            const quikimDir = path.join(process.cwd(), ".quikim");
            const wireframesDir = path.join(quikimDir, "wireframes");
            
            await fs.mkdir(wireframesDir, { recursive: true });
            const wireframeFile = path.join(wireframesDir, `${wireframeData.name.toLowerCase().replace(/\s+/g, "-")}.json`);
            await fs.writeFile(wireframeFile, JSON.stringify(wireframeContent, null, 2));

            // Update queue status to completed
            await apiClient.updateQueueRequestStatus(request.id, "completed", {
              wireframeFile,
              content: wireframeContent,
            });

            processed.push({ id: request.id, status: "completed" });
          } catch (error) {
            logger.logError(`[process_wireframe_queue] Error processing request ${request.id}`, error);
            await apiClient.updateQueueRequestStatus(request.id, "failed", {
              error: error instanceof Error ? error.message : "Unknown error",
            });
            processed.push({ id: request.id, status: "failed" });
          }
        }
      }

      return ResponseFormatter.formatSuccess(
        requestId,
        `Processed ${processed.length} wireframe generation request(s)`,
        { processed: processed.length, results: processed }
      );
    } catch (error) {
      logger.logError("[process_wireframe_queue] Error", error);
      return ResponseFormatter.formatError(
        requestId,
        error instanceof Error ? error : new Error("Unknown error")
      );
    }
  }
}