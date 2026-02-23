/**
 * Git worktree MCP tool handlers.
 * Enforces branch protection on dev/main/master/production.
 * Active worktree state stored in .quikim/active-worktree.json.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getQuikimProjectRoot } from "../../config/project-root.js";

const PROTECTED_BRANCHES = new Set(["dev", "main", "master", "production"]);
const ACTIVE_WORKTREE_FILE = ".quikim/active-worktree.json";

export class GitWorktreeHandler {
  private getProjectRoot(): string {
    try {
      return getQuikimProjectRoot();
    } catch {
      throw new Error("No project found. Run from within a Quikim project directory.");
    }
  }

  /** Run a git command and return trimmed stdout. Throws on non-zero exit. */
  private exec(cmd: string, cwd?: string): string {
    return execSync(cmd, {
      cwd: cwd ?? this.getProjectRoot(),
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    }).trim();
  }

  /** Resolve and security-check a worktree path from its slug. */
  private getWorktreePath(slug: string): string {
    const root = this.getProjectRoot();
    const worktreesDir = path.join(root, "worktrees");
    const resolved = path.resolve(worktreesDir, slug);
    if (!resolved.startsWith(worktreesDir + path.sep) && resolved !== worktreesDir) {
      throw new Error(`Path traversal detected in worktree slug: "${slug}"`);
    }
    return resolved;
  }

  /** Read active worktree from session file. Returns null if none set. */
  private readActive(): { slug: string; branch: string; path: string } | null {
    const root = this.getProjectRoot();
    const activeFile = path.join(root, ACTIVE_WORKTREE_FILE);
    if (!fs.existsSync(activeFile)) return null;
    try {
      return JSON.parse(fs.readFileSync(activeFile, "utf-8"));
    } catch {
      return null;
    }
  }

  /** Write active worktree to session file. */
  private writeActive(slug: string, branch: string, worktreePath: string): void {
    const root = this.getProjectRoot();
    const activeFile = path.join(root, ACTIVE_WORKTREE_FILE);
    fs.mkdirSync(path.dirname(activeFile), { recursive: true });
    fs.writeFileSync(activeFile, JSON.stringify({ slug, branch, path: worktreePath }, null, 2));
  }

  /** Clear active worktree session file. */
  private clearActive(): void {
    const root = this.getProjectRoot();
    const activeFile = path.join(root, ACTIVE_WORKTREE_FILE);
    if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
  }

  private handleError(error: unknown, toolName: string) {
    return {
      error: true,
      message: error instanceof Error ? error.message : String(error),
      tool: toolName,
    };
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  async list(): Promise<unknown> {
    try {
      const root = this.getProjectRoot();
      const output = this.exec("git worktree list --porcelain");
      const active = this.readActive();
      const worktreesDir = path.join(root, "worktrees");

      const worktrees: Array<{
        path: string;
        branch: string;
        HEAD?: string;
        is_main: boolean;
        slug?: string;
        is_active: boolean;
      }> = [];
      
      for (const block of output.split("\n\n").filter(Boolean)) {
        const entry: { absPath?: string; HEAD?: string; branch?: string } = {};
        for (const line of block.trim().split("\n")) {
          if (line.startsWith("worktree ")) entry.absPath = line.substring(9);
          else if (line.startsWith("HEAD "))   entry.HEAD = line.substring(5);
          else if (line.startsWith("branch ")) entry.branch = line.substring(7).replace("refs/heads/", "");
        }
        const isMain = entry.absPath === root;
        const slug = !isMain && entry.absPath?.startsWith(worktreesDir)
          ? path.relative(worktreesDir, entry.absPath)
          : undefined;
        const relPath = isMain ? "." : path.relative(root, entry.absPath ?? "");

        worktrees.push({
          path: relPath,
          branch: entry.branch ?? "(detached)",
          HEAD: entry.HEAD ?? "",
          is_main: isMain,
          ...(slug ? { slug } : {}),
          is_active: active?.slug === slug,
        });
      }

      return { worktrees, total: worktrees.length, active_slug: active?.slug ?? null };
    } catch (error) {
      return this.handleError(error, "git_worktree_list");
    }
  }

  async add(args: {
    slug: string;
    branch: string;
    base_branch?: string;
    set_active?: boolean;
  }): Promise<unknown> {
    try {
      const root = this.getProjectRoot();
      const baseBranch = args.base_branch ?? "dev";
      const setActive = args.set_active ?? true;

      // Validate branch names
      if (PROTECTED_BRANCHES.has(args.branch)) {
        throw new Error(`BLOCKED: Cannot create a worktree named after a protected branch: "${args.branch}"`);
      }

      const worktreePath = this.getWorktreePath(args.slug);
      if (fs.existsSync(worktreePath)) {
        throw new Error(`Worktree directory already exists: worktrees/${args.slug}`);
      }

      fs.mkdirSync(path.join(root, "worktrees"), { recursive: true });
      this.exec(`git worktree add "${worktreePath}" -b "${args.branch}" "${baseBranch}"`);

      if (setActive) {
        this.writeActive(args.slug, args.branch, `worktrees/${args.slug}`);
      }

      return {
        path: `worktrees/${args.slug}`,
        branch: args.branch,
        base: baseBranch,
        created: true,
        active: setActive,
      };
    } catch (error) {
      return this.handleError(error, "git_worktree_add");
    }
  }

  async remove(args: { slug: string; force?: boolean }): Promise<unknown> {
    try {
      const worktreePath = this.getWorktreePath(args.slug);
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree not found: worktrees/${args.slug}`);
      }

      const forceFlag = args.force ? " --force" : "";
      this.exec(`git worktree remove "${worktreePath}"${forceFlag}`);

      const active = this.readActive();
      let activeCleared = false;
      if (active?.slug === args.slug) {
        this.clearActive();
        activeCleared = true;
      }

      return { slug: args.slug, removed: true, active_cleared: activeCleared };
    } catch (error) {
      return this.handleError(error, "git_worktree_remove");
    }
  }

  async status(args: { slug: string }): Promise<unknown> {
    try {
      const worktreePath = this.getWorktreePath(args.slug);
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree not found: worktrees/${args.slug}`);
      }

      const branch = this.exec("git branch --show-current", worktreePath);
      const statusOutput = this.exec("git status --porcelain", worktreePath);
      const lastCommit = this.exec("git log --oneline -1", worktreePath);

      const modified: string[] = [];
      const staged: string[] = [];
      const untracked: string[] = [];

      for (const line of statusOutput.split("\n").filter(Boolean)) {
        const xy = line.substring(0, 2);
        const file = line.substring(3);
        if (xy[0] !== " " && xy[0] !== "?") staged.push(file);
        if (xy[1] === "M" || xy[1] === "D") modified.push(file);
        if (xy === "??") untracked.push(file);
      }

      return {
        slug: args.slug,
        branch,
        last_commit: lastCommit,
        modified,
        staged,
        untracked,
        clean: modified.length === 0 && staged.length === 0,
      };
    } catch (error) {
      return this.handleError(error, "git_worktree_status");
    }
  }

  async commit(args: {
    slug: string;
    message: string;
    paths?: string[];
  }): Promise<unknown> {
    try {
      const worktreePath = this.getWorktreePath(args.slug);
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree not found: worktrees/${args.slug}`);
      }

      // Confirm we are NOT on a protected branch inside the worktree
      const branch = this.exec("git branch --show-current", worktreePath);
      if (PROTECTED_BRANCHES.has(branch)) {
        throw new Error(
          `BLOCKED: Worktree "${args.slug}" is on protected branch "${branch}". ` +
          `This should never happen — create a new worktree from dev instead.`
        );
      }

      const pathsArg = args.paths?.length
        ? args.paths.map((p) => `"${p}"`).join(" ")
        : "-A";
      this.exec(`git add ${pathsArg}`, worktreePath);

      const staged = this.exec("git diff --cached --name-only", worktreePath);
      if (!staged) {
        throw new Error("Nothing staged to commit. Check that paths have uncommitted changes.");
      }

      const filesCommitted = staged.split("\n").filter(Boolean).length;
      this.exec(`git commit -m ${JSON.stringify(args.message)}`, worktreePath);
      const commitHash = this.exec("git rev-parse --short HEAD", worktreePath);

      return { slug: args.slug, branch, commit_hash: commitHash, files_committed: filesCommitted, message: args.message };
    } catch (error) {
      return this.handleError(error, "git_worktree_commit");
    }
  }

  async diff(args: {
    slug: string;
    compare_to?: string;
    stat_only?: boolean;
    path?: string;
  }): Promise<unknown> {
    try {
      const worktreePath = this.getWorktreePath(args.slug);
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree not found: worktrees/${args.slug}`);
      }

      let cmd = "git diff";
      if (args.stat_only) cmd += " --stat";
      if (args.compare_to) cmd += ` ${args.compare_to}`;
      if (args.path) cmd += ` -- "${args.path}"`;

      const diff = this.exec(cmd, worktreePath);

      // Parse stats
      const statsMatch = diff.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
      return {
        slug: args.slug,
        diff: args.stat_only ? undefined : diff,
        stat: args.stat_only ? diff : undefined,
        files_changed: statsMatch ? parseInt(statsMatch[1]) : 0,
        insertions: statsMatch ? parseInt(statsMatch[2] ?? "0") : 0,
        deletions: statsMatch ? parseInt(statsMatch[3] ?? "0") : 0,
      };
    } catch (error) {
      return this.handleError(error, "git_worktree_diff");
    }
  }

  async setActive(args: { slug: string }): Promise<unknown> {
    try {
      const worktreePath = this.getWorktreePath(args.slug);
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree not found: worktrees/${args.slug}`);
      }

      const branch = this.exec("git branch --show-current", worktreePath);
      this.writeActive(args.slug, branch, `worktrees/${args.slug}`);

      return { active_slug: args.slug, branch, path: `worktrees/${args.slug}` };
    } catch (error) {
      return this.handleError(error, "git_worktree_set_active");
    }
  }

  async getActive(): Promise<unknown> {
    try {
      const active = this.readActive();
      if (!active) {
        return { active_slug: null, message: "No active worktree set. Call git_worktree_set_active or pass worktree_slug to write tools." };
      }
      return active;
    } catch (error) {
      return this.handleError(error, "git_worktree_get_active");
    }
  }

  async mergeToDev(args: { branch: string; push?: boolean }): Promise<unknown> {
    try {
      const root = this.getProjectRoot();

      if (PROTECTED_BRANCHES.has(args.branch)) {
        throw new Error(`BLOCKED: Cannot merge a protected branch "${args.branch}" — it is already on dev/main.`);
      }

      try { this.exec("git fetch origin"); } catch { /* offline */ }

      // Merge from the main repo checkout (not a worktree)
      const originalBranch = this.exec("git branch --show-current", root);

      this.exec("git checkout dev", root);
      this.exec(`git merge --no-ff "${args.branch}" -m "merge: ${args.branch} → dev"`, root);
      const mergeCommit = this.exec("git rev-parse --short HEAD", root);

      let pushed = false;
      if (args.push) {
        this.exec("git push origin dev", root);
        pushed = true;
      }

      // Restore — but only if not a protected branch (safety)
      if (originalBranch && !PROTECTED_BRANCHES.has(originalBranch)) {
        try { this.exec(`git checkout "${originalBranch}"`, root); } catch { /* ok */ }
      }

      return { merged: true, branch: args.branch, into: "dev", merge_commit: mergeCommit, pushed };
    } catch (error) {
      return this.handleError(error, "git_merge_to_dev");
    }
  }

  async mergeDevToMain(args: {
    push?: boolean;
    tag?: string;
    tag_message?: string;
  }): Promise<unknown> {
    try {
      const root = this.getProjectRoot();
      try { this.exec("git fetch origin"); } catch { /* offline */ }

      const originalBranch = this.exec("git branch --show-current", root);

      this.exec("git checkout main", root);
      this.exec(`git merge --no-ff dev -m "merge: dev → main"`, root);
      const mergeCommit = this.exec("git rev-parse --short HEAD", root);

      let tagged: string | undefined;
      if (args.tag) {
        const msg = args.tag_message ?? args.tag;
        this.exec(`git tag -a ${JSON.stringify(args.tag)} -m ${JSON.stringify(msg)}`, root);
        tagged = args.tag;
      }

      let pushed = false;
      if (args.push) {
        this.exec("git push origin main", root);
        if (tagged) this.exec("git push origin --tags", root);
        pushed = true;
      }

      if (originalBranch && !PROTECTED_BRANCHES.has(originalBranch)) {
        try { this.exec(`git checkout "${originalBranch}"`, root); } catch { /* ok */ }
      }

      return { merged: true, into: "main", merge_commit: mergeCommit, tagged, pushed };
    } catch (error) {
      return this.handleError(error, "git_merge_dev_to_main");
    }
  }
}

export const gitWorktreeHandler = new GitWorktreeHandler();
