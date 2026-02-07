/**
 * Quikim - MCP Server Core
 * Lightweight server that processes XML requests and integrates with decision engine
 * Integrated with CLI for shared authentication and configuration
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  generateMCPPrompts,
  getPromptContent,
} from "./prompts/capabilities.js";
import { mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { getQuikimProjectRoot } from "../config/project-root.js";

import { SessionManager, sessionManager } from "./session/manager.js";
// Lazy import to avoid circular dependency: server.ts -> workflow-tools.ts -> integration/index.ts -> server.ts
// import { WorkflowEngineTools } from './handlers/workflow-tools.js';
import { logger } from "./utils/logger.js";
import { errorHandler, ErrorContext } from "./utils/error-handler.js";
import {
  PROTOCOL_CONFIG,
  PROJECT_CONTEXT_SCHEMA,
  ARTIFACT_NAME_TITLE_SCHEMA,
  REQUIREMENT_SPEC_NAMES_DESCRIPTION,
  HLD_SPEC_NAMES_DESCRIPTION,
  LLD_SPEC_NAMES_DESCRIPTION,
  FLOW_SPEC_NAMES_DESCRIPTION,
  WIREFRAME_SPEC_NAMES_DESCRIPTION,
} from "./utils/constants.js";
import { CodebaseContext } from "./session/types.js";
import { ToolHandlers } from "./handlers/index.js";
import { ServiceAwareAPIClient } from "./api/service-client.js";
import {
  projectContextResolver,
  ProjectContext,
} from "./services/project-context.js";

// Import CLI config manager for shared authentication
import { configManager } from "../config/manager.js";

export class MCPCursorProtocolServer {
  private server: Server;
  private sessionManager: SessionManager;
  private toolHandlers: ToolHandlers;
  private apiClient: ServiceAwareAPIClient;

  constructor() {
    this.server = new Server(
      {
        name: "quikim-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    this.sessionManager = sessionManager;

    // Initialize API client using CLI's shared configuration
    // Priority: 1) Environment variable, 2) CLI config
    const apiKey = this.resolveApiKey();

    logger.info(
      "Initializing MCP server with service-aware API configuration",
      {
        userServiceUrl: configManager.getUserServiceUrl(),
        projectServiceUrl: configManager.getProjectServiceUrl(),
        hasApiKey: !!apiKey,
        isLocalMode: configManager.isLocalMode(),
      },
    );

    this.apiClient = new ServiceAwareAPIClient({
      apiKey,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    // Initialize tool handlers - now using simplified AI Agent based handlers
    this.toolHandlers = new ToolHandlers(this.apiClient);

    this.setupToolHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandlers();
  }

  /**
   * Resolve API key from environment or CLI's stored auth token
   */
  private resolveApiKey(): string {
    // Environment variable takes precedence
    if (process.env.QUIKIM_API_KEY) {
      return process.env.QUIKIM_API_KEY;
    }

    // Use CLI's stored authentication token
    const auth = configManager.getAuth();
    if (auth?.token && configManager.isAuthenticated()) {
      return auth.token;
    }

    return "";
  }

  /**
   * Set up MCP tool definitions for the protocol
   */
  private setupToolHandlers(): void {
    // Define all Quikim tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Get existing tools
      const existingTools = [
        {
          name: "generate_requirements",
          description: `Save requirements locally (markdown), then sync to server. Path: .quikim/artifacts/<spec_name>/requirement_<name>.md. Use these spec_name values (same as organization dashboard): ${REQUIREMENT_SPEC_NAMES_DESCRIPTION}. Do not use 'default'. For 1.3, 1.4, 1.5, 1.6 the LLM must create one requirement file per entity (e.g. one file per screen, per API, per component, per code file).`,
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Object with 'files' array. Path: .quikim/artifacts/<spec_name>/requirement_<name>.md. For 1.3/1.4/1.5/1.6 use one file per entity (e.g. one requirement_screen-login.md per screen). content = markdown.",
              },
              user_prompt: {
                type: "string",
                description: "Original user request",
              },
              spec_name: {
                type: "string",
                description: `Spec name for this requirement. Must be one of (same as dashboard): ${REQUIREMENT_SPEC_NAMES_DESCRIPTION}. Custom spec names are also allowed. Do not use 'default'.`,
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              title: ARTIFACT_NAME_TITLE_SCHEMA.title,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_requirements",
          description:
            "Read requirements from local .quikim/artifacts/<spec>/ files. Pass data.force=true to fetch from API then write to local.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
              data: {
                type: "object",
                properties: {
                  force: {
                    type: "boolean",
                    description:
                      "If true, fetch from API then write to local; otherwise read from local files",
                  },
                },
              },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "generate_tests",
          description:
            "Save tests locally first (JSON with description, sampleInputOutput, inputDescription, outputDescription), then sync to server. Path: .quikim/artifacts/<spec>/tests_<id>.md. Use spec_name to set the spec.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/tests_<id>.md.",
              },
              user_prompt: { type: "string" },
              spec_name: {
                type: "string",
                description:
                  "Spec name for this test. Use a descriptive spec name matching the API or feature being tested. Do not use 'default'.",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_tests",
          description:
            "Read tests from local .quikim/artifacts/<spec>/ files. Pass data.force=true to fetch from API then write to local.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
              data: {
                type: "object",
                properties: {
                  force: {
                    type: "boolean",
                    description: "If true, fetch from API then write to local",
                  },
                },
              },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "generate_hld",
          description: `Save HLD locally first, then sync to server in background (non-blocking). Path: .quikim/artifacts/<spec>/hld_<id>.md. Use spec_name: ${HLD_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). HLD has its own spec names; do not use LLD spec names here. Optional: name/title.`,
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/hld_<id>.md.",
              },
              user_prompt: { type: "string" },
              spec_name: {
                type: "string",
                description: `Spec name for this HLD. Must be one of: ${HLD_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). Do not use 'default'.`,
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              title: ARTIFACT_NAME_TITLE_SCHEMA.title,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_hld",
          description: "Update local HLD from server high-level designs",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "pull_wireframe",
          description: "Update local wireframes from server",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "generate_wireframes",
          description: `Save wireframe locally first, then sync to server in background (non-blocking). Path: .quikim/artifacts/<spec>/wireframe_files_<id>.md. Use spec_name: ${WIREFRAME_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). Optional: name.`,
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/wireframe_files_<id>.md. Content: optional JSON { name, viewport: { width, height }, elements }.",
              },
              user_prompt: { type: "string" },
              spec_name: {
                type: "string",
                description: `Spec name for this wireframe. Must be one of: ${WIREFRAME_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). Do not use 'default'.`,
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "generate_tasks",
          description:
            "Save tasks locally first (markdown, Kiro/task format), then sync to server in background (non-blocking). Provide markdown in content; we save and send markdown to server as-is. Path: .quikim/artifacts/<spec>/tasks_<id>.md. File format: YAML frontmatter (--- id, specName, status, ... ---) then # Title, ## Description, ## Subtasks (- [ ] or [x] text), ## Checklist, ## Comments, ## Attachments. Use spec_name to set the spec.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/tasks_<id>.md. content = markdown (Kiro/task format; saved and sent to server as markdown).",
              },
              user_prompt: { type: "string" },
              spec_name: {
                type: "string",
                description:
                  "Spec name for this task. Use a descriptive spec name matching the milestone or feature. Do not use 'default'.",
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_tasks",
          description: "Update local tasks from server tasks",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "update_code",
          description:
            "Take local code context, use RAG pipeline to find relevant code snippets, return guidelines and snippets",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "er_diagram_pull",
          description: "Update local ER diagram from server",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "er_diagram_push",
          description:
            "Save ER diagram locally first, then sync to server in background (non-blocking). Content: raw mermaid erDiagram only. Path: .quikim/artifacts/<spec>/er_diagram_<id>.md. Use spec_name to set the spec.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/er_diagram_<id>.md. content = raw mermaid erDiagram only.",
              },
              user_prompt: { type: "string" },
              spec_name: {
                type: "string",
                description:
                  "Spec name for this ER diagram. Use a descriptive spec name. Do not use 'default'.",
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_rules",
          description: "Update local Quikim cursor rules files",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "pull_mermaid",
          description:
            "Fetch mermaid diagrams from server (flowchart, sequence, class, ER, state, gantt, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "generate_mermaid",
          description: `Save mermaid diagram locally first, then sync to server in background (non-blocking). Content: raw mermaid only (no code fences). Path: .quikim/artifacts/<spec>/flow_diagram_<id>.md. Use spec_name: ${FLOW_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard).`,
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/flow_diagram_<id>.md. content = raw mermaid only (no code fences).",
              },
              user_prompt: { type: "string" },
              spec_name: {
                type: "string",
                description: `Spec name for this flow diagram. Must be one of: ${FLOW_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). Do not use 'default'.`,
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_lld",
          description:
            "Fetch or generate Low-Level Design (LLD) for a specific component. LLD provides detailed specifications including interfaces, data models, method specifications, and sequence diagrams.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: {
                type: "string",
                description:
                  "Include component name, e.g., 'pull_lld for auth service' or 'LLD for payment module'",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "generate_lld",
          description: `Save LLD locally first, then sync to server in background (non-blocking). Path: .quikim/artifacts/<spec>/lld_<id>.md. Use spec_name: ${LLD_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). LLD has its own spec names; do not use HLD spec names here. Optional: name/title; user_prompt can specify component name.`,
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/lld_<id>.md.",
              },
              user_prompt: {
                type: "string",
                description:
                  "Optionally specify component name to push specific LLD",
              },
              spec_name: {
                type: "string",
                description: `Spec name for this LLD. Must be one of: ${LLD_SPEC_NAMES_DESCRIPTION}, or custom (same as dashboard). Do not use 'default'.`,
              },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              title: ARTIFACT_NAME_TITLE_SCHEMA.title,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "generate_context",
          description:
            "Save context locally first, then sync to server in background (non-blocking). Path: .quikim/artifacts/<spec>/context_<id>.md. Optional: name/title.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/context_<id>.md. content = plain text only.",
              },
              user_prompt: { type: "string" },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              title: ARTIFACT_NAME_TITLE_SCHEMA.title,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_context",
          description:
            "Read context from local files or fetch from API (data.force=true)",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
              data: {
                type: "object",
                properties: { force: { type: "boolean" } },
              },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "generate_code_guideline",
          description:
            "Save code guideline locally first, then sync to server in background (non-blocking). Path: .quikim/artifacts/<spec>/code_guideline_<id>.md. Optional: name/title.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Files array. Path: .quikim/artifacts/<spec>/code_guideline_<id>.md. content = plain text/markdown only.",
              },
              user_prompt: { type: "string" },
              name: ARTIFACT_NAME_TITLE_SCHEMA.name,
              title: ARTIFACT_NAME_TITLE_SCHEMA.title,
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_code_guideline",
          description:
            "Read code guidelines from local files or fetch from API (data.force=true)",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
              data: {
                type: "object",
                properties: { force: { type: "boolean" } },
              },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "get_workflow_instruction",
          description:
            "Get the next workflow instruction for the project (action, prompt, context artifacts, decision trace). Call this before generating an artifact so the LLM knows what to generate and which @mentions to use.",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "string",
                description:
                  'Actual project ID from project_context. Do not use spec name like "default".',
              },
              user_prompt: {
                type: "string",
                description: "User intent, e.g. 'Build a restaurant app'",
              },
              last_known_state: {
                type: "string",
                description: "Optional last workflow node id",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "report_workflow_progress",
          description:
            "Report that an artifact was created/updated so workflow state advances. Call after createArtifact (e.g. after generate_requirements, generate_hld). Include pending_instruction_id from get_workflow_instruction for idempotency.",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "string",
                description:
                  'Actual project ID from project_context. Do not use spec name like "default".',
              },
              artifact_type: {
                type: "string",
                description: "e.g. requirement, hld, lld, tasks",
              },
              spec_name: {
                type: "string",
                description: `Spec name. For requirements use one of: ${REQUIREMENT_SPEC_NAMES_DESCRIPTION}, or custom. Default: default.`,
              },
              artifact_name: { type: "string", description: "Artifact name" },
              artifact_id: {
                type: "string",
                description: "Optional server artifact id",
              },
              pending_instruction_id: {
                type: "string",
                description: "From get_workflow_instruction for idempotency",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["project_id", "artifact_type", "spec_name"],
          },
        } as Tool,
      ];

      // Get workflow engine tools (lazy import to avoid circular dependency)
      const { WorkflowEngineTools } =
        await import("./handlers/workflow-tools.js");
      const workflowTools = await WorkflowEngineTools.listTools();

      // Combine all tools
      return {
        tools: [...existingTools, ...workflowTools],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // DEBUG: Write to workspace file
      try {
        const logPath = join(
          getQuikimProjectRoot(),
          ".quikim",
          "mcp-debug.log",
        );
        mkdirSync(dirname(logPath), { recursive: true });
        appendFileSync(logPath, `\n=== ${new Date().toISOString()} ===\n`);
        appendFileSync(logPath, `Tool: ${name}\n`);
        appendFileSync(
          logPath,
          `Args keys: ${Object.keys(args || {}).join(", ")}\n`,
        );
        if (args?.codebase) {
          const files = (args.codebase as any)?.files;
          appendFileSync(logPath, `Files count: ${files?.length || 0}\n`);
          if (files && files.length > 0) {
            files.forEach((f: any, i: number) => {
              appendFileSync(logPath, `  File ${i}: ${f.path}\n`);
              appendFileSync(
                logPath,
                `    Content type: ${typeof f.content}\n`,
              );
              if (Array.isArray(f.content)) {
                appendFileSync(
                  logPath,
                  `    Content array length: ${f.content.length}\n`,
                );
                appendFileSync(
                  logPath,
                  `    First block: ${JSON.stringify(f.content[0]).substring(0, 100)}\n`,
                );
              }
            });
          }
        }
      } catch (e) {
        // Ignore
      }

      if (!args) {
        throw new Error(`Missing arguments for tool: ${name}`);
      }

      // Normalize codebase to ensure projectStructure exists
      const rawCodebase = args.codebase as any;
      const codebase: CodebaseContext = {
        files: rawCodebase?.files || [],
        detectedTechnology: rawCodebase?.detectedTechnology || [],
        projectStructure: rawCodebase?.projectStructure || {
          rootPath: "",
          directories: [],
          fileTypes: {},
          packageFiles: [],
          configFiles: [],
        },
        lastAnalysis: rawCodebase?.lastAnalysis
          ? new Date(rawCodebase.lastAnalysis)
          : new Date(),
      };

      const userPrompt = args.user_prompt as string;
      const dataFromArgs = args.data as Record<string, unknown> | undefined;
      const data: Record<string, unknown> | undefined = {
        ...(dataFromArgs || {}),
        ...(args.name != null ? { name: args.name } : {}),
        ...(args.title != null ? { title: args.title } : {}),
        ...(args.spec_name != null ? { spec_name: args.spec_name } : {}),
      };
      const dataToPass = Object.keys(data).length ? data : dataFromArgs;

      // Debug logging (suppressed when QUIKIM_MCP_SILENT=1 to avoid corrupting stdio)
      if (data) {
        logger.debug("[MCP Server] Data field detected", {
          hasEndpoint: !!data.endpoint,
          hasMethod: !!data.method,
          endpoint: data.endpoint,
          method: data.method,
          dataKeys: Object.keys(data),
        });
      } else {
        logger.debug("[MCP Server] No data field in args");
      }

      // Resolve project context from codebase
      const resolvedContext =
        await projectContextResolver.resolveFromCodebase(codebase);
      const rawProjectContext =
        (args.project_context as Record<string, unknown>) || {};
      const projectContext: ProjectContext = {
        ...resolvedContext,
        ...rawProjectContext,
        ...(typeof args.spec_name === "string"
          ? { specName: args.spec_name }
          : {}),
      };
      // Normalize so LLM-sent snake_case (spec_name, project_id) is used when camelCase missing
      if (
        projectContext.specName == null &&
        (rawProjectContext.spec_name as string) != null
      ) {
        projectContext.specName = rawProjectContext.spec_name as string;
      }
      if (
        projectContext.projectId == null &&
        (rawProjectContext.project_id as string) != null
      ) {
        projectContext.projectId = rawProjectContext.project_id as string;
      }

      logger.debug("[MCP Server] Calling handler", {
        toolName: name,
        hasData: !!data,
        projectId: projectContext.projectId,
        specName: projectContext.specName,
      });

      // Route to appropriate handler
      switch (name) {
        case "generate_requirements":
          return await this.toolHandlers.handlePushRequirements(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_requirements":
          return await this.toolHandlers.handlePullRequirements(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_tests":
          return await this.toolHandlers.handlePushTests(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_tests":
          return await this.toolHandlers.handlePullTests(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_hld":
          return await this.toolHandlers.handlePushHLD(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_hld":
          return await this.toolHandlers.handlePullHLD(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_wireframe":
          return await this.toolHandlers.handlePullWireframe(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_wireframes":
          return await this.toolHandlers.handlePushWireframes(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_tasks":
          return await this.toolHandlers.handlePushTasks(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_tasks":
          return await this.toolHandlers.handlePullTasks(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "update_code":
          return await this.toolHandlers.handleUpdateCode(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "er_diagram_pull":
          return await this.toolHandlers.handleERDiagramPull(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "er_diagram_push":
          return await this.toolHandlers.handleERDiagramPush(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_rules":
          return await this.toolHandlers.handlePullRules(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_mermaid":
          return await this.toolHandlers.handlePullMermaid(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_mermaid":
          return await this.toolHandlers.handlePushMermaid(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_lld":
          return await this.toolHandlers.handlePullLLD(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_lld":
          return await this.toolHandlers.handlePushLLD(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_context":
          return await this.toolHandlers.handlePushContext(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_context":
          return await this.toolHandlers.handlePullContext(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_code_guideline":
          return await this.toolHandlers.handlePushCodeGuideline(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "pull_code_guideline":
          return await this.toolHandlers.handlePullCodeGuideline(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "get_workflow_instruction": {
          const rawProjectId = (args.project_id as string) || "";
          const projectId =
            rawProjectId && rawProjectId !== "default"
              ? rawProjectId
              : projectContext.projectId;
          if (!projectId) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: project_id or project_context with projectId required.",
                },
              ],
              isError: true,
            };
          }
          const workflowBase = configManager
            .getWorkflowServiceUrl()
            .replace(/\/$/, "");
          const token = configManager.getAuth()?.token ?? "";
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          try {
            const res = await fetch(`${workflowBase}/api/v1/workflow/next`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                projectId,
                userIntent: userPrompt,
                lastKnownState: (args.last_known_state as string) || null,
              }),
            });
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: `Workflow service error: ${res.status} ${errText}`,
                  },
                ],
                isError: true,
              };
            }
            const instruction = await res.json();
            return {
              content: [
                { type: "text", text: JSON.stringify(instruction, null, 2) },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [
                { type: "text", text: `Workflow service call failed: ${msg}` },
              ],
              isError: true,
            };
          }
        }
        case "report_workflow_progress": {
          const rawProjectId = (args.project_id as string) || "";
          const projectId =
            rawProjectId && rawProjectId !== "default"
              ? rawProjectId
              : projectContext.projectId;
          if (!projectId) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: project_id or project_context with projectId required.",
                },
              ],
              isError: true,
            };
          }
          const workflowBase = configManager
            .getWorkflowServiceUrl()
            .replace(/\/$/, "");
          const token = configManager.getAuth()?.token ?? "";
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          try {
            const res = await fetch(
              `${workflowBase}/api/v1/workflow/progress`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  projectId,
                  artifactType: args.artifact_type as string,
                  specName: (args.spec_name as string) || "default",
                  artifactName: (args.artifact_name as string) || null,
                  artifactId: (args.artifact_id as string) || null,
                  pendingInstructionId:
                    (args.pending_instruction_id as string) || null,
                }),
              },
            );
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: `Workflow service error: ${res.status} ${errText}`,
                  },
                ],
                isError: true,
              };
            }
            const result = await res.json();
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [
                { type: "text", text: `Workflow service call failed: ${msg}` },
              ],
              isError: true,
            };
          }
        }
        // Workflow engine tools
        case "detect_change":
        case "analyze_impact":
        case "generate_propagation_plan":
        case "execute_propagation":
        case "acquire_lock":
        case "release_lock":
        case "sync_to_ide":
        case "sync_from_ide":
        case "generate_code_from_requirements":
        case "generate_code_from_design":
          // Lazy import to avoid circular dependency
          const { WorkflowEngineTools } =
            await import("./handlers/workflow-tools.js");
          return await WorkflowEngineTools.handleToolCall(request);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Set up MCP prompt handlers for capability discovery
   * This allows LLMs to discover available tools without cursor rules
   */
  private setupPromptHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = generateMCPPrompts();
      return { prompts };
    });

    // Get prompt content
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const content = getPromptContent(name, args as Record<string, string>);

      return {
        description: `Quikim MCP capability information for: ${name}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content,
            },
          },
        ],
      };
    });
  }

  /**
   * Set up error handlers for the server
   */
  private setupErrorHandlers(): void {
    this.server.onerror = (error) => {
      this.handleServerError(error, "MCP Server Error");
    };

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.handleCriticalError(error, "Uncaught Exception");
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.handleCriticalError(
        new Error(`Promise: ${promise}, Reason: ${reason}`),
        "Unhandled Rejection",
      );
    });

    // Handle SIGTERM and SIGINT for graceful shutdown
    process.on("SIGTERM", () => {
      this.handleGracefulShutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      this.handleGracefulShutdown("SIGINT");
    });
  }

  /**
   * Handle server-level errors with comprehensive recovery
   */
  private async handleServerError(
    error: Error,
    operation: string,
  ): Promise<void> {
    const context: ErrorContext = {
      operation,
      additionalData: { serverError: true },
    };

    const recoveryResult = await errorHandler.handleError(error, context);

    if (
      !recoveryResult.success &&
      recoveryResult.recoveryStrategy === "terminate"
    ) {
      logger.error("Critical server error - initiating shutdown", {
        error: error.message,
        recoveryStrategy: recoveryResult.recoveryStrategy,
      });

      // Attempt graceful shutdown
      setTimeout(() => {
        process.exit(1);
      }, 5000); // Give 5 seconds for cleanup
    }
  }

  /**
   * Handle critical errors that may require process termination
   */
  private async handleCriticalError(
    error: Error,
    operation: string,
  ): Promise<void> {
    const context: ErrorContext = {
      operation,
      additionalData: { critical: true },
    };

    logger.logError(`Critical error: ${operation}`, error);

    // Attempt error recovery before termination
    await errorHandler.handleError(error, context, "terminate");

    // For critical errors, always exit after logging
    setTimeout(() => {
      process.exit(1);
    }, 1000); // Give 1 second for logging
  }

  /**
   * Handle graceful shutdown
   */
  private async handleGracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, initiating graceful shutdown`);

    try {
      // Stop accepting new requests
      await this.server.close();

      // Clean up sessions
      sessionManager.cleanupExpiredSessions();

      // Log shutdown completion
      logger.logServerStop();

      process.exit(0);
    } catch (error) {
      logger.logError("Error during graceful shutdown", error);
      process.exit(1);
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.logServerStart();

    // Start periodic cleanup of expired sessions
    setInterval(() => {
      this.sessionManager.cleanupExpiredSessions();
    }, PROTOCOL_CONFIG.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();
    logger.logServerStop();
  }
}

// Export for use in other modules
export default MCPCursorProtocolServer;
