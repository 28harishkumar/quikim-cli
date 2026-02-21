/**
 * MCP tool definitions for context operations.
 * These provide information about the current working environment.
 */

export const contextTools = [
  {
    name: "get_working_directory",
    description:
      "Get the current working directory (pwd). Returns the absolute path of the project root.\n\n" +
      "Example request:\n" +
      "{}\n\n" +
      "Example response:\n" +
      '{"cwd": "/Users/username/projects/my-app", "exists": true}',
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_working_directory",
    description:
      "List files and folders in the current working directory (ls). Shows what's at the project root level.\n\n" +
      "Example request:\n" +
      '{"include_hidden": false}\n\n' +
      "Example response:\n" +
      '{"cwd": "/Users/username/projects/my-app", "files": ["package.json", "README.md"], "directories": ["src", "node_modules"], "total": 15}',
    inputSchema: {
      type: "object",
      properties: {
        include_hidden: {
          type: "boolean",
          description: "Include hidden files/directories (default: false)",
        },
      },
    },
  },
];
