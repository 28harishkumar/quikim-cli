/**
 * MCP tool definitions for workspace operations.
 * These are proxy tools - all execution happens on cloud.
 */

export const workspaceTools = [
  {
    name: "list_directory",
    description:
      "List files and directories in the project workspace. Use to explore project structure.",
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
          description: "Include hidden files/directories",
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
    name: "read_file",
    description:
      "Read the full content of a file. For large files (>100KB), use read_file_lines or get_ast instead.",
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
    name: "read_file_lines",
    description: "Read specific lines from a file. Use for large files.",
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
    name: "search_codebase",
    description: "Search for text or patterns in the codebase.",
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
          description: "Where to search",
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
          description: "Treat query as regex",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_ast",
    description:
      "Get symbols (functions, classes, imports) from a source file without reading full content.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to source file",
        },
        detail_level: {
          type: "string",
          enum: ["symbols", "full"],
          description:
            "symbols = names only (recommended), full = complete AST",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "get_file_stats",
    description:
      "Get file metadata (size, lines, type) without reading content.",
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
