/**
 * MCP tool definitions for plan operations.
 * Save planning documents to .quikim/plan/ directory.
 */

export const planTools = [
  {
    name: "save_plan_file",
    description:
      "Save a planning document to .quikim/plan/ directory. Use for saving meeting notes, project plans, brainstorming sessions, or any planning documentation.\n\n" +
      "Example request:\n" +
      '{"filename": "architecture-plan.md", "content": "# Architecture Plan\\n\\n## Overview\\n..."}\n\n' +
      "Example response:\n" +
      '{"success": true, "path": ".quikim/plan/architecture-plan.md", "size": 1234}',
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename (e.g., 'architecture-plan.md'). Will be saved to .quikim/plan/",
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
      "Read a planning document from .quikim/plan/ directory.\n\n" +
      "Example request:\n" +
      '{"filename": "architecture-plan.md"}\n\n' +
      "Example response:\n" +
      '{"content": "# Architecture Plan\\n...", "size": 1234, "modified": "2026-02-21T23:10:00Z"}',
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename to read from .quikim/plan/",
        },
      },
      required: ["filename"],
    },
  },
  {
    name: "list_plan_files",
    description:
      "List all planning documents in .quikim/plan/ directory.\n\n" +
      "Example request:\n" +
      "{}\n\n" +
      "Example response:\n" +
      '{"files": [{"name": "architecture-plan.md", "size": 1234, "modified": "2026-02-21T23:10:00Z"}], "total": 5}',
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "delete_plan_file",
    description:
      "Delete a planning document from .quikim/plan/ directory.\n\n" +
      "Example request:\n" +
      '{"filename": "old-plan.md"}\n\n' +
      "Example response:\n" +
      '{"success": true, "deleted": ".quikim/plan/old-plan.md"}',
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename to delete from .quikim/plan/",
        },
      },
      required: ["filename"],
    },
  },
];
