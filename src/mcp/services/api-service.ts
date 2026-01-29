/**
 * Quikim - API Service for MCP Operations
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { ServiceAwareAPIClient } from "../api/service-client.js";
import { ArtifactType, APICallResult, ProjectData } from "../types/handler-types.js";
import { logger } from "../utils/logger.js";

export class APIService {
  constructor(private apiClient: ServiceAwareAPIClient) {}

  /**
   * Sync artifact to server
   */
  async syncArtifact(
    artifactType: ArtifactType,
    content: string,
    projectData: ProjectData,
    metadata?: Record<string, unknown>
  ): Promise<APICallResult> {
    try {
      let result: unknown;

      switch (artifactType) {
        case "requirements":
          result = await this.apiClient.syncRequirements(
            projectData.projectId,
            content,
            metadata
          );
          break;

        case "hld":
          result = await this.apiClient.syncHLD(
            projectData.projectId,
            content,
            metadata
          );
          break;

        case "lld":
          const componentName = metadata?.componentName as string || "default";
          result = await this.apiClient.syncLLD(
            projectData.projectId,
            content,
            componentName,
            metadata
          );
          break;

        case "tasks":
          result = await this.apiClient.syncTask(
            projectData.projectId,
            content,
            metadata
          );
          break;

        case "wireframes":
          result = await this.apiClient.syncWireframe(
            projectData.projectId,
            content,
            metadata,
            projectData.organizationId
          );
          break;

        case "er_diagram":
          result = await this.apiClient.syncERDiagram(
            projectData.projectId,
            content,
            metadata
          );
          break;

        case "mermaid":
          result = await this.apiClient.syncMermaid(
            projectData.projectId,
            content,
            metadata,
            projectData.specName
          );
          break;

        case "context":
          result = await this.apiClient.syncContext(
            projectData.projectId,
            content,
            metadata
          );
          break;

        case "code_guideline":
          result = await this.apiClient.syncCodeGuideline(
            projectData.projectId,
            content,
            metadata
          );
          break;

        default:
          throw new Error(`Syncing ${artifactType} is not yet implemented`);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.logError(`Failed to sync ${artifactType}`, error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch artifact from server
   */
  async fetchArtifact(
    artifactType: ArtifactType,
    projectData: ProjectData,
    componentName?: string
  ): Promise<APICallResult> {
    try {
      let result: unknown;

      switch (artifactType) {
        case "requirements":
          result = await this.apiClient.fetchRequirements(projectData.projectId);
          break;

        case "hld":
          result = await this.apiClient.fetchHLD(projectData.projectId);
          break;

        case "lld":
          result = await this.apiClient.fetchLLD(projectData.projectId, componentName);
          break;

        case "tasks":
          result = await this.apiClient.fetchTasks(projectData.projectId);
          break;

        case "wireframes":
          result = await this.apiClient.fetchWireframes(projectData.projectId);
          break;

        case "er_diagram":
          result = await this.apiClient.fetchERDiagram(projectData.projectId);
          break;

        case "mermaid":
          result = await this.apiClient.fetchMermaid(projectData.projectId);
          break;

        case "context":
          result = await this.apiClient.fetchContexts(projectData.projectId);
          break;

        case "code_guideline":
          result = await this.apiClient.fetchCodeGuidelines(projectData.projectId);
          break;

        default:
          throw new Error(`Fetching ${artifactType} is not yet implemented`);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.logError(`Failed to fetch ${artifactType}`, error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}