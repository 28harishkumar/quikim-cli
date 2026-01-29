/**
 * Quikim - MCP Server Core
 * Lightweight server that processes XML requests and integrates with decision engine
 * Integrated with CLI for shared authentication and configuration
 * 
 * Copyright (c) 2026 Quikim Inc.
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
} from './prompts/capabilities.js';
import { mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { getQuikimProjectRoot } from '../config/project-root.js';

import { SessionManager, sessionManager } from './session/manager.js';
// Lazy import to avoid circular dependency: server.ts -> workflow-tools.ts -> integration/index.ts -> server.ts
// import { WorkflowEngineTools } from './handlers/workflow-tools.js';
import { logger } from './utils/logger.js';
import { errorHandler, ErrorContext } from './utils/error-handler.js';
import { PROTOCOL_CONFIG, PROJECT_CONTEXT_SCHEMA } from './utils/constants.js';
import { CodebaseContext } from './session/types.js';
import { ToolHandlers } from './handlers/index.js';
import { ServiceAwareAPIClient } from './api/service-client.js';
import {
  projectContextResolver,
  ProjectContext,
} from './services/project-context.js';

// Import CLI config manager for shared authentication
import { configManager } from '../config/manager.js';

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
      }
    );

    this.sessionManager = sessionManager;

    // Initialize API client using CLI's shared configuration
    // Priority: 1) Environment variable, 2) CLI config
    const apiKey = this.resolveApiKey();
    
    logger.info("Initializing MCP server with service-aware API configuration", {
      userServiceUrl: configManager.getUserServiceUrl(),
      projectServiceUrl: configManager.getProjectServiceUrl(),
      hasApiKey: !!apiKey,
      isLocalMode: configManager.isLocalMode(),
    });

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
          name: "push_requirements",
          description:
            "Upload requirements to server. REQUIRED: codebase.files array must contain a file with path matching '.quikim/artifacts/<spec name>/requirement_<artifact_id>.md' and content property with markdown string. Example: {codebase: {files: [{path: '.quikim/artifacts/default/requirement_main.md', content: '<html content here>'}]}, user_prompt: 'string'}",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description:
                  "Object with 'files' array. Each file must have 'path' and 'content'. Path must match: .quikim/artifacts/<spec>/requirement_<id>.md",
              },
              user_prompt: {
                type: "string",
                description: "Original user request",
              },
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
                    description: "If true, fetch from API then write to local; otherwise read from local files",
                  },
                },
              },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "push_hld",
          description:
            "Update high-level designs at server from local designs",
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
          name: "push_wireframes",
          description:
            "Push wireframes to server. File MUST be at .quikim/artifacts/<spec>/wireframe_files_<id>.md (not wireframe_).",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description: "Files array. Path must match: .quikim/artifacts/<spec>/wireframe_files_<id>.md",
              },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "push_tasks",
          description: "Update tasks at server from local tasks",
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
          description: "Push local ER diagram to server",
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
          description: "Fetch mermaid diagrams from server (flowchart, sequence, class, ER, state, gantt, etc.)",
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
          name: "push_mermaid",
          description:
            "Push flow/mermaid diagrams to server. File MUST be at .quikim/artifacts/<spec>/flow_diagram_<id>.md (artifact type is flow_diagram, not mermaid).",
          inputSchema: {
            type: "object",
            properties: {
              codebase: {
                type: "object",
                description: "Files array. Path must match: .quikim/artifacts/<spec>/flow_diagram_<id>.md",
              },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_lld",
          description: "Fetch or generate Low-Level Design (LLD) for a specific component. LLD provides detailed specifications including interfaces, data models, method specifications, and sequence diagrams.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string", description: "Include component name, e.g., 'pull_lld for auth service' or 'LLD for payment module'" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "push_lld",
          description: "Push local Low-Level Design (LLD) files to server. Syncs component-specific detailed designs.",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string", description: "Optionally specify component name to push specific LLD" },
              project_context: PROJECT_CONTEXT_SCHEMA,
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "push_context",
          description:
            "Push context artifact to server. File at .quikim/artifacts/<spec>/context_<id>.md",
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
          name: "pull_context",
          description: "Read context from local files or fetch from API (data.force=true)",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
              data: { type: "object", properties: { force: { type: "boolean" } } },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "push_code_guideline",
          description:
            "Push code guideline to server. File at .quikim/artifacts/<spec>/code_guideline_<id>.md",
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
          name: "pull_code_guideline",
          description: "Read code guidelines from local files or fetch from API (data.force=true)",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: PROJECT_CONTEXT_SCHEMA,
              data: { type: "object", properties: { force: { type: "boolean" } } },
            },
            required: ["user_prompt"],
          },
        } as Tool,
      ];

      // Get workflow engine tools (lazy import to avoid circular dependency)
      const { WorkflowEngineTools } = await import('./handlers/workflow-tools.js');
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
        const logPath = join(getQuikimProjectRoot(), '.quikim', 'mcp-debug.log');
        mkdirSync(dirname(logPath), { recursive: true });
        appendFileSync(logPath, `\n=== ${new Date().toISOString()} ===\n`);
        appendFileSync(logPath, `Tool: ${name}\n`);
        appendFileSync(logPath, `Args keys: ${Object.keys(args || {}).join(', ')}\n`);
        if (args?.codebase) {
          const files = (args.codebase as any)?.files;
          appendFileSync(logPath, `Files count: ${files?.length || 0}\n`);
          if (files && files.length > 0) {
            files.forEach((f: any, i: number) => {
              appendFileSync(logPath, `  File ${i}: ${f.path}\n`);
              appendFileSync(logPath, `    Content type: ${typeof f.content}\n`);
              if (Array.isArray(f.content)) {
                appendFileSync(logPath, `    Content array length: ${f.content.length}\n`);
                appendFileSync(logPath, `    First block: ${JSON.stringify(f.content[0]).substring(0, 100)}\n`);
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
      const data = args.data as Record<string, unknown> | undefined;

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
      const resolvedContext = await projectContextResolver.resolveFromCodebase(
        codebase
      );
      const projectContext: ProjectContext = {
        ...resolvedContext,
        ...((args.project_context as Record<string, unknown>) || {}),
      };

      logger.debug("[MCP Server] Calling handler", {
        toolName: name,
        hasData: !!data,
        projectId: projectContext.projectId,
        specName: projectContext.specName,
      });

      // Route to appropriate handler
      switch (name) {
        case "push_requirements":
          return await this.toolHandlers.handlePushRequirements(
            codebase,
            userPrompt,
            projectContext,
            data  // Pass data for direct execution
          );
        case "pull_requirements":
          return await this.toolHandlers.handlePullRequirements(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_hld":
          return await this.toolHandlers.handlePushHLD(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_hld":
          return await this.toolHandlers.handlePullHLD(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_wireframe":
          return await this.toolHandlers.handlePullWireframe(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_wireframes":
          return await this.toolHandlers.handlePushWireframes(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_tasks":
          return await this.toolHandlers.handlePushTasks(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_tasks":
          return await this.toolHandlers.handlePullTasks(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "update_code":
          return await this.toolHandlers.handleUpdateCode(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "er_diagram_pull":
          return await this.toolHandlers.handleERDiagramPull(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "er_diagram_push":
          return await this.toolHandlers.handleERDiagramPush(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_rules":
          return await this.toolHandlers.handlePullRules(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_mermaid":
          return await this.toolHandlers.handlePullMermaid(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_mermaid":
          return await this.toolHandlers.handlePushMermaid(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_lld":
          return await this.toolHandlers.handlePullLLD(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_lld":
          return await this.toolHandlers.handlePushLLD(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_context":
          return await this.toolHandlers.handlePushContext(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_context":
          return await this.toolHandlers.handlePullContext(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "push_code_guideline":
          return await this.toolHandlers.handlePushCodeGuideline(
            codebase,
            userPrompt,
            projectContext,
            data
          );
        case "pull_code_guideline":
          return await this.toolHandlers.handlePullCodeGuideline(
            codebase,
            userPrompt,
            projectContext,
            data
          );
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
          const { WorkflowEngineTools } = await import('./handlers/workflow-tools.js');
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
        "Unhandled Rejection"
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
    operation: string
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
    operation: string
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
