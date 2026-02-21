/**
 * Git MCP tool handlers.
 * Search and analyze git history locally.
 */

import { execSync } from "child_process";
import { getQuikimProjectRoot } from "../../config/project-root.js";

export class GitHandler {
  private getProjectRoot(): string {
    try {
      return getQuikimProjectRoot();
    } catch (error) {
      throw new Error("No project found. Run from within a Quikim project directory.");
    }
  }

  async gitLog(args: {
    max_count?: number;
    author?: string;
    since?: string;
    until?: string;
    grep?: string;
    file_path?: string;
  }): Promise<unknown> {
    try {
      const cwd = this.getProjectRoot();
      const maxCount = args.max_count ?? 20;
      
      // Build git log command
      let cmd = `git log --max-count=${maxCount} --pretty=format:'%H|%an|%ae|%ad|%s' --date=iso`;
      
      if (args.author) {
        cmd += ` --author="${args.author}"`;
      }
      
      if (args.since) {
        cmd += ` --since="${args.since}"`;
      }
      
      if (args.until) {
        cmd += ` --until="${args.until}"`;
      }
      
      if (args.grep) {
        cmd += ` --grep="${args.grep}"`;
      }
      
      if (args.file_path) {
        cmd += ` -- "${args.file_path}"`;
      }
      
      const output = execSync(cmd, {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      
      if (!output.trim()) {
        return {
          commits: [],
          total: 0,
        };
      }
      
      const lines = output.trim().split("\n");
      const commits = lines.map((line) => {
        const [hash, authorName, authorEmail, date, ...messageParts] = line.split("|");
        return {
          hash: hash.trim(),
          author_name: authorName.trim(),
          author_email: authorEmail.trim(),
          date: date.trim(),
          message: messageParts.join("|").trim(),
        };
      });
      
      return {
        commits,
        total: commits.length,
      };
    } catch (error) {
      return this.handleError(error, "git_log");
    }
  }

  async gitShow(args: {
    commit_hash: string;
    show_diff?: boolean;
  }): Promise<unknown> {
    try {
      const cwd = this.getProjectRoot();
      const showDiff = args.show_diff ?? true;
      
      // Get commit details
      const detailsCmd = `git show --pretty=format:'%H|%an|%ae|%ad|%s|%b' --no-patch ${args.commit_hash}`;
      const details = execSync(detailsCmd, {
        cwd,
        encoding: "utf-8",
      });
      
      const [hash, authorName, authorEmail, date, subject, ...bodyParts] = details.trim().split("|");
      
      const result: any = {
        hash: hash.trim(),
        author_name: authorName.trim(),
        author_email: authorEmail.trim(),
        date: date.trim(),
        subject: subject.trim(),
        body: bodyParts.join("|").trim(),
      };
      
      if (showDiff) {
        const diffCmd = `git show ${args.commit_hash}`;
        const diff = execSync(diffCmd, {
          cwd,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        });
        result.diff = diff;
      }
      
      return result;
    } catch (error) {
      return this.handleError(error, "git_show");
    }
  }

  async gitBlame(args: {
    file_path: string;
    start_line?: number;
    end_line?: number;
  }): Promise<unknown> {
    try {
      const cwd = this.getProjectRoot();
      
      let cmd = `git blame --line-porcelain`;
      
      if (args.start_line && args.end_line) {
        cmd += ` -L ${args.start_line},${args.end_line}`;
      }
      
      cmd += ` "${args.file_path}"`;
      
      const output = execSync(cmd, {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      
      // Parse porcelain format
      const lines: Array<{
        line_number: number;
        hash: string;
        author: string;
        author_email: string;
        date: string;
        content: string;
      }> = [];
      
      const blocks = output.split(/^(?=[0-9a-f]{40})/m);
      
      for (const block of blocks) {
        if (!block.trim()) continue;
        
        const blockLines = block.split("\n");
        const firstLine = blockLines[0].split(" ");
        const hash = firstLine[0];
        
        let author = "";
        let authorEmail = "";
        let date = "";
        let content = "";
        
        for (const line of blockLines) {
          if (line.startsWith("author ")) {
            author = line.substring(7);
          } else if (line.startsWith("author-mail ")) {
            authorEmail = line.substring(12).replace(/<|>/g, "");
          } else if (line.startsWith("author-time ")) {
            const timestamp = parseInt(line.substring(12));
            date = new Date(timestamp * 1000).toISOString();
          } else if (line.startsWith("\t")) {
            content = line.substring(1);
          }
        }
        
        const lineNumber = parseInt(firstLine[2]);
        
        lines.push({
          line_number: lineNumber,
          hash,
          author,
          author_email: authorEmail,
          date,
          content,
        });
      }
      
      return {
        file_path: args.file_path,
        lines,
        total: lines.length,
      };
    } catch (error) {
      return this.handleError(error, "git_blame");
    }
  }

  async gitDiff(args: {
    commit_a?: string;
    commit_b?: string;
    file_path?: string;
    staged?: boolean;
    stat?: boolean;
  }): Promise<unknown> {
    try {
      const cwd = this.getProjectRoot();
      
      let cmd = "git diff";
      
      if (args.staged) {
        cmd += " --staged";
      }
      
      if (args.stat) {
        cmd += " --stat";
      }
      
      if (args.commit_a) {
        cmd += ` ${args.commit_a}`;
        if (args.commit_b) {
          cmd += ` ${args.commit_b}`;
        }
      }
      
      if (args.file_path) {
        cmd += ` -- "${args.file_path}"`;
      }
      
      const diff = execSync(cmd, {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      
      // Parse stats if available
      let filesChanged = 0;
      let insertions = 0;
      let deletions = 0;
      
      if (args.stat || diff.includes("files changed")) {
        const statsMatch = diff.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        if (statsMatch) {
          filesChanged = parseInt(statsMatch[1] || "0");
          insertions = parseInt(statsMatch[2] || "0");
          deletions = parseInt(statsMatch[3] || "0");
        }
      }
      
      return {
        diff,
        files_changed: filesChanged,
        insertions,
        deletions,
      };
    } catch (error) {
      return this.handleError(error, "git_diff");
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

export const gitHandler = new GitHandler();
