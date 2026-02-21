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
];
