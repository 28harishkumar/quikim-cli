/**
 * Workspace MCP tool handlers.
 * All handlers are proxies to cloud API - no local execution.
 */

import { createCloudClient, CloudError } from "../cloud/client.js";
import { getProjectContext } from "../../utils/project-context.js";

export class WorkspaceHandler {
  private getClient() {
    return createCloudClient();
  }

  private getProjectId(): string {
    const context = getProjectContext();
    if (!context?.projectId) {
      throw new Error("No project connected. Run `quikim connect` first.");
    }
    return context.projectId;
  }

  async listDirectory(args: {
    path?: string;
    depth?: number;
    include_hidden?: boolean;
    file_extensions?: string[];
  }): Promise<unknown> {
    const client = this.getClient();
    const projectId = this.getProjectId();

    try {
      return await client.listDirectory(projectId, args.path || "", {
        depth: args.depth,
        includeHidden: args.include_hidden,
        fileExtensions: args.file_extensions,
      });
    } catch (error) {
      return this.handleError(error, "list_directory");
    }
  }

  async readFile(args: { path: string; encoding?: string }): Promise<unknown> {
    const client = this.getClient();
    const projectId = this.getProjectId();

    try {
      return await client.readFile(projectId, args.path, args.encoding);
    } catch (error) {
      return this.handleError(error, "read_file");
    }
  }

  async readFileLines(args: {
    path: string;
    start_line: number;
    end_line: number;
  }): Promise<unknown> {
    const client = this.getClient();
    const projectId = this.getProjectId();

    try {
      return await client.readFileLines(
        projectId,
        args.path,
        args.start_line,
        args.end_line
      );
    } catch (error) {
      return this.handleError(error, "read_file_lines");
    }
  }

  async searchCodebase(args: {
    query: string;
    search_type?: string;
    file_extensions?: string[];
    max_results?: number;
    use_regex?: boolean;
  }): Promise<unknown> {
    const client = this.getClient();
    const projectId = this.getProjectId();

    try {
      return await client.search(projectId, args.query, {
        searchType: args.search_type as "content" | "filename" | "both" | undefined,
        fileExtensions: args.file_extensions,
        maxResults: args.max_results,
        useRegex: args.use_regex,
      });
    } catch (error) {
      return this.handleError(error, "search_codebase");
    }
  }

  async getAST(args: {
    path: string;
    detail_level?: string;
  }): Promise<unknown> {
    const client = this.getClient();
    const projectId = this.getProjectId();

    try {
      return await client.getAST(projectId, args.path, args.detail_level);
    } catch (error) {
      return this.handleError(error, "get_ast");
    }
  }

  async getFileStats(args: { path: string }): Promise<unknown> {
    const client = this.getClient();
    const projectId = this.getProjectId();

    try {
      return await client.getFileStats(projectId, args.path);
    } catch (error) {
      return this.handleError(error, "get_file_stats");
    }
  }

  private handleError(error: unknown, _toolName: string): {
    error: boolean;
    message: string;
    code?: number;
  } {
    if (error instanceof CloudError) {
      return {
        error: true,
        message: error.message,
        code: error.statusCode,
      };
    }

    return {
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const workspaceHandler = new WorkspaceHandler();
