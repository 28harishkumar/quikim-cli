/**
 * MCP tool definitions for plan operations.
 * Save planning documents to .quikim/plan/ directory.
 */

export const planTools = [
  {
    name: "save_plan_file",
    description:
      "Save a planning document to .quikim/plan/ directory with optional subdirectory support. Subdirectories are automatically created.\n\n" +
      "Example requests:\n" +
      '{"filename": "architecture-plan.md", "content": "# Plan..."}\n' +
      '{"filename": "architecture/system-design.md", "content": "# Design..."}\n' +
      '{"filename": "meetings/2026-02-22.md", "content": "# Meeting..."}\n\n' +
      "Example response:\n" +
      '{"success": true, "path": ".quikim/plan/architecture/system-design.md", "size": 1234}',
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename with optional subdirectory (e.g., 'plan.md' or 'architecture/design.md')",
        },
        content: {
          type: "string",
          description: "Markdown content to save",
        },
      },
      required: ["filename", "content"],
    },
  },
  {
    name: "read_plan_file",
    description:
      "Read a planning document from .quikim/plan/ directory. Supports subdirectories.\n\n" +
      "Example requests:\n" +
      '{"filename": "architecture-plan.md"}\n' +
      '{"filename": "architecture/system-design.md"}\n\n' +
      "Example response:\n" +
      '{"content": "# Architecture Plan\\n...", "path": "architecture/system-design.md", "size": 1234}',
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename with optional subdirectory (e.g., 'plan.md' or 'architecture/design.md')",
        },
      },
      required: ["filename"],
    },
  },
  {
    name: "list_plan_files",
    description:
      "List all planning documents in .quikim/plan/ directory recursively. Shows files with their paths and all subdirectories.\n\n" +
      "Example request:\n" +
      "{}\n\n" +
      "Example response:\n" +
      '{"files": [{"path": "architecture/design.md", "name": "design.md", "size": 1234}], "directories": ["architecture", "meetings"], "total": 5}',
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "delete_plan_file",
    description:
      "Delete a planning document from .quikim/plan/ directory. Supports subdirectories.\n\n" +
      "Example requests:\n" +
      '{"filename": "old-plan.md"}\n' +
      '{"filename": "architecture/old-design.md"}\n\n' +
      "Example response:\n" +
      '{"success": true, "deleted": ".quikim/plan/architecture/old-design.md"}',
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename with optional subdirectory (e.g., 'plan.md' or 'architecture/design.md')",
        },
      },
      required: ["filename"],
    },
  },
];
