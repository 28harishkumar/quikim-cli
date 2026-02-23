/**
 * MCP tool definitions for LOCAL workspace operations.
 * These read/write directly from your local filesystem.
 */

export const localWorkspaceTools = [
  {
    name: "local_list_directory",
    description:
      "List files and directories in your LOCAL project workspace. Reads directly from filesystem.\n\n" +
      "Example request:\n" +
      '{"path": "src/components", "depth": 2, "include_hidden": false}\n\n' +
      "Example response:\n" +
      '{"files": ["Button.tsx", "Input.tsx"], "directories": ["forms", "layout"], "total": 4}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root. Empty string for root.",
        },
        depth: {
          type: "number",
          description: "Max recursion depth (1-5, default: 2)",
        },
        include_hidden: {
          type: "boolean",
          description: "Include hidden files/directories (default: false)",
        },
        file_extensions: {
          type: "array",
          items: { type: "string" },
          description: "Filter by extensions, e.g. ['.ts', '.tsx']",
        },
      },
    },
  },
  {
    name: "local_read_file",
    description:
      "Read the full content of a file from your LOCAL filesystem.\n\n" +
      "Example request:\n" +
      '{"path": "src/App.tsx", "encoding": "utf-8"}\n\n' +
      "Example response:\n" +
      '{"content": "import React from \'react\';\\n...", "size": 1234, "lines": 45}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root",
        },
        encoding: {
          type: "string",
          enum: ["utf-8", "base64"],
          description: "Output encoding (default: utf-8)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "local_read_file_lines",
    description:
      "Read specific lines from a LOCAL file. Use for large files.\n\n" +
      "Example request:\n" +
      '{"path": "src/App.tsx", "start_line": 10, "end_line": 20}\n\n' +
      "Example response:\n" +
      '{"content": "  const [state, setState] = ...\\n...", "start_line": 10, "end_line": 20, "total_lines": 45}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root",
        },
        start_line: {
          type: "number",
          description: "First line to read (1-indexed)",
        },
        end_line: {
          type: "number",
          description: "Last line to read (inclusive)",
        },
      },
      required: ["path", "start_line", "end_line"],
    },
  },
  {
    name: "local_search_codebase",
    description:
      "Search for text or patterns in your LOCAL codebase using ripgrep.\n\n" +
      "Example request:\n" +
      '{"query": "useState", "search_type": "content", "file_extensions": [".tsx"], "max_results": 50}\n\n' +
      "Example response:\n" +
      '{"results": [{"file": "src/App.tsx", "line": 5, "match": "const [state, setState] = useState(0)"}], "total": 12}',
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        search_type: {
          type: "string",
          enum: ["content", "filename", "both"],
          description: "Where to search (default: content)",
        },
        file_extensions: {
          type: "array",
          items: { type: "string" },
          description: "Filter by extensions",
        },
        max_results: {
          type: "number",
          description: "Max results (default: 50)",
        },
        use_regex: {
          type: "boolean",
          description: "Treat query as regex (default: false)",
        },
        case_sensitive: {
          type: "boolean",
          description: "Case sensitive search (default: false)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "local_get_file_stats",
    description:
      "Get file metadata from your LOCAL filesystem without reading content.\n\n" +
      "Example request:\n" +
      '{"path": "src/App.tsx"}\n\n' +
      "Example response:\n" +
      '{"size": 1234, "lines": 45, "extension": ".tsx", "modified": "2024-02-21T10:30:00Z", "created": "2024-01-15T08:00:00Z"}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "local_write_file",
    description:
      "Write content to a LOCAL file. Creates file and missing parent directories.\n" +
      "SAFETY: If worktree_slug is given, path resolves inside worktrees/<slug>/.\n" +
      "Without worktree_slug, writes to project root — BLOCKED if current branch is dev or main.\n\n" +
      "Example request:\n" +
      '{"worktree_slug": "fix-artifact-service", "path": "services/artifact-service/src/app.ts", "content": "..."}\n\n' +
      "Example response:\n" +
      '{"path": "worktrees/fix-artifact-service/services/artifact-service/src/app.ts", "size": 1234, "lines": 45, "created": false}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path. Relative to worktrees/<worktree_slug>/ if slug given, else project root.",
        },
        content: {
          type: "string",
          description: "Full file content to write",
        },
        worktree_slug: {
          type: "string",
          description: "Target worktree slug (e.g. 'fix-artifact-service'). Strongly recommended — omit only for non-source files.",
        },
        create_dirs: {
          type: "boolean",
          description: "Create missing parent directories (default: true)",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "local_str_replace",
    description:
      "Replace a unique string in a LOCAL file. old_str must appear exactly once.\n" +
      "SAFETY: If worktree_slug is given, path resolves inside worktrees/<slug>/.\n" +
      "Without worktree_slug, BLOCKED if current branch is dev or main.\n\n" +
      "Example request:\n" +
      '{"worktree_slug": "fix-task-service", "path": "services/task-service/src/routes/tasks.ts", "old_str": "const where: any = {", "new_str": "const where: Prisma.TaskWhereInput = {"}\n\n' +
      "Example response:\n" +
      '{"replaced": true, "lines_removed": 1, "lines_added": 1}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to worktree root (or project root if no slug given)",
        },
        old_str: {
          type: "string",
          description: "String to find — must appear exactly once in the file",
        },
        new_str: {
          type: "string",
          description: "Replacement. Empty string to delete old_str.",
        },
        worktree_slug: {
          type: "string",
          description: "Target worktree slug. Strongly recommended.",
        },
      },
      required: ["path", "old_str"],
    },
  },
  {
    name: "local_delete_file",
    description:
      "Delete a single file from the LOCAL workspace.\n" +
      "SAFETY: If worktree_slug is given, path resolves inside worktrees/<slug>/.\n" +
      "Without worktree_slug, BLOCKED if current branch is dev or main.\n\n" +
      "Example request:\n" +
      '{"worktree_slug": "fix-task-service", "path": "services/task-service/dist/index.js"}\n\n' +
      "Example response:\n" +
      '{"deleted": true, "path": "worktrees/fix-task-service/services/task-service/dist/index.js"}',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to delete",
        },
        worktree_slug: {
          type: "string",
          description: "Target worktree slug. Strongly recommended.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "bash_exec",
    description:
      "Run a shell command. Returns stdout, stderr, exit_code.\n" +
      "If worktree_slug given, cwd defaults to worktrees/<slug>/.\n" +
      "Use for: pnpm install, tsc --noEmit, eslint, vitest, jest.\n" +
      "BLOCKED: git checkout dev/main, git rebase, git reset, git commit --amend, git push --force.\n\n" +
      "Example request:\n" +
      '{"worktree_slug": "fix-artifact-service", "command": "pnpm tsc --noEmit", "cwd": "services/artifact-service"}\n\n' +
      "Example response:\n" +
      '{"stdout": "", "stderr": "", "exit_code": 0, "success": true, "cwd": "worktrees/fix-artifact-service/services/artifact-service"}',
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to run",
        },
        worktree_slug: {
          type: "string",
          description: "Run inside this worktree. cwd is then relative to worktrees/<slug>/.",
        },
        cwd: {
          type: "string",
          description: "Working directory (relative to worktree root if slug given, else project root)",
        },
        timeout_ms: {
          type: "number",
          description: "Timeout in ms (default: 60000, max: 600000)",
        },
      },
      required: ["command"],
    },
  },
];
