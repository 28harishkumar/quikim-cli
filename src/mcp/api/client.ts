/**
 * Quikim - MCP API Client
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import {
  APIConfig,
  APIResponse,
  Requirements,
  HLD,
  LLD,
  Tasks,
  ERDiagram,
  PrismaSchema,
  Wireframe,
  Theme,
  CodeGuidelines,
  QueuedRequest,
  LLMKeyStatus,
  SyncRequest,
  SyncResponse,
  MermaidDiagram,
  MermaidDiagramType,
} from './types.js';
import {
  APIError,
  AuthenticationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  RateLimitError,
} from './errors.js';

export class QuikimAPIClient {
  private config: Required<APIConfig>;

  constructor(config: APIConfig) {
    this.config = {
      baseURL: config.baseURL,
      apiKey: config.apiKey || "",
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  /**
   * Generic HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.config.apiKey && {
        Authorization: `Bearer ${this.config.apiKey}`,
      }),
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(
          response,
          endpoint,
          options,
          retryCount,
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new TimeoutError(`Request to ${endpoint} timed out`);
      }

      // Retry on network errors
      if (retryCount < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw new NetworkError(`Network request failed: ${error.message}`);
    }
  }

  /**
   * Handle error responses with appropriate error types
   */
  private async handleErrorResponse(
    response: Response,
    endpoint: string,
    options: RequestInit,
    retryCount: number,
  ): Promise<APIResponse<any>> {
    const errorData: any = await response.json().catch(() => ({}));

    switch (response.status) {
      case 401:
        throw new AuthenticationError(
          (errorData?.message as string) || "Authentication failed",
        );

      case 404:
        throw new NotFoundError(
          (errorData?.message as string) || "Resource not found",
        );

      case 429:
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "60",
        );
        if (retryCount < this.config.retryAttempts) {
          await this.delay(retryAfter * 1000);
          return this.request(endpoint, options, retryCount + 1);
        }
        throw new RateLimitError(
          (errorData?.message as string) || "Rate limit exceeded",
          retryAfter,
        );

      case 500:
      case 502:
      case 503:
        // Retry on server errors
        if (retryCount < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
          return this.request(endpoint, options, retryCount + 1);
        }
        throw new APIError(
          (errorData?.message as string) || "Server error",
          response.status,
          errorData,
        );

      default:
        throw new APIError(
          (errorData?.message as string) ||
            `Request failed with status ${response.status}`,
          response.status,
          errorData,
        );
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== Artifact Fetching ====================

  /**
   * Fetch requirements for a project
   */
  async fetchRequirements(projectId: string): Promise<Requirements | null> {
    try {
      // GET /api/v1/requirements/?projectId=xxx
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/requirements/?projectId=${projectId}`,
        { method: "GET" },
      );
      
      // Return the latest version (first item since they're sorted desc by version)
      const requirements = response.data?.data || [];
      return requirements.length > 0 ? requirements[0] : null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch HLD for a project
   */
  async fetchHLD(projectId: string): Promise<HLD | null> {
    try {
      // GET /api/v1/designs/?projectId=xxx&type=hld
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/designs/?projectId=${projectId}&type=hld`,
        { method: "GET" },
      );
      
      // Return the latest version (first item since they're sorted desc by version)
      const designs = response.data?.data || [];
      return designs.length > 0 ? designs[0] : null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch all LLDs for a project
   */
  async fetchLLDs(projectId: string): Promise<LLD[]> {
    try {
      // GET /api/v1/designs/?projectId=xxx&type=lld
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/designs/?projectId=${projectId}&type=lld`,
        { method: "GET" },
      );
      return response.data?.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetch a specific LLD by component name
   */
  async fetchLLD(projectId: string, componentName: string): Promise<LLD | null> {
    try {
      // GET /api/v1/designs/?projectId=xxx&type=lld&componentName=xxx
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/designs/?projectId=${projectId}&type=lld&componentName=${encodeURIComponent(componentName)}`,
        { method: "GET" },
      );
      const designs = response.data?.data || [];
      return designs.length > 0 ? designs[0] : null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch tasks for a project
   */
  async fetchTasks(projectId: string): Promise<Tasks | null> {
    try {
      // GET /api/v1/tasks/?projectId=xxx
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/tasks/?projectId=${projectId}`,
        { method: "GET" },
      );
      
      // Return all tasks for the project
      const tasks = response.data?.data || [];
      // Format as Tasks object
      if (tasks.length === 0) {
        return null;
      }
      
      return {
        id: projectId,
        projectId: projectId,
        version: 1,
        content: JSON.stringify(tasks),
        milestones: [],
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch ER diagram for a project
   */
  async fetchERDiagram(projectId: string): Promise<ERDiagram | null> {
    try {
      // GET /api/v1/er-diagrams/?projectId=xxx
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/er-diagrams/?projectId=${projectId}`,
        { method: "GET" },
      );
      
      // Return the latest version
      const erDiagrams = response.data?.data || [];
      return erDiagrams.length > 0 ? erDiagrams[0] : null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch Prisma schema for a project
   */
  async fetchPrismaSchema(projectId: string): Promise<PrismaSchema | null> {
    try {
      const response = await this.request<PrismaSchema>(
        `/api/projects/${projectId}/prisma-schema/latest`,
        { method: "GET" },
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch wireframes for a project
   */
  async fetchWireframes(projectId: string): Promise<Wireframe[]> {
    try {
      // GET /api/v1/projects/:projectId/wireframes
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/projects/${projectId}/wireframes`,
        { method: "GET" },
      );
      return response.data?.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetch theme for a project
   */
  async fetchTheme(projectId: string): Promise<Theme | null> {
    try {
      const response = await this.request<Theme>(
        `/api/projects/${projectId}/theme/latest`,
        { method: "GET" },
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch code guidelines for a project
   */
  async fetchCodeGuidelines(
    projectId: string,
    organizationId?: string,
    userId?: string
  ): Promise<CodeGuidelines | null> {
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (userId) params.set("userId", userId);
      const queryString = params.toString();
      const url = `/api/projects/${projectId}/code-guidelines/latest${queryString ? `?${queryString}` : ""}`;
      
      const response = await this.request<CodeGuidelines>(url, { method: "GET" });
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search components via snippet-service API
   * GET /api/v1/snippets/components?search={query}&limit={limit}&organizationId={orgId}
   */
  async searchComponents(
    query: string,
    organizationId?: string,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: limit.toString(),
      });
      if (organizationId) {
        params.append("organizationId", organizationId);
      }
      const url = `/api/v1/snippets/components?${params.toString()}`;
      const response = await this.request<{ success: boolean; data: any[] }>(
        url,
        { method: "GET" },
      );
      return response.data?.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Search sample code via snippet-service API
   */
  async searchSampleCode(
    query: string,
    organizationId?: string,
    limit?: number,
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set("search", query);
      if (organizationId) params.set("organizationId", organizationId);
      if (limit) params.set("limit", limit.toString());

      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/snippets/sample-code/search?${params.toString()}`,
        { method: "GET" },
      );
      return response.data?.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetch features from snippet-service API with full details including database schema
   */
  async fetchFeatures(): Promise<any[]> {
    try {
      const response = await this.request<{ success: boolean; data: any[] }>(
        "/api/v1/snippets/features",
        { method: "GET" },
      );
      const features = response.data?.data || [];

      // Extract database schema info from mcpIntegration JSON
      return features.map((feature) => {
        const mcpIntegration = feature.mcpIntegration as any;
        const databaseSchema = mcpIntegration?.databaseSchema || null;

        return {
          ...feature,
          databaseSchema: databaseSchema
            ? {
                entities: databaseSchema.entities || [],
                relationships: databaseSchema.relationships || [],
                columns: databaseSchema.columns || [],
                indexes: databaseSchema.indexes || [],
              }
            : null,
        };
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Generate wireframe via tools-service API
   * POST /api/v1/tools/wireframes/generate
   */
  async generateWireframe(projectId: string, prompt: string): Promise<any> {
    try {
      const response = await this.request<{ success: boolean; data: any }>(
        "/api/v1/tools/wireframes/generate",
        {
          method: "POST",
          body: JSON.stringify({ projectId, prompt }),
        },
      );
      return response.data?.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Sync wireframe to Penpot
   * POST /api/v1/tools/penpot/sync/:wireframeId/to-penpot
   */
  async syncWireframeToPenpot(wireframeId: string): Promise<any> {
    try {
      const response = await this.request<{ success: boolean; data: any }>(
        `/api/v1/tools/penpot/sync/${wireframeId}/to-penpot`,
        {
          method: "POST",
        },
      );
      return response.data?.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Convert Penpot design to React components
   * POST /api/v1/tools/design-to-code/convert
   */
  async convertDesignToCode(wireframeId: string, options?: any): Promise<any> {
    try {
      const response = await this.request<{ success: boolean; data: any }>(
        "/api/v1/tools/design-to-code/convert",
        {
          method: "POST",
          body: JSON.stringify({ wireframeId, options }),
        },
      );
      return response.data?.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  // ==================== Artifact Syncing ====================

  /**
   * Sync artifact to platform (creates new version)
   * Routes to correct service endpoint based on artifact type
   * 
   * Project Service Endpoints (port 8002):
   * - POST /api/v1/requirements/ (create requirement)
   * - POST /api/v1/designs/ (create HLD/LLD)
   * - POST /api/v1/tasks/ (create task)
   * - POST /api/v1/er-diagrams/ (create ER diagram)
   * - POST /api/v1/projects/:projectId/wireframes (create wireframe)
   */
  async syncArtifact(request: SyncRequest): Promise<SyncResponse> {
    let endpoint: string;
    let requestBody: any;

    // Route to the correct service endpoint
    switch (request.artifactType) {
      case "requirements":
        // POST /api/v1/requirements/
        endpoint = `/api/v1/requirements/`;
        requestBody = {
          projectId: request.projectId,
          content: request.content,
          changeSummary: request.metadata?.changeSummary,
          changeType: request.metadata?.changeType || "minor",
        };
        break;

      case "hld":
      case "lld":
        // POST /api/v1/designs/
        endpoint = `/api/v1/designs/`;
        requestBody = {
          projectId: request.projectId,
          type: request.artifactType, // "hld" or "lld"
          content: request.content,
          componentName: request.metadata?.componentName,
          changeSummary: request.metadata?.changeSummary,
        };
        break;

      case "tasks":
        // POST /api/v1/tasks/
        endpoint = `/api/v1/tasks/`;
        requestBody = {
          projectId: request.projectId,
          title: request.metadata?.title || "Task from MCP",
          description: request.content,
          status: request.metadata?.status || "todo",
          priority: request.metadata?.priority || "medium",
          type: request.metadata?.type || "feature",
        };
        break;

      case "er_diagram":
        // POST /api/v1/er-diagrams/
        endpoint = `/api/v1/er-diagrams/`;
        requestBody = {
          projectId: request.projectId,
          content: request.content,
          name: request.metadata?.name || "ER Diagram",
          changeSummary: request.metadata?.changeSummary,
        };
        break;

      case "wireframes":
        // POST /api/v1/projects/:projectId/wireframes
        endpoint = `/api/v1/projects/${request.projectId}/wireframes`;
        requestBody = {
          name: request.metadata?.name || "Wireframe from MCP",
          content: request.content,
          componentType: request.metadata?.componentType || "website",
        };
        break;

      case "prisma_schema":
      case "theme":
      case "code_guidelines":
      case "mermaid":
        // For now, throw error for unsupported types
        throw new APIError(
          `Syncing ${request.artifactType} is not yet implemented. Please use the specific service endpoints.`
        );

      default:
        throw new APIError(`Unknown artifact type: ${request.artifactType}`);
    }

    const response = await this.request<{ success: boolean; data: any }>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.success || !response.data) {
      throw new APIError(`Failed to sync ${request.artifactType}`);
    }

    // Extract artifact data from response.data (which contains the actual artifact object)
    const artifactData = response.data as any;
    return {
      success: true,
      artifactId: artifactData.id || "",
      version: artifactData.version || 1,
      message: `${request.artifactType} synced successfully`,
    };
  }

  // ==================== Request Queue ====================

  /**
   * Queue a request for dashboard workflow
   */
  async queueRequest(
    projectId: string,
    type: QueuedRequest["type"],
    context: Record<string, any>,
  ): Promise<QueuedRequest> {
    const response = await this.request<QueuedRequest>(
      `/api/projects/${projectId}/queue`,
      {
        method: "POST",
        body: JSON.stringify({ type, context }),
      },
    );

    if (!response.success || !response.data) {
      throw new APIError("Failed to queue request");
    }

    return response.data;
  }

  /**
   * Fetch pending requests for a project
   */
  async fetchPendingRequests(projectId: string): Promise<QueuedRequest[]> {
    try {
      const response = await this.request<QueuedRequest[]>(
        `/api/projects/${projectId}/queue/pending`,
        { method: "GET" },
      );
      return response.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Update request status
   */
  async updateRequestStatus(
    projectId: string,
    requestId: string,
    status: QueuedRequest["status"],
    result?: any,
  ): Promise<void> {
    await this.request(`/api/projects/${projectId}/queue/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, result }),
    });
  }

  // ==================== LLM Integration ====================

  /**
   * Check LLM key integration status
   */
  async checkLLMKeyStatus(projectId: string): Promise<LLMKeyStatus> {
    const response = await this.request<LLMKeyStatus>(
      `/api/projects/${projectId}/llm-keys/status`,
      { method: "GET" },
    );

    if (!response.success || !response.data) {
      return { integrated: false, hasKeys: false };
    }

    return response.data;
  }

  // ==================== Wireframe Sync ====================

  /**
   * Sync wireframes from Penpot for a project
   * POST /api/v1/tools/penpot/sync/project/:projectId/from-penpot
   */
  async syncWireframesFromPenpot(projectId: string): Promise<any> {
    try {
      const response = await this.request<{ success: boolean; data: any }>(
        `/api/v1/tools/penpot/sync/project/${projectId}/from-penpot`,
        {
          method: "POST",
        },
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Generate code from wireframe
   * POST /api/v1/tools/design-to-code/convert-from-wireframe
   */
  async generateCodeFromWireframe(
    wireframeContent: any,
    options: any,
    projectId: string,
  ): Promise<any> {
    try {
      const response = await this.request<{ success: boolean; data: any }>(
        "/api/v1/tools/design-to-code/convert-from-wireframe",
        {
          method: "POST",
          body: JSON.stringify({ wireframeContent, options, projectId }),
        },
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List sync states for a project
   * GET /api/v1/tools/penpot/sync?projectId=xxx
   */
  async listPenpotSyncStates(
    projectId: string,
    status?: string,
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({ projectId });
      if (status) {
        params.append("status", status);
      }
      const response = await this.request<{ success: boolean; data: any[] }>(
        `/api/v1/tools/penpot/sync?${params.toString()}`,
        {
          method: "GET",
        },
      );
      return response.data?.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  // ==================== Mermaid Diagrams ====================

  /**
   * Fetch all mermaid diagrams for a project
   * GET /api/projects/:projectId/mermaid-diagrams
   */
  async fetchMermaidDiagrams(projectId: string): Promise<MermaidDiagram[]> {
    try {
      const response = await this.request<MermaidDiagram[]>(
        `/api/projects/${projectId}/mermaid-diagrams`,
        { method: "GET" },
      );
      return response.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetch a specific mermaid diagram by ID
   * GET /api/projects/:projectId/mermaid-diagrams/:diagramId
   */
  async fetchMermaidDiagram(
    projectId: string,
    diagramId: string,
  ): Promise<MermaidDiagram | null> {
    try {
      const response = await this.request<MermaidDiagram>(
        `/api/projects/${projectId}/mermaid-diagrams/${diagramId}`,
        { method: "GET" },
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch mermaid diagrams by type
   * GET /api/projects/:projectId/mermaid-diagrams?type=:type
   */
  async fetchMermaidDiagramsByType(
    projectId: string,
    diagramType: MermaidDiagramType,
  ): Promise<MermaidDiagram[]> {
    try {
      const response = await this.request<MermaidDiagram[]>(
        `/api/projects/${projectId}/mermaid-diagrams?type=${diagramType}`,
        { method: "GET" },
      );
      return response.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Create or update a mermaid diagram
   * POST /api/projects/:projectId/mermaid-diagrams
   */
  async syncMermaidDiagram(
    projectId: string,
    diagram: {
      content: string;
      diagramType: MermaidDiagramType;
      name: string;
      description?: string;
      linkedArtifact?: {
        type: "hld" | "requirements" | "wireframes" | "tasks";
        id: string;
      };
    },
  ): Promise<MermaidDiagram | null> {
    try {
      const response = await this.request<MermaidDiagram>(
        `/api/projects/${projectId}/mermaid-diagrams`,
        {
          method: "POST",
          body: JSON.stringify(diagram),
        },
      );
      return response.data || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a mermaid diagram
   * DELETE /api/projects/:projectId/mermaid-diagrams/:diagramId
   */
  async deleteMermaidDiagram(
    projectId: string,
    diagramId: string,
  ): Promise<boolean> {
    try {
      await this.request(
        `/api/projects/${projectId}/mermaid-diagrams/${diagramId}`,
        { method: "DELETE" },
      );
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }

  // ==================== Health Check ====================

  /**
   * Check API health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{ status: string }>("/api/health", {
        method: "GET",
      });
      return response.success && response.data?.status === "ok";
    } catch {
      return false;
    }
  }
}
