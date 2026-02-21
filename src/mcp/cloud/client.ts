/**
 * Cloud API client for MCP.
 * CLI is ONLY a proxy - all execution happens on cloud.
 */

import { configManager } from "../../config/manager.js";

export interface CloudClientConfig {
  vibeServiceUrl: string;
  authToken: string;
}

export class CloudClient {
  private baseUrl: string;
  private token: string;

  constructor(config: CloudClientConfig) {
    this.baseUrl = config.vibeServiceUrl;
    this.token = config.authToken;
  }

  async request<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new CloudError(
        (error as { detail?: string }).detail || `Request failed: ${response.status}`,
        response.status
      );
    }

    const result = (await response.json()) as { data: T };
    return result.data;
  }

  // Phase 1 Methods (Read-Only)

  async listDirectory(
    projectId: string,
    path: string,
    options: {
      depth?: number;
      includeHidden?: boolean;
      fileExtensions?: string[];
    } = {}
  ): Promise<unknown> {
    return this.request("/api/v1/workspace/list", {
      project_id: projectId,
      path,
      depth: options.depth ?? 2,
      include_hidden: options.includeHidden ?? false,
      file_extensions: options.fileExtensions,
    });
  }

  async readFile(
    projectId: string,
    path: string,
    encoding = "utf-8"
  ): Promise<unknown> {
    return this.request("/api/v1/workspace/read", {
      project_id: projectId,
      path,
      encoding,
    });
  }

  async readFileLines(
    projectId: string,
    path: string,
    startLine: number,
    endLine: number
  ): Promise<unknown> {
    return this.request("/api/v1/workspace/read-lines", {
      project_id: projectId,
      path,
      start_line: startLine,
      end_line: endLine,
    });
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
    return this.request("/api/v1/workspace/search", {
      project_id: projectId,
      query,
      search_type: options.searchType ?? "content",
      file_extensions: options.fileExtensions,
      max_results: options.maxResults ?? 50,
      use_regex: options.useRegex ?? false,
    });
  }

  async getAST(
    projectId: string,
    path: string,
    detailLevel = "symbols"
  ): Promise<unknown> {
    return this.request("/api/v1/workspace/ast", {
      project_id: projectId,
      path,
      detail_level: detailLevel,
    });
  }

  async getFileStats(projectId: string, path: string): Promise<unknown> {
    return this.request("/api/v1/workspace/stats", {
      project_id: projectId,
      path,
    });
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
