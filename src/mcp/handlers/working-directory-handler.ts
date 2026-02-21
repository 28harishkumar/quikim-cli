/**
 * Working directory context MCP tool handlers.
 * Provides information about the current working environment (pwd, ls).
 */

import fs from "fs";
import { getQuikimProjectRoot } from "../../config/project-root.js";

export class WorkingDirectoryHandler {
  async getWorkingDirectory(): Promise<unknown> {
    try {
      const cwd = getQuikimProjectRoot();
      
      return {
        cwd,
        exists: fs.existsSync(cwd),
      };
    } catch (error) {
      return this.handleError(error, "get_working_directory");
    }
  }

  async listWorkingDirectory(args: {
    include_hidden?: boolean;
  }): Promise<unknown> {
    try {
      const cwd = getQuikimProjectRoot();
      const includeHidden = args.include_hidden ?? false;

      if (!fs.existsSync(cwd)) {
        throw new Error(`Directory does not exist: ${cwd}`);
      }

      const entries = fs.readdirSync(cwd, { withFileTypes: true });
      const files: string[] = [];
      const directories: string[] = [];

      for (const entry of entries) {
        // Skip hidden files unless requested
        if (!includeHidden && entry.name.startsWith(".")) {
          continue;
        }

        if (entry.isDirectory()) {
          directories.push(entry.name);
        } else if (entry.isFile()) {
          files.push(entry.name);
        }
      }

      return {
        cwd,
        files: files.sort(),
        directories: directories.sort(),
        total: files.length + directories.length,
      };
    } catch (error) {
      return this.handleError(error, "list_working_directory");
    }
  }

  private handleError(error: unknown, toolName: string): {
    error: boolean;
    message: string;
    tool: string;
  } {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      tool: toolName,
    };
  }
}

export const workingDirectoryHandler = new WorkingDirectoryHandler();
