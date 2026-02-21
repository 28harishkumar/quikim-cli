/**
 * Local workspace MCP tool handlers.
 * These read directly from the local filesystem.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getProjectContext } from "../../utils/project-context.js";

export class LocalWorkspaceHandler {
  private getProjectRoot(): string {
    const context = getProjectContext();
    if (!context?.rootPath) {
      throw new Error("No project connected. Run `quikim connect` first.");
    }
    return context.rootPath;
  }

  private resolvePath(relativePath: string): string {
    const root = this.getProjectRoot();
    const resolved = path.resolve(root, relativePath);
    
    // Security: Ensure path is within project root
    if (!resolved.startsWith(root)) {
      throw new Error("Path traversal detected. Path must be within project root.");
    }
    
    return resolved;
  }

  async listDirectory(args: {
    path?: string;
    depth?: number;
    include_hidden?: boolean;
    file_extensions?: string[];
  }): Promise<unknown> {
    try {
      const targetPath = this.resolvePath(args.path || "");
      const depth = args.depth ?? 2;
      const includeHidden = args.include_hidden ?? false;
      const extensions = args.file_extensions;

      const result = this.readDirectoryRecursive(
        targetPath,
        depth,
        includeHidden,
        extensions
      );

      return {
        path: args.path || ".",
        files: result.files,
        directories: result.directories,
        total: result.files.length + result.directories.length,
      };
    } catch (error) {
      return this.handleError(error, "local_list_directory");
    }
  }

  async readFile(args: { path: string; encoding?: string }): Promise<unknown> {
    try {
      const filePath = this.resolvePath(args.path);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${args.path}`);
      }

      if (fs.statSync(filePath).isDirectory()) {
        throw new Error(`Path is a directory: ${args.path}`);
      }

      const encoding = args.encoding === "base64" ? "base64" : "utf-8";
      const content = fs.readFileSync(filePath, encoding as BufferEncoding);
      const stats = fs.statSync(filePath);
      const lines = encoding === "utf-8" ? content.split("\n").length : 0;

      return {
        path: args.path,
        content,
        size: stats.size,
        lines,
        encoding,
      };
    } catch (error) {
      return this.handleError(error, "local_read_file");
    }
  }

  async readFileLines(args: {
    path: string;
    start_line: number;
    end_line: number;
  }): Promise<unknown> {
    try {
      const filePath = this.resolvePath(args.path);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${args.path}`);
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const totalLines = lines.length;

      // Validate line range
      if (args.start_line < 1 || args.start_line > totalLines) {
        throw new Error(`start_line out of range: ${args.start_line} (file has ${totalLines} lines)`);
      }

      if (args.end_line < args.start_line || args.end_line > totalLines) {
        throw new Error(`end_line out of range: ${args.end_line}`);
      }

      // Extract lines (convert to 0-indexed)
      const selectedLines = lines.slice(args.start_line - 1, args.end_line);

      return {
        path: args.path,
        content: selectedLines.join("\n"),
        start_line: args.start_line,
        end_line: args.end_line,
        total_lines: totalLines,
      };
    } catch (error) {
      return this.handleError(error, "local_read_file_lines");
    }
  }

  async searchCodebase(args: {
    query: string;
    search_type?: string;
    file_extensions?: string[];
    max_results?: number;
    use_regex?: boolean;
    case_sensitive?: boolean;
  }): Promise<unknown> {
    try {
      const root = this.getProjectRoot();
      const maxResults = args.max_results ?? 50;
      const useRegex = args.use_regex ?? false;
      const caseSensitive = args.case_sensitive ?? false;

      // Build ripgrep command
      let rgArgs = ["-n", "--color=never", "--json"];
      
      if (!caseSensitive) {
        rgArgs.push("-i");
      }

      if (!useRegex) {
        rgArgs.push("-F"); // Fixed string search
      }

      if (args.file_extensions && args.file_extensions.length > 0) {
        args.file_extensions.forEach(ext => {
          rgArgs.push("-g", `*${ext}`);
        });
      }

      rgArgs.push("--", args.query, root);

      // Execute ripgrep
      let output: string;
      try {
        output = execSync(`rg ${rgArgs.join(" ")}`, {
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });
      } catch (error: any) {
        // ripgrep exits with code 1 if no matches found
        if (error.status === 1) {
          return {
            query: args.query,
            results: [],
            total: 0,
          };
        }
        throw error;
      }

      // Parse ripgrep JSON output
      const results: Array<{
        file: string;
        line: number;
        match: string;
        column?: number;
      }> = [];

      const lines = output.trim().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          if (data.type === "match") {
            const relativePath = path.relative(root, data.data.path.text);
            results.push({
              file: relativePath,
              line: data.data.line_number,
              match: data.data.lines.text.trim(),
              column: data.data.submatches?.[0]?.start,
            });

            if (results.length >= maxResults) {
              break;
            }
          }
        } catch (parseError) {
          // Skip malformed JSON lines
          continue;
        }
      }

      return {
        query: args.query,
        results,
        total: results.length,
        truncated: results.length >= maxResults,
      };
    } catch (error) {
      return this.handleError(error, "local_search_codebase");
    }
  }

  async getFileStats(args: { path: string }): Promise<unknown> {
    try {
      const filePath = this.resolvePath(args.path);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${args.path}`);
      }

      const stats = fs.statSync(filePath);
      const extension = path.extname(args.path);

      let lines = 0;
      if (stats.isFile()) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          lines = content.split("\n").length;
        } catch {
          // If can't read as text, leave lines as 0
        }
      }

      return {
        path: args.path,
        size: stats.size,
        lines,
        extension,
        is_directory: stats.isDirectory(),
        is_file: stats.isFile(),
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
      };
    } catch (error) {
      return this.handleError(error, "local_get_file_stats");
    }
  }

  // Helper: Recursively read directory
  private readDirectoryRecursive(
    dirPath: string,
    maxDepth: number,
    includeHidden: boolean,
    extensions?: string[],
    currentDepth = 0
  ): { files: string[]; directories: string[] } {
    const result = { files: [] as string[], directories: [] as string[] };

    if (currentDepth >= maxDepth) {
      return result;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files unless requested
      if (!includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.getProjectRoot(), fullPath);

      if (entry.isDirectory()) {
        result.directories.push(relativePath);
        
        // Recurse into subdirectories
        if (currentDepth + 1 < maxDepth) {
          const subResult = this.readDirectoryRecursive(
            fullPath,
            maxDepth,
            includeHidden,
            extensions,
            currentDepth + 1
          );
          result.files.push(...subResult.files);
          result.directories.push(...subResult.directories);
        }
      } else if (entry.isFile()) {
        // Filter by extension if specified
        if (extensions && extensions.length > 0) {
          const ext = path.extname(entry.name);
          if (!extensions.includes(ext)) {
            continue;
          }
        }
        result.files.push(relativePath);
      }
    }

    return result;
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

export const localWorkspaceHandler = new LocalWorkspaceHandler();
