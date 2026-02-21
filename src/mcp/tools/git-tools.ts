/**
 * MCP tool definitions for git operations.
 * Local git history search and analysis.
 */

export const gitTools = [
  {
    name: "git_log",
    description:
      "Search git commit history with filters. Shows commits, authors, dates, and messages.\n\n" +
      "Example requests:\n" +
      '{"max_count": 10}\n' +
      '{"author": "john@example.com", "max_count": 20}\n' +
      '{"since": "2026-02-01", "until": "2026-02-22"}\n' +
      '{"grep": "fix bug", "max_count": 50}\n' +
      '{"file_path": "src/App.tsx"}\n\n' +
      "Example response:\n" +
      '{"commits": [{"hash": "abc123", "author": "John", "date": "2026-02-22", "message": "feat: add feature"}], "total": 10}',
    inputSchema: {
      type: "object",
      properties: {
        max_count: {
          type: "number",
          description: "Maximum number of commits to return (default: 20)",
        },
        author: {
          type: "string",
          description: "Filter by author name or email",
        },
        since: {
          type: "string",
          description: "Show commits after date (YYYY-MM-DD)",
        },
        until: {
          type: "string",
          description: "Show commits before date (YYYY-MM-DD)",
        },
        grep: {
          type: "string",
          description: "Search commit messages for text",
        },
        file_path: {
          type: "string",
          description: "Show commits that modified this file",
        },
      },
    },
  },
  {
    name: "git_show",
    description:
      "Show details of a specific commit including diff.\n\n" +
      "Example request:\n" +
      '{"commit_hash": "abc123def456"}\n\n' +
      "Example response:\n" +
      '{"hash": "abc123", "author": "John", "date": "2026-02-22", "message": "...", "diff": "diff --git..."}',
    inputSchema: {
      type: "object",
      properties: {
        commit_hash: {
          type: "string",
          description: "Git commit hash (full or short)",
        },
        show_diff: {
          type: "boolean",
          description: "Include diff in response (default: true)",
        },
      },
      required: ["commit_hash"],
    },
  },
  {
    name: "git_blame",
    description:
      "Show line-by-line authorship for a file.\n\n" +
      "Example request:\n" +
      '{"file_path": "src/App.tsx", "start_line": 10, "end_line": 20}\n\n' +
      "Example response:\n" +
      '{"lines": [{"line_number": 10, "hash": "abc123", "author": "John", "date": "2026-02-22", "content": "const x = 1;"}]}',
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to file relative to project root",
        },
        start_line: {
          type: "number",
          description: "Start line number (optional)",
        },
        end_line: {
          type: "number",
          description: "End line number (optional)",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "git_diff",
    description:
      "Show diff between commits, branches, or working directory.\n\n" +
      "Example requests:\n" +
      '{"commit_a": "HEAD", "commit_b": "HEAD~1"}\n' +
      '{"branch": "main"}\n' +
      '{"staged": true}\n\n' +
      "Example response:\n" +
      '{"diff": "diff --git a/file.txt b/file.txt\\n...", "files_changed": 3, "insertions": 42, "deletions": 15}',
    inputSchema: {
      type: "object",
      properties: {
        commit_a: {
          type: "string",
          description: "First commit/branch (default: HEAD)",
        },
        commit_b: {
          type: "string",
          description: "Second commit/branch (default: working directory)",
        },
        file_path: {
          type: "string",
          description: "Show diff for specific file only",
        },
        staged: {
          type: "boolean",
          description: "Show staged changes (default: false)",
        },
        stat: {
          type: "boolean",
          description: "Show only stats, not full diff (default: false)",
        },
      },
    },
  },
];
