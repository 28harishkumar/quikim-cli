/**
 * Local workspace MCP tool handlers.
 * These read directly from the local filesystem.
 */

import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { getQuikimProjectRoot } from "../../config/project-root.js";

export class LocalWorkspaceHandler {
  private getProjectRoot(): string {
    try {
      return getQuikimProjectRoot();
    } catch (error) {
      throw new Error("No project found. Run from within a Quikim project directory.");
    }
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

  /**
   * Resolve a write path safely.
   * - If worktree_slug is given → resolves to worktrees/<slug>/<path>
   * - If active worktree is set in .quikim/active-worktree.json → use that
   * - If neither → resolves to project root/<path>, BUT throws if main
   *   worktree's current branch is dev or main.
   */
  private resolveWritePath(
    filePath: string,
    worktreeSlug?: string
  ): string {
    const root = this.getProjectRoot();

    // 1. Explicit slug → always safe
    if (worktreeSlug) {
      const worktreesDir = path.join(root, "worktrees");
      const worktreePath = path.resolve(worktreesDir, worktreeSlug);
      if (!worktreePath.startsWith(worktreesDir)) {
        throw new Error("Path traversal detected in worktree_slug");
      }
      const resolved = path.resolve(worktreePath, filePath);
      if (!resolved.startsWith(worktreePath)) {
        throw new Error("Path traversal detected — path escapes the worktree");
      }
      return resolved;
    }

    // 2. Check active worktree from session file
    const activeWorktreeFile = path.join(root, ".quikim", "active-worktree.json");
    if (fs.existsSync(activeWorktreeFile)) {
      try {
        const active = JSON.parse(fs.readFileSync(activeWorktreeFile, "utf-8"));
        if (active?.slug) {
          const worktreesDir = path.join(root, "worktrees");
          const worktreePath = path.resolve(worktreesDir, active.slug);
          const resolved = path.resolve(worktreePath, filePath);
          if (!resolved.startsWith(worktreePath)) {
            throw new Error("Path traversal detected — path escapes the active worktree");
          }
          return resolved;
        }
      } catch {
        // If file is corrupt, fall through to branch check
      }
    }

    // 3. No worktree context — resolve from project root but check branch
    const resolved = path.resolve(root, filePath);
    if (!resolved.startsWith(root)) {
      throw new Error("Path traversal detected");
    }

    // Branch safety check: refuse writes if main checkout is on dev or main
    try {
      const currentBranch = execSync("git branch --show-current", {
        cwd: root,
        encoding: "utf-8",
      }).trim();
      const protectedBranches = ["dev", "main", "master", "production"];
      if (protectedBranches.includes(currentBranch)) {
        throw new Error(
          `BLOCKED: Cannot write files directly to the '${currentBranch}' branch checkout. ` +
          `Create a worktree first (git_worktree_add) and pass worktree_slug to this tool, ` +
          `or call git_worktree_set_active to set a default worktree for the session.`
        );
      }
    } catch (err: unknown) {
      // If the error is our own block, re-throw it
      if (err instanceof Error && err.message?.startsWith("BLOCKED:")) throw err;
      // Otherwise git might not be available — allow (non-git scenarios)
    }

    return resolved;
  }

  async writeFile(args: {
    path: string;
    content: string;
    worktree_slug?: string;
    create_dirs?: boolean;
  }): Promise<unknown> {
    try {
      const filePath = this.resolveWritePath(args.path, args.worktree_slug);
      const createDirs = args.create_dirs ?? true;
      const existed = fs.existsSync(filePath);

      if (createDirs) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      fs.writeFileSync(filePath, args.content, "utf-8");
      const stats = fs.statSync(filePath);

      return {
        path: filePath.replace(this.getProjectRoot() + path.sep, ""),
        size: stats.size,
        lines: args.content.split("\n").length,
        created: !existed,
      };
    } catch (error) {
      return this.handleError(error, "local_write_file");
    }
  }

  async strReplace(args: {
    path: string;
    old_str: string;
    new_str?: string;
    worktree_slug?: string;
  }): Promise<unknown> {
    try {
      const filePath = this.resolveWritePath(args.path, args.worktree_slug);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${args.path}`);
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const newStr = args.new_str ?? "";

      const occurrences = content.split(args.old_str).length - 1;
      if (occurrences === 0) {
        throw new Error(
          `old_str not found in file.\nSearched for: ${args.old_str.substring(0, 120)}`
        );
      }
      if (occurrences > 1) {
        throw new Error(
          `old_str appears ${occurrences} times — must be unique. Add more surrounding context lines to make it unique.`
        );
      }

      const updated = content.replace(args.old_str, newStr);
      fs.writeFileSync(filePath, updated, "utf-8");

      return {
        path: filePath.replace(this.getProjectRoot() + path.sep, ""),
        replaced: true,
        lines_removed: args.old_str.split("\n").length,
        lines_added: newStr.split("\n").length,
      };
    } catch (error) {
      return this.handleError(error, "local_str_replace");
    }
  }

  async deleteFile(args: {
    path: string;
    worktree_slug?: string;
  }): Promise<unknown> {
    try {
      const filePath = this.resolveWritePath(args.path, args.worktree_slug);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${args.path}`);
      }
      if (fs.statSync(filePath).isDirectory()) {
        throw new Error(`Path is a directory — use bash_exec with rm -rf to remove directories.`);
      }

      fs.unlinkSync(filePath);

      return {
        path: filePath.replace(this.getProjectRoot() + path.sep, ""),
        deleted: true,
      };
    } catch (error) {
      return this.handleError(error, "local_delete_file");
    }
  }

  async bashExec(args: {
    command: string;
    worktree_slug?: string;
    cwd?: string;
    timeout_ms?: number;
  }): Promise<unknown> {
    try {
      const root = this.getProjectRoot();

      // ── Resolve working directory ──────────────────────────────────────────
      // Priority: worktree_slug + cwd > active worktree + cwd > project root + cwd
      let baseDir = root;

      const slugToUse = args.worktree_slug ?? (() => {
        const activeFile = path.join(root, ".quikim", "active-worktree.json");
        if (fs.existsSync(activeFile)) {
          try {
            const active = JSON.parse(fs.readFileSync(activeFile, "utf-8"));
            return active?.slug as string | undefined;
          } catch { return undefined; }
        }
        return undefined;
      })();

      if (slugToUse) {
        const worktreesDir = path.join(root, "worktrees");
        const worktreePath = path.resolve(worktreesDir, slugToUse);
        if (!worktreePath.startsWith(worktreesDir)) {
          throw new Error("Path traversal detected in worktree_slug");
        }
        baseDir = worktreePath;
      }

      let cwd = baseDir;
      if (args.cwd) {
        const resolvedCwd = path.resolve(baseDir, args.cwd);
        // Allow anywhere inside the determined base (worktree or project root)
        if (!resolvedCwd.startsWith(root)) {
          throw new Error("cwd path traversal — must stay within project root");
        }
        cwd = resolvedCwd;
      }

      // ── Blocklist ──────────────────────────────────────────────────────────
      const cmd = args.command;
      const blockedPatterns: Array<[RegExp, string]> = [
        // Switching to protected branches
        [/git\s+checkout\s+(dev|main|master|production)\b/, "git checkout onto protected branches"],
        [/git\s+switch\s+(dev|main|master|production)\b/,  "git switch onto protected branches"],
        // History rewriting
        [/git\s+rebase\b/,                                 "git rebase (rewrites history)"],
        [/git\s+reset\b/,                                  "git reset (rewrites history)"],
        [/git\s+commit\s+.*--amend/,                       "git commit --amend (rewrites history)"],
        // Force operations
        [/git\s+push\s+.*--force(?!-with-lease)/,          "git push --force (use --force-with-lease if needed)"],
        [/git\s+push\s+.*-f\s/,                            "git push -f (force push)"],
        // Destructive shell
        [/rm\s+-rf\s+(\/|~)\b/,                            "rm -rf of filesystem root or home"],
        [/:\(\)\{\s*:\|:&\s*\};:/,                         "fork bomb"],
        [/>\s*\/dev\/sd/,                                  "write to block device"],
      ];

      for (const [pattern, reason] of blockedPatterns) {
        if (pattern.test(cmd)) {
          throw new Error(`BLOCKED (${reason}): ${cmd}`);
        }
      }

      // ── Execute ────────────────────────────────────────────────────────────
      const timeoutMs = Math.min(args.timeout_ms ?? 60_000, 600_000);

      const result = spawnSync(cmd, {
        shell: true,
        cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf-8",
        // Inherit the full shell environment so pnpm/volta/nvm/asdf binaries are on PATH
        env: {
          ...process.env,
          // Force non-interactive mode for package managers
          CI: "true",
          PNPM_HOME: process.env.PNPM_HOME ?? "",
        },
      });

      const stdout = (result.stdout ?? "").trim();
      const stderr = (result.stderr ?? "").trim();
      const exitCode = result.status ?? (result.signal ? 1 : 0);

      return {
        stdout,
        stderr,
        exit_code: exitCode,
        success: exitCode === 0,
        cwd: path.relative(root, cwd) || ".",
        timed_out: result.signal === "SIGTERM",
      };
    } catch (error) {
      return this.handleError(error, "bash_exec");
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

export const localWorkspaceHandler = new LocalWorkspaceHandler();
