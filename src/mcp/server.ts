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
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { XMLProtocolParser, xmlParser } from './xml/parser.js';
import { SessionManager, sessionManager } from './session/manager.js';
import { WorkflowEngineTools } from './handlers/workflow-tools.js';
import { logger } from './utils/logger.js';
import { errorHandler, ErrorContext } from './utils/error-handler.js';
import { PROTOCOL_CONFIG } from './utils/constants.js';
import { RequirementHandler } from './workflows/requirement-handler.js';
import { CodebaseContext } from './session/types.js';
import { ToolHandlers } from './handlers/index.js';
import { QuikimAPIClient } from './api/client.js';
import {
  projectContextResolver,
  ProjectContext,
} from './services/project-context.js';
import { RAGService } from './services/rag.js';

// Import CLI config manager for shared authentication
import { configManager } from '../config/manager.js';

export class MCPCursorProtocolServer {
  private server: Server;
  private xmlParser: XMLProtocolParser;
  private sessionManager: SessionManager;
  private requirementHandler: RequirementHandler;
  private toolHandlers: ToolHandlers;
  private apiClient: QuikimAPIClient;

  constructor() {
    this.server = new Server(
      {
        name: "quikim-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.xmlParser = xmlParser;
    this.sessionManager = sessionManager;
    this.requirementHandler = new RequirementHandler();

    // Initialize API client using CLI's shared configuration
    // Priority: 1) Environment variable, 2) CLI config
    const apiBaseURL = this.resolveApiBaseUrl();
    const apiKey = this.resolveApiKey();
    
    logger.info("Initializing MCP server with API configuration", {
      apiBaseURL,
      hasApiKey: !!apiKey,
      isLocalMode: configManager.isLocalMode(),
    });

    this.apiClient = new QuikimAPIClient({
      baseURL: apiBaseURL,
      apiKey,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    // Initialize RAG service with API client
    const ragService = new RAGService(this.apiClient);

    // Initialize tool handlers
    this.toolHandlers = new ToolHandlers(
      this.requirementHandler,
      this.apiClient,
      this.xmlParser,
      ragService
    );

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  /**
   * Resolve API base URL from environment or CLI config
   */
  private resolveApiBaseUrl(): string {
    // Environment variable takes precedence
    if (process.env.QUIKIM_API_BASE_URL) {
      return process.env.QUIKIM_API_BASE_URL;
    }
    
    // Use CLI's configured project service URL
    return configManager.getProjectServiceUrl();
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
            "Update requirements on server from local requirements",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: { type: "object" },
            },
            required: ["codebase", "user_prompt"],
          },
        } as Tool,
        {
          name: "pull_requirements",
          description:
            "Fetch all requirements from server and return files or instructions",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
            },
            required: ["user_prompt"],
          },
        } as Tool,
        {
          name: "push_wireframes",
          description: "Update server wireframes from local",
          inputSchema: {
            type: "object",
            properties: {
              codebase: { type: "object" },
              user_prompt: { type: "string" },
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
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
              project_context: { type: "object" },
            },
            required: ["user_prompt"],
          },
        } as Tool,
      ];

      // Get workflow engine tools
      const workflowTools = await WorkflowEngineTools.listTools();

      // Combine all tools
      return {
        tools: [...existingTools, ...workflowTools],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

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

      // Resolve project context from codebase
      const resolvedContext = await projectContextResolver.resolveFromCodebase(
        codebase
      );
      const projectContext: ProjectContext = {
        ...resolvedContext,
        ...((args.project_context as any) || {}),
      };

      // Route to appropriate handler
      switch (name) {
        case "push_requirements":
          return await this.toolHandlers.handlePushRequirements(
            codebase,
            userPrompt,
            projectContext
          );
        case "pull_requirements":
          return await this.toolHandlers.handlePullRequirements(
            codebase,
            userPrompt,
            projectContext
          );
        case "push_hld":
          return await this.toolHandlers.handlePushHLD(
            codebase,
            userPrompt,
            projectContext
          );
        case "pull_hld":
          return await this.toolHandlers.handlePullHLD(
            codebase,
            userPrompt,
            projectContext
          );
        case "pull_wireframe":
          return await this.toolHandlers.handlePullWireframe(
            codebase,
            userPrompt,
            projectContext
          );
        case "push_wireframes":
          return await this.toolHandlers.handlePushWireframes(
            codebase,
            userPrompt,
            projectContext
          );
        case "push_tasks":
          return await this.toolHandlers.handlePushTasks(
            codebase,
            userPrompt,
            projectContext
          );
        case "pull_tasks":
          return await this.toolHandlers.handlePullTasks(
            codebase,
            userPrompt,
            projectContext
          );
        case "update_code":
          return await this.toolHandlers.handleUpdateCode(
            codebase,
            userPrompt,
            projectContext
          );
        case "er_diagram_pull":
          return await this.toolHandlers.handleERDiagramPull(
            codebase,
            userPrompt,
            projectContext
          );
        case "er_diagram_push":
          return await this.toolHandlers.handleERDiagramPush(
            codebase,
            userPrompt,
            projectContext
          );
        case "pull_rules":
          return await this.toolHandlers.handlePullRules(
            codebase,
            userPrompt,
            projectContext
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
        case "join_collaboration_session":
        case "leave_collaboration_session":
        case "generate_code_from_requirements":
        case "generate_code_from_design":
          return await WorkflowEngineTools.handleToolCall(request);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
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
