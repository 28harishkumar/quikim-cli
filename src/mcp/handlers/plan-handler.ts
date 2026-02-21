/**
 * Plan MCP tool handlers.
 * Save and manage planning documents in .quikim/plan/ directory.
 */

import fs from "fs";
import path from "path";
import { getQuikimProjectRoot } from "../../config/project-root.js";

export class PlanHandler {
  private getPlanDirectory(): string {
    const root = getQuikimProjectRoot();
    return path.join(root, ".quikim", "plan");
  }

  private ensurePlanDirectory(): void {
    const planDir = this.getPlanDirectory();
    if (!fs.existsSync(planDir)) {
      fs.mkdirSync(planDir, { recursive: true });
    }
  }

  private sanitizeFilename(filename: string): string {
    // Normalize path and remove any ../ or ./ attempts
    const normalized = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    
    // Remove leading slash/backslash
    const cleaned = normalized.replace(/^[\/\\]+/, '');
    
    // Ensure .md extension
    if (!cleaned.endsWith(".md")) {
      return cleaned + ".md";
    }
    
    return cleaned;
  }

  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async savePlanFile(args: {
    filename: string;
    content: string;
  }): Promise<unknown> {
    try {
      this.ensurePlanDirectory();
      
      const filename = this.sanitizeFilename(args.filename);
      const planDir = this.getPlanDirectory();
      const filePath = path.join(planDir, filename);
      
      // Ensure parent directories exist (for subdirectories)
      this.ensureDirectoryExists(filePath);
      
      // Write file
      fs.writeFileSync(filePath, args.content, "utf-8");
      
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(getQuikimProjectRoot(), filePath);
      
      return {
        success: true,
        path: relativePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    } catch (error) {
      return this.handleError(error, "save_plan_file");
    }
  }

  async readPlanFile(args: { filename: string }): Promise<unknown> {
    try {
      const filename = this.sanitizeFilename(args.filename);
      const planDir = this.getPlanDirectory();
      const filePath = path.join(planDir, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Plan file not found: ${filename}`);
      }
      
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(getQuikimProjectRoot(), filePath);
      
      return {
        filename,
        path: relativePath,
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    } catch (error) {
      return this.handleError(error, "read_plan_file");
    }
  }

  async listPlanFiles(): Promise<unknown> {
    try {
      const planDir = this.getPlanDirectory();
      
      if (!fs.existsSync(planDir)) {
        return {
          files: [],
          directories: [],
          total: 0,
          directory: path.relative(getQuikimProjectRoot(), planDir),
        };
      }
      
      // Recursively collect all .md files
      const files = this.collectMarkdownFiles(planDir, "");
      
      // Sort by most recent first
      files.sort((a, b) => b.modified.localeCompare(a.modified));
      
      // Collect unique directories
      const directories = new Set<string>();
      files.forEach(file => {
        const dir = path.dirname(file.path);
        if (dir !== ".") {
          // Add all parent directories
          const parts = dir.split(path.sep);
          for (let i = 1; i <= parts.length; i++) {
            directories.add(parts.slice(0, i).join(path.sep));
          }
        }
      });
      
      return {
        files,
        directories: Array.from(directories).sort(),
        total: files.length,
        directory: path.relative(getQuikimProjectRoot(), planDir),
      };
    } catch (error) {
      return this.handleError(error, "list_plan_files");
    }
  }

  private collectMarkdownFiles(
    dir: string,
    relativePath: string
  ): Array<{
    path: string;
    name: string;
    size: number;
    modified: string;
    created: string;
  }> {
    const results: Array<{
      path: string;
      name: string;
      size: number;
      modified: string;
      created: string;
    }> = [];
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        // Recurse into subdirectories
        results.push(...this.collectMarkdownFiles(fullPath, relPath));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const stats = fs.statSync(fullPath);
        results.push({
          path: relPath,
          name: entry.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString(),
        });
      }
    }
    
    return results;
  }

  async deletePlanFile(args: { filename: string }): Promise<unknown> {
    try {
      const filename = this.sanitizeFilename(args.filename);
      const planDir = this.getPlanDirectory();
      const filePath = path.join(planDir, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Plan file not found: ${filename}`);
      }
      
      fs.unlinkSync(filePath);
      const relativePath = path.relative(getQuikimProjectRoot(), filePath);
      
      return {
        success: true,
        deleted: relativePath,
      };
    } catch (error) {
      return this.handleError(error, "delete_plan_file");
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

export const planHandler = new PlanHandler();
