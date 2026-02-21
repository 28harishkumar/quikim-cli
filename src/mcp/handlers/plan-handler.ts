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
    // Remove path traversal attempts
    const basename = path.basename(filename);
    
    // Ensure .md extension
    if (!basename.endsWith(".md")) {
      return basename + ".md";
    }
    
    return basename;
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
          total: 0,
          directory: path.relative(getQuikimProjectRoot(), planDir),
        };
      }
      
      const entries = fs.readdirSync(planDir, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => {
          const filePath = path.join(planDir, entry.name);
          const stats = fs.statSync(filePath);
          return {
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            created: stats.birthtime.toISOString(),
          };
        })
        .sort((a, b) => b.modified.localeCompare(a.modified)); // Most recent first
      
      return {
        files,
        total: files.length,
        directory: path.relative(getQuikimProjectRoot(), planDir),
      };
    } catch (error) {
      return this.handleError(error, "list_plan_files");
    }
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
