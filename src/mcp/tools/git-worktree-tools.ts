/**
 * MCP tool definitions for git worktree operations.
 * Create isolated branch workspaces, commit, merge, set active context.
 *
 * PROTECTED BRANCHES: dev, main, master, production.
 * Claude can never checkout, reset, rebase, or amend commits on these branches.
 * Merges INTO dev/main go through git_merge_to_dev / git_merge_dev_to_main only.
 */

export const gitWorktreeTools = [
  {
    name: "git_worktree_list",
    description:
      "List all existing git worktrees and which one is currently active.\n\n" +
      "Example response:\n" +
      '{"worktrees": [{"path": ".", "branch": "dev", "is_main": true}, {"path": "worktrees/fix-auth", "branch": "claude/fix-auth", "slug": "fix-auth", "is_active": true}], "active_slug": "fix-auth"}',
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "git_worktree_add",
    description:
      "Create a new worktree at worktrees/<slug> branched from base_branch (default: dev).\n" +
      "Optionally calls git_worktree_set_active automatically.\n\n" +
      "Example request:\n" +
      '{"slug": "fix-artifact-service", "branch": "claude/fix-artifact-service", "base_branch": "dev", "set_active": true}\n\n' +
      "Example response:\n" +
      '{"path": "worktrees/fix-artifact-service", "branch": "claude/fix-artifact-service", "base": "dev", "created": true, "active": true}',
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Directory name under worktrees/, e.g. 'fix-artifact-service'",
        },
        branch: {
          type: "string",
          description: "New branch name, e.g. 'claude/fix-artifact-service'",
        },
        base_branch: {
          type: "string",
          description: "Base branch (default: 'dev'). Must not be a protected branch.",
        },
        set_active: {
          type: "boolean",
          description: "Automatically set this worktree as active after creation (default: true)",
        },
      },
      required: ["slug", "branch"],
    },
  },
  {
    name: "git_worktree_remove",
    description:
      "Remove a worktree checkout. Does NOT delete the branch.\n" +
      "Clears active-worktree if the removed slug was active.\n\n" +
      "Example request:\n" +
      '{"slug": "fix-artifact-service"}\n\n' +
      "Example response:\n" +
      '{"slug": "fix-artifact-service", "removed": true, "active_cleared": true}',
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Worktree slug to remove" },
        force: {
          type: "boolean",
          description: "Force remove even with uncommitted changes (default: false)",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "git_worktree_status",
    description:
      "Show git status inside a worktree — modified, staged, untracked files.\n\n" +
      "Example request:\n" +
      '{"slug": "fix-artifact-service"}\n\n' +
      "Example response:\n" +
      '{"slug": "fix-artifact-service", "branch": "claude/fix-artifact-service", "modified": ["services/artifact-service/src/app.ts"], "staged": [], "untracked": [], "clean": false, "last_commit": "abc1234 fix: initial stub"}',
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Worktree slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "git_worktree_commit",
    description:
      "Stage files and commit inside a worktree. Use conventional commit format.\n" +
      "paths defaults to all changes if omitted.\n\n" +
      "Example request:\n" +
      '{"slug": "fix-artifact-service", "message": "fix(artifact-service): add auth middleware, fix atomic rootId", "paths": ["services/artifact-service/"]}\n\n' +
      "Example response:\n" +
      '{"slug": "fix-artifact-service", "commit_hash": "abc1234", "files_committed": 3, "branch": "claude/fix-artifact-service"}',
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Worktree slug" },
        message: {
          type: "string",
          description: "Commit message. Use conventional commits: fix/feat/refactor/chore(scope): description",
        },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Paths to stage relative to worktree root. Omit to stage all changes.",
        },
      },
      required: ["slug", "message"],
    },
  },
  {
    name: "git_worktree_diff",
    description:
      "Show uncommitted diff inside a worktree, or diff against another branch.\n\n" +
      "Example request:\n" +
      '{"slug": "fix-artifact-service", "stat_only": true}\n\n' +
      "Example response:\n" +
      '{"slug": "fix-artifact-service", "diff": "...", "files_changed": 2, "insertions": 18, "deletions": 4}',
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Worktree slug" },
        compare_to: {
          type: "string",
          description: "Branch/commit to diff against (default: HEAD = show unstaged changes)",
        },
        stat_only: {
          type: "boolean",
          description: "Return only summary stats, not full diff (default: false)",
        },
        path: {
          type: "string",
          description: "Limit diff to a specific file or directory",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "git_worktree_set_active",
    description:
      "Set a worktree as the session default. Subsequent write tools and bash_exec will target " +
      "this worktree automatically when worktree_slug is not explicitly passed.\n\n" +
      "Example request:\n" +
      '{"slug": "fix-artifact-service"}\n\n' +
      "Example response:\n" +
      '{"active_slug": "fix-artifact-service", "branch": "claude/fix-artifact-service", "path": "worktrees/fix-artifact-service"}',
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Worktree slug to make active" },
      },
      required: ["slug"],
    },
  },
  {
    name: "git_worktree_get_active",
    description:
      "Get the currently active worktree for this session.\n\n" +
      "Example response:\n" +
      '{"active_slug": "fix-artifact-service", "branch": "claude/fix-artifact-service", "path": "worktrees/fix-artifact-service"}',
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "git_merge_to_dev",
    description:
      "Merge a worktree branch into dev using --no-ff. Optionally push dev to origin.\n" +
      "BLOCKED on: git reset, rebase, amend, force-push.\n\n" +
      "Example request:\n" +
      '{"branch": "claude/fix-artifact-service", "push": true}\n\n' +
      "Example response:\n" +
      '{"merged": true, "branch": "claude/fix-artifact-service", "into": "dev", "merge_commit": "abc1234", "pushed": true}',
    inputSchema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "Branch to merge into dev",
        },
        push: {
          type: "boolean",
          description: "Push dev to origin after merge (default: false)",
        },
      },
      required: ["branch"],
    },
  },
  {
    name: "git_merge_dev_to_main",
    description:
      "Merge dev into main using --no-ff. Optionally tag and push.\n" +
      "Only call after all feature branches are on dev and verified.\n\n" +
      "Example request:\n" +
      '{"push": true, "tag": "v0.5.0", "tag_message": "Service audit fixes phase 1"}\n\n' +
      "Example response:\n" +
      '{"merged": true, "into": "main", "merge_commit": "abc1234", "tagged": "v0.5.0", "pushed": true}',
    inputSchema: {
      type: "object",
      properties: {
        push: { type: "boolean", description: "Push main + tags to origin after merge (default: false)" },
        tag: { type: "string", description: "Semver tag to create, e.g. 'v0.5.0'" },
        tag_message: { type: "string", description: "Annotated tag message" },
      },
    },
  },
];
