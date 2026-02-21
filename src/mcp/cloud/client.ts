/**
 * Cloud API client for MCP.
 * CLI is ONLY a proxy - all execution happens on cloud.
 * 
 * Updated for vibe-coding-service v2.0 (SQLAlchemy)
 */

import { configManager } from "../../config/manager.js";

export interface CloudClientConfig {
  vibeServiceUrl: string;
  authToken: string;
}

interface Workspace {
  id: string;
  projectId: string;
  status: string;
  branch: string;
}

export class CloudClient {
  private baseUrl: string;
  private token: string;
  private workspaceCache = new Map<string, Workspace>();

  constructor(config: CloudClientConfig) {
    this.baseUrl = config.vibeServiceUrl;
    this.token = config.authToken;
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
    };

    if (data && method !== "GET") {
      options.body = JSON.stringify(data);
    }

    const url = method === "GET" && data
      ? `${this.baseUrl}${endpoint}?${new URLSearchParams(data as Record<string, string>).toString()}`
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new CloudError(
        (error as { detail?: string }).detail || `Request failed: ${response.status}`,
        response.status
      );
    }

    return await response.json() as T;
  }

  /**
   * Get or provision workspace for project.
   * Caches workspace ID to avoid repeated provision calls.
   */
  async getWorkspace(projectId: string, repositoryId: string): Promise<Workspace> {
    // Check cache first
    const cacheKey = `${projectId}:${repositoryId}`;
    if (this.workspaceCache.has(cacheKey)) {
      return this.workspaceCache.get(cacheKey)!;
    }

    // List existing workspaces
    const workspaces = await this.request<Workspace[]>(
      "GET",
      `/api/v1/workspace/project/${projectId}`
    );

    // Find workspace for this repository
    let workspace = workspaces.find(
      (ws) => ws.status === "READY" && ws.branch === "main"
    );

    // If no workspace exists, would need to provision
    // But CLI doesn't have git URL - this should be done via web UI first
    if (!workspace) {
      throw new CloudError(
        "No workspace found for this project. Please provision a workspace via the web UI first.",
        404
      );
    }

    // Cache it
    this.workspaceCache.set(cacheKey, workspace);
    return workspace;
  }

  // Workspace Operations (Updated for v2.0 API)

  async listDirectory(
    projectId: string,
    path: string,
    options: {
      depth?: number;
      includeHidden?: boolean;
      fileExtensions?: string[];
    } = {}
  ): Promise<unknown> {
    const workspace = await this.getWorkspace(projectId, "default");
    
    return this.request(
      "POST",
      `/api/v1/workspace/${workspace.id}/list`,
      {
        path: path || "",
        depth: options.depth ?? 2,
        include_hidden: options.includeHidden ?? false,
        file_extensions: options.fileExtensions,
      }
    );
  }

  async readFile(
    projectId: string,
    path: string,
    encoding = "utf-8"
  ): Promise<unknown> {
    const workspace = await this.getWorkspace(projectId, "default");
    
    return this.request(
      "POST",
      `/api/v1/workspace/${workspace.id}/read`,
      {
        path,
        encoding,
      }
    );
  }

  async readFileLines(
    projectId: string,
    path: string,
    startLine: number,
    endLine: number
  ): Promise<unknown> {
    const workspace = await this.getWorkspace(projectId, "default");
    
    // Note: New API uses read with line range
    return this.request(
      "POST",
      `/api/v1/workspace/${workspace.id}/read`,
      {
        path,
        start_line: startLine,
        end_line: endLine,
      }
    );
  }

  async search(
    projectId: string,
    query: string,
    options: {
      searchType?: "content" | "filename" | "both";
      fileExtensions?: string[];
      maxResults?: number;
      useRegex?: boolean;
    } = {}
  ): Promise<unknown> {
    const workspace = await this.getWorkspace(projectId, "default");
    
    return this.request(
      "POST",
      `/api/v1/workspace/${workspace.id}/search`,
      {
        query,
        case_sensitive: false,
        file_patterns: options.fileExtensions,
        max_results: options.maxResults ?? 50,
      }
    );
  }

  async getAST(
    projectId: string,
    path: string,
    detailLevel = "symbols"
  ): Promise<unknown> {
    const workspace = await this.getWorkspace(projectId, "default");
    
    return this.request(
      "POST",
      `/api/v1/workspace/${workspace.id}/ast`,
      {
        path,
        include_bodies: detailLevel === "full",
      }
    );
  }

  async getFileStats(projectId: string, path: string): Promise<unknown> {
    const workspace = await this.getWorkspace(projectId, "default");
    
    // New API doesn't have separate stats endpoint
    // Use read with metadata_only flag
    return this.request(
      "POST",
      `/api/v1/workspace/${workspace.id}/read`,
      {
        path,
        metadata_only: true,
      }
    );
  }
}

export class CloudError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "CloudError";
  }
}

// Create client from config
export function createCloudClient(): CloudClient {
  const auth = configManager.getAuth();

  return new CloudClient({
    vibeServiceUrl: configManager.getVibeServiceUrl(),
    authToken: auth?.token || "",
  });
}
