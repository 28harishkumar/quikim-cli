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
          description: `Save requirements locally (markdown), then sync to server.

REQUIREMENT SPECS (1.x workflow nodes):
• 1.1 overview: High-level project overview, goals, scope. ONE file per project.
• 1.2 business-functional: Business rules and functional requirements. Usually ONE file; create additional only when user explicitly requests.
• 1.3 acceptance-criteria-screens: Screen-by-screen acceptance criteria. ONE FILE PER SCREEN (e.g. requirement_login-screen.md, requirement_dashboard-screen.md).
• 1.4 acceptance-criteria-apis: API-by-API acceptance criteria. ONE FILE PER API (e.g. requirement_create-order-api.md, requirement_get-user-api.md).
• 1.5 component-requirements: Component-level requirements. ONE FILE PER COMPONENT (e.g. requirement_button.md, requirement_modal.md).
• 1.6 acceptance-criteria-code-files: Code file acceptance criteria. ONE FILE PER CODE FILE (e.g. requirement_user-service.md).
• 1.7 phase-milestone-breakdown: Phase and milestone breakdown. ONE file per project.

Path: .quikim/artifacts/<spec_name>/requirement_<name>.md. Do not use 'default'.

❌ DO NOT include HLD content (architecture, tech stack) → use generate_hld
❌ DO NOT include LLD content (detailed class/interface specs) → use generate_lld
❌ DO NOT include flow diagrams → use generate_mermaid
❌ DO NOT include wireframe details → use generate_wireframes`,
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
          description: `Save HLD (High-Level Design) locally first, then sync to server.

HLD SPECS (2.x workflow nodes):
• 2.1 project-architecture: Overall architecture, tech stack, system components, deployment topology. ONE file per project.
• 2.2 milestones-specs: Milestone breakdown with high-level specs per phase. ONE file per project.

Path: .quikim/artifacts/<spec_name>/hld_<name>.md. Do not use 'default'.

✅ INCLUDE: Architecture diagrams, tech stack choices, service boundaries, deployment strategy, integration points
❌ DO NOT include detailed API specs → use generate_lld with spec 'technical-detail-api'
❌ DO NOT include detailed screen specs → use generate_lld with spec 'technical-detail-screen'
❌ DO NOT include implementation-level class designs → use generate_lld
❌ DO NOT use LLD spec names (list-screens, list-apis, etc.) → those are for generate_lld only`,
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
          description: `Save wireframe locally first, then sync to server.

WIREFRAME SPECS (5.x workflow nodes):
• 5.1 wireframes-screens: Screen-level wireframes showing layout and components. ONE FILE PER SCREEN (e.g. wireframe_files_login.md).
• 5.2 component-wireframes: Reusable component wireframes. ONE FILE PER COMPONENT (e.g. wireframe_files_button.md).

Path: .quikim/artifacts/<spec_name>/wireframe_files_<name>.md. Do not use 'default'.
Content: JSON { name, viewport: { width, height }, elements } or empty.

⚠️ DO NOT CONFUSE with 3.1 (list-screens LLD): Node 3.1 = LLD list of screens (use generate_lld spec 'list-screens'). Node 5.1 = actual wireframe layouts (use generate_wireframes spec 'wireframes-screens').
❌ DO NOT include technical specs → use generate_lld with spec 'technical-detail-screen'
❌ DO NOT include navigation flows → use generate_mermaid with spec 'navigation-tree'`,
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
          description: `Save mermaid/flow diagram locally first, then sync to server.

FLOW SPECS (4.x workflow nodes):
• 4.1 navigation-tree: Navigation structure showing screen-to-screen flows. ONE file per project.
• 4.2 business-logic-flow: Business logic flowcharts (e.g. checkout flow, auth flow). ONE FILE PER FLOW (e.g. flow_diagram_checkout.md).

Path: .quikim/artifacts/<spec_name>/flow_diagram_<name>.md. Do not use 'default'.
Content: RAW mermaid syntax ONLY (no \`\`\`mermaid wrapper, no JSON).

✅ INCLUDE: flowchart, sequenceDiagram, stateDiagram, graph TD/LR
❌ DO NOT include ER diagrams → use er_diagram_push
❌ DO NOT include wireframe layouts → use generate_wireframes`,
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
          description: `Save LLD (Low-Level Design) locally first, then sync to server.

LLD SPECS (3.x workflow nodes):
• 3.1 list-screens: Master list of ALL screens with brief description. ONE file per project.
• 3.2 list-apis: Master list of ALL APIs with endpoint, method, brief description. ONE file per project.
• 3.3 file-tree: Complete file tree with all code files. ONE file per project.
• 3.4 technical-details-code: Detailed spec per code file (classes, functions, interfaces). ONE FILE PER CODE FILE (e.g. lld_user-service.md).
• 3.5 technical-detail-screen: Detailed screen spec (props, state, handlers, UI structure). ONE FILE PER SCREEN (e.g. lld_login-screen.md).
• 3.6 technical-detail-api: Detailed API spec (request/response types, validation, error codes). ONE FILE PER API (e.g. lld_create-order.md).

Path: .quikim/artifacts/<spec_name>/lld_<name>.md. Do not use 'default'.

✅ INCLUDE: Interface definitions, data models, method signatures, pseudocode, sequence diagrams
❌ DO NOT include high-level architecture → use generate_hld with spec 'project-architecture'
❌ DO NOT include wireframes/UI mockups → use generate_wireframes
❌ DO NOT use HLD spec names (project-architecture, milestones-specs) → those are for generate_hld only`,
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
          name: "pull_skills",
          description:
            "Fetch all workflow skills from the server and cache them locally at .quikim/skills/. " +
            "Skills guide artifact generation for each workflow step (instructions, output format, dependencies, dependents). " +
            "Call this once when starting a project or when skills may have been updated.",
          inputSchema: {
            type: "object",
            properties: {
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: [],
          },
        } as Tool,
        {
          name: "get_skill",
          description:
            "Get the skill instructions for a specific workflow node. " +
            "Returns the SKILL.md content that guides artifact generation for that node " +
            "(instructions, output format, dependencies, dependents). " +
            "Reads from local .quikim/skills/ cache first; falls back to server API.",
          inputSchema: {
            type: "object",
            properties: {
              node_id: {
                type: "string",
                description: "Workflow node ID (e.g. '1.1', '2.1', '3.4')",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["node_id"],
          },
        } as Tool,
        {
          name: "get_llm_queue",
          description:
            "Fetch pending LLM generation queue items for a project. Returns items with full prompt payloads. After generating, save with generate_* tool, report_workflow_progress, then update_queue_item.",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "string",
                description: "Project ID from project_context.",
              },
              status: {
                type: "string",
                enum: ["pending", "processing", "completed", "failed"],
                description: "Filter by status. Default: pending.",
              },
              limit: {
                type: "number",
                description: "Max items. Default: 10.",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: [],
          },
        } as Tool,
        {
          name: "update_queue_item",
          description:
            "Update LLM queue item status. Use 'processing' before generating, 'completed' after, or 'failed' with error_message.",
          inputSchema: {
            type: "object",
            properties: {
              queue_id: {
                type: "string",
                description: "Queue item ID.",
              },
              status: {
                type: "string",
                enum: ["processing", "completed", "failed"],
                description: "New status.",
              },
              error_message: {
                type: "string",
                description: "Error message when status is 'failed'.",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["queue_id", "status"],
          },
        } as Tool,
        {
          name: "poll_queue",
          description:
            "Poll for next pending task and claim it for processing. Returns hasTask=false if no pending tasks, or the full task payload with context if found. Combines get + claim in one call for efficiency.",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "string",
                description: "Project ID to poll queue for.",
              },
              session_id: {
                type: "string",
                description: "Optional MCP session ID for tracking.",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: [],
          },
        } as Tool,
        {
          name: "complete_queue_task",
          description:
            "Mark a queue task as completed after generating the artifact. Call this after successfully generating content via generate_* tools.",
          inputSchema: {
            type: "object",
            properties: {
              queue_id: {
                type: "string",
                description: "Queue item ID from poll_queue response.",
              },
              success: {
                type: "boolean",
                description: "Whether generation succeeded.",
              },
              error_message: {
                type: "string",
                description: "Error message if success=false.",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["queue_id", "success"],
          },
        } as Tool,
        {
          name: "skip_workflow_step",
          description:
            "Skip a workflow step (mark as skipped, advance to next). Use for optional nodes or nodes not applicable to the project (e.g., skip wireframes for backend-only projects, skip screen specs for CLI tools).",
          inputSchema: {
            type: "object",
            properties: {
              node_id: {
                type: "string",
                description: "Workflow node ID to skip (e.g., '3.1', '5.1'). Use get_workflow_instruction to see current node.",
              },
              reason: {
                type: "string",
                description: "Optional reason for skipping (e.g., 'Backend-only project, no screens').",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["node_id"],
          },
        } as Tool,
        {
          name: "parse_codebase_ast",
          description:
            "Parse an existing codebase into AST-like summaries. Returns imports, exports, functions, classes, interfaces, types, React components. Useful for understanding existing code before generating artifacts. Use summaryOnly=true for compact output.",
          inputSchema: {
            type: "object",
            properties: {
              root_path: {
                type: "string",
                description: "Root path of the codebase to parse. Defaults to current project root.",
              },
              max_files: {
                type: "number",
                description: "Maximum files to parse (default: 500).",
              },
              max_depth: {
                type: "number",
                description: "Maximum directory depth (default: 10).",
              },
              summary_only: {
                type: "boolean",
                description: "If true, return only summaries without detailed AST (default: false).",
              },
              include_patterns: {
                type: "array",
                items: { type: "string" },
                description: "File extensions to include (default: ['.ts', '.tsx', '.js', '.jsx']).",
              },
              exclude_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Paths/patterns to exclude (default: ['node_modules', 'dist', etc.]).",
              },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: [],
          },
        } as Tool,
        {
          name: "get_workflow_instruction",
          description:
            "Get the next workflow instruction for the project (action, prompt, context artifacts, skill content, decision trace). Call this before generating an artifact so the LLM knows what to generate and which @mentions to use.",
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
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushRequirements(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "pull_requirements":
          return await this.toolHandlers.handlePullRequirements(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_tests":
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushTests(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "pull_tests":
          return await this.toolHandlers.handlePullTests(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_hld":
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushHLD(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
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
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushWireframes(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "generate_tasks":
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushTasks(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
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
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handleERDiagramPush(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
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
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushMermaid(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "pull_lld":
          return await this.toolHandlers.handlePullLLD(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_lld":
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushLLD(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "generate_context":
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushContext(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "pull_context":
          return await this.toolHandlers.handlePullContext(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "generate_code_guideline":
          return await this.appendNextStepSkill(
            name,
            args as Record<string, unknown>,
            await this.toolHandlers.handlePushCodeGuideline(
              codebase,
              userPrompt,
              projectContext,
              dataToPass,
            ),
          );
        case "pull_code_guideline":
          return await this.toolHandlers.handlePullCodeGuideline(
            codebase,
            userPrompt,
            projectContext,
            dataToPass,
          );
        case "parse_codebase_ast": {
          const { ASTParser } = await import("../services/ast-parser.js");
          const rootPath = (args.root_path as string) || getQuikimProjectRoot();
          const parser = new ASTParser({
            maxFiles: (args.max_files as number) || 500,
            maxDepth: (args.max_depth as number) || 10,
            summaryOnly: (args.summary_only as boolean) || false,
            includePatterns: (args.include_patterns as string[]) || undefined,
            excludePatterns: (args.exclude_patterns as string[]) || undefined,
          });
          try {
            const projectAST = await parser.parseCodebase(rootPath);
            const summaryOnly = (args.summary_only as boolean) || false;
            if (summaryOnly) {
              return {
                content: [
                  {
                    type: "text",
                    text: projectAST.summary,
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      rootPath: projectAST.rootPath,
                      structure: projectAST.structure,
                      fileCount: projectAST.files.length,
                      summary: projectAST.summary,
                      files: projectAST.files.map((f) => ({
                        path: f.path,
                        summary: f.summary,
                        exports: f.exports,
                        functions: f.functions.length,
                        classes: f.classes.length,
                        interfaces: f.interfaces.length,
                        reactComponents: f.reactComponents,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: `AST parse failed: ${msg}` }],
              isError: true,
            };
          }
        }
        case "pull_skills": {
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
              `${workflowBase}/api/v1/workflow/skills/all`,
              { method: "GET", headers },
            );
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: `Skills fetch error: ${res.status} ${errText}`,
                  },
                ],
                isError: true,
              };
            }
            const body = (await res.json()) as {
              skills?: Array<{
                nodeId: string;
                content: string;
                metadata?: Record<string, unknown>;
              }>;
            };
            const { SkillFileManager } =
              await import("../services/skill-file-manager.js");
            const skillManager = new SkillFileManager();
            const count = await skillManager.writeAllSkills(body.skills || []);
            return {
              content: [
                {
                  type: "text",
                  text: `Pulled ${count} skills to .quikim/skills/`,
                },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: `Pull skills failed: ${msg}` }],
              isError: true,
            };
          }
        }
        case "get_skill": {
          const nodeId = args.node_id as string;
          const { SkillFileManager } =
            await import("../services/skill-file-manager.js");
          const { WORKFLOW_NODES } =
            await import("../workflow-engine/config/workflow-definition.js");
          const skillManager = new SkillFileManager();
          const nodeDef = WORKFLOW_NODES[nodeId];
          const specName = nodeDef?.specName || "default";
          // Try local cache first
          let skillContent = await skillManager.readSkillFile(nodeId, specName);
          if (!skillContent) {
            // Fallback: fetch from server and cache locally
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
                `${workflowBase}/api/v1/workflow/skills/${nodeId}`,
                { method: "GET", headers },
              );
              if (res.ok) {
                const body = (await res.json()) as { content?: string };
                skillContent = body.content ?? null;
                if (skillContent) {
                  await skillManager.writeSkillFile(
                    nodeId,
                    specName,
                    skillContent,
                  );
                }
              }
            } catch {
              /* fall through */
            }
          }
          if (!skillContent) {
            return {
              content: [
                {
                  type: "text",
                  text: `No skill found for node ${nodeId}`,
                },
              ],
              isError: true,
            };
          }
          return {
            content: [{ type: "text", text: skillContent }],
          };
        }
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
            const instruction = (await res.json()) as Record<string, unknown>;

            // Resolve skill content: local first, server response as fallback
            if ((instruction.nextCandidates as string[] | undefined)?.length) {
              const nextNodeId = (instruction.nextCandidates as string[])[0];
              const { SkillFileManager } =
                await import("../services/skill-file-manager.js");
              const { WORKFLOW_NODES } =
                await import("../workflow-engine/config/workflow-definition.js");
              const skillManager = new SkillFileManager();
              const nodeDef = WORKFLOW_NODES[nextNodeId];
              if (nodeDef) {
                // 1. Try local .quikim/skills/ first
                const localSkill = await skillManager.readSkillFile(
                  nextNodeId,
                  nodeDef.specName,
                );
                if (localSkill) {
                  instruction.skillContent = localSkill;
                } else if (instruction.skillContent) {
                  // 2. Server included it — use it and cache locally
                  await skillManager.writeSkillFile(
                    nextNodeId,
                    nodeDef.specName,
                    instruction.skillContent as string,
                  );
                }
              }
            }

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
        case "get_llm_queue": {
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
            const queueStatus = (args.status as string) || "pending";
            const queueLimit = (args.limit as number) || 10;
            const params = new URLSearchParams({
              projectId,
              status: queueStatus,
              limit: String(queueLimit),
            });
            const listRes = await fetch(
              `${workflowBase}/api/v1/workflow/queue?${params}`,
              { method: "GET", headers },
            );
            if (!listRes.ok) {
              const errText = await listRes.text();
              return {
                content: [
                  {
                    type: "text",
                    text: `Queue list error: ${listRes.status} ${errText}`,
                  },
                ],
                isError: true,
              };
            }
            const listBody = (await listRes.json()) as {
              items?: Array<Record<string, unknown>>;
            };
            const queueItems = listBody.items || [];
            if (queueItems.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      items: [],
                      message: `No ${queueStatus} queue items for project ${projectId}.`,
                    }),
                  },
                ],
              };
            }
            // Fetch payload for each item
            const enrichedItems = [];
            for (const item of queueItems) {
              try {
                const payloadRes = await fetch(
                  `${workflowBase}/api/v1/workflow/queue/${item.id}/payload`,
                  { method: "GET", headers },
                );
                if (payloadRes.ok) {
                  const payload = await payloadRes.json();
                  enrichedItems.push({ ...item, payload });
                } else {
                  enrichedItems.push({
                    ...item,
                    payload: null,
                    payloadError: `HTTP ${payloadRes.status}`,
                  });
                }
              } catch (payloadErr) {
                enrichedItems.push({
                  ...item,
                  payload: null,
                  payloadError: String(payloadErr),
                });
              }
            }
            const result = {
              items: enrichedItems,
              count: enrichedItems.length,
              instructions:
                "For each item: 1) update_queue_item(id, 'processing'), " +
                "2) Generate content using payload (systemPrompt + skillContent as system, userPrompt as user), " +
                "3) Save via generate_* tool (e.g. generate_requirements), " +
                "4) report_workflow_progress to advance workflow, " +
                "5) update_queue_item(id, 'completed'). On error: update_queue_item(id, 'failed', error_message).",
            };
            return {
              content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: `Queue fetch failed: ${msg}` }],
              isError: true,
            };
          }
        }
        case "update_queue_item": {
          const queueId = args.queue_id as string;
          const newStatus = args.status as string;
          if (!queueId || !newStatus) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: queue_id and status are required.",
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
            const patchBody: Record<string, string> = { status: newStatus };
            if (args.error_message) {
              patchBody.errorMessage = args.error_message as string;
            }
            const res = await fetch(
              `${workflowBase}/api/v1/workflow/queue/${queueId}`,
              {
                method: "PATCH",
                headers,
                body: JSON.stringify(patchBody),
              },
            );
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: `Queue update error: ${res.status} ${errText}`,
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
              content: [{ type: "text", text: `Queue update failed: ${msg}` }],
              isError: true,
            };
          }
        }
        case "poll_queue": {
          // Poll for next pending task and claim it
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
                  text: JSON.stringify({ hasTask: false, error: "project_id required" }),
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
            const sessionId = (args.session_id as string) || "mcp-session";
            const res = await fetch(
              `${workflowBase}/api/v1/workflow/queue/poll?projectId=${projectId}&sessionId=${sessionId}`,
              { method: "POST", headers },
            );
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ hasTask: false, error: `Poll failed: ${res.status} ${errText}` }),
                  },
                ],
                isError: true,
              };
            }
            const result = (await res.json()) as { hasTask: boolean; queueId?: string; [key: string]: unknown };
            if (!result.hasTask) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ hasTask: false, message: "No pending tasks in queue" }),
                  },
                ],
              };
            }
            // Return task with instructions
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ...result,
                    instructions:
                      "1) Use the payload to generate content (systemPrompt + skillContent as system, userPrompt as user). " +
                      "2) Save via generate_* tool (e.g. generate_requirements based on nodeId). " +
                      "3) Call complete_queue_task(queueId, success=true) when done. " +
                      "On error: complete_queue_task(queueId, success=false, error_message).",
                  }, null, 2),
                },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: JSON.stringify({ hasTask: false, error: msg }) }],
              isError: true,
            };
          }
        }
        case "complete_queue_task": {
          // Mark queue task as completed
          const queueId = args.queue_id as string;
          const success = args.success as boolean;
          if (!queueId) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: queue_id is required.",
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
            const params = new URLSearchParams({
              success: String(success),
            });
            if (args.error_message) {
              params.set("errorMessage", args.error_message as string);
            }
            const res = await fetch(
              `${workflowBase}/api/v1/workflow/queue/${queueId}/complete?${params}`,
              { method: "POST", headers },
            );
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: `Complete failed: ${res.status} ${errText}`,
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
              content: [{ type: "text", text: `Complete failed: ${msg}` }],
              isError: true,
            };
          }
        }
        case "skip_workflow_step": {
          // Skip a workflow step
          const nodeId = args.node_id as string;
          const reason = args.reason as string | undefined;
          if (!nodeId) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ success: false, error: "node_id is required" }),
                },
              ],
              isError: true,
            };
          }
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
                  text: JSON.stringify({ success: false, error: "project_id required" }),
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
              `${workflowBase}/api/v1/workflow/skip`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  projectId,
                  nodeId,
                  reason,
                }),
              },
            );
            if (!res.ok) {
              const errText = await res.text();
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ success: false, error: `Skip failed: ${res.status} ${errText}` }),
                  },
                ],
                isError: true,
              };
            }
            const result = await res.json();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: JSON.stringify({ success: false, error: msg }) }],
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
   * After a generate_* tool succeeds, look up the next workflow step and
   * append its skill content to the response so the LLM knows what to
   * generate next.
   */
  private async appendNextStepSkill(
    toolName: string,
    args: Record<string, unknown>,
    result: {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    },
  ): Promise<typeof result> {
    if (result.isError) return result;
    try {
      const { WORKFLOW_NODES, WORKFLOW_NODE_ORDER, getNodeIdByArtifact } =
        await import("../workflow-engine/config/workflow-definition.js");
      const { SkillFileManager } =
        await import("../services/skill-file-manager.js");

      // Map generate_* tool name to artifact type
      const toolToArtifactType: Record<string, string> = {
        generate_requirements: "requirement",
        generate_hld: "hld",
        generate_lld: "lld",
        generate_mermaid: "flow_diagram",
        generate_wireframes: "wireframe_files",
        generate_tasks: "tasks",
        generate_context: "context",
        generate_code_guideline: "code_guideline",
      };
      const artifactType = toolToArtifactType[toolName];
      if (!artifactType) return result;

      const specName = (args.spec_name as string) || "default";
      const artifactName = (args.name as string) || specName;

      // Find current node
      const currentNodeId = getNodeIdByArtifact(
        artifactType,
        specName,
        artifactName,
      );
      if (!currentNodeId) return result;

      // Find next node in agile flow order
      const idx = WORKFLOW_NODE_ORDER.indexOf(currentNodeId);
      if (idx < 0 || idx >= WORKFLOW_NODE_ORDER.length - 1) return result;
      const nextNodeId = WORKFLOW_NODE_ORDER[idx + 1];
      const nextDef = WORKFLOW_NODES[nextNodeId];
      if (!nextDef) return result;

      // Load next step's skill from local cache
      const skillManager = new SkillFileManager();
      const nextSkill = await skillManager.readSkillFile(
        nextNodeId,
        nextDef.specName,
      );
      if (!nextSkill) return result;

      // Append to result
      result.content.push({
        type: "text",
        text: `\n\n--- NEXT WORKFLOW STEP: ${nextDef.label} (${nextNodeId}) ---\n${nextSkill}`,
      });
    } catch {
      // Non-fatal: skill injection is best-effort
    }
    return result;
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
