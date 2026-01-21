/**
 * Integration Layer - Wires all components together
 * Connects XML layer, MCP server, decision engine, and request counter
 * Requirements: 1.1, 1.3, 1.4
 */

import MCPCursorProtocolServer from '../server.js';
import { XMLProtocolParser, xmlParser } from '../xml/parser.js';
import { DecisionEngine } from '../decision/engine.js';
import { SessionManager, sessionManager } from '../session/manager.js';
import WorkflowLoopManager from '../workflow/manager.js';
import { WorkflowIntegrationService } from '../services/workflow-integration.js';
import { BidirectionalSyncService } from '../services/bidirectional-sync.js';
import { RealTimeCollaborationService } from '../services/realtime-collaboration.js';
import { CodeGenerationService } from '../services/code-generation.js';
import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { PROTOCOL_CONFIG } from '../utils/constants.js';

export interface IntegrationConfig {
  enableLogging?: boolean;
  maxRequestsPerSession?: number;
  sessionTimeoutMs?: number;
  enableErrorRecovery?: boolean;
  workflowEngine?: {
    projectServiceUrl: string;
    apiKey?: string;
    timeout: number;
    retryAttempts: number;
    enableRealTimeSync: boolean;
    enableConflictDetection: boolean;
  };
  bidirectionalSync?: {
    enableAutoSync: boolean;
    syncInterval: number;
    conflictResolution: "manual" | "auto_merge" | "last_writer_wins";
    enableVersioning: boolean;
    maxSyncRetries: number;
  };
  realTimeCollaboration?: {
    maxParticipants: number;
    sessionTimeout: number;
    enableCursorSharing: boolean;
    enableRealTimeEditing: boolean;
    enableComments: boolean;
    enablePresenceIndicators: boolean;
    conflictResolution: "operational_transform" | "last_writer_wins" | "manual";
  };
  codeGeneration?: {
    maxGenerationTime: number;
    maxFilesPerGeneration: number;
    maxLinesPerFile: number;
    enableQualityAnalysis: boolean;
    enableOptimization: boolean;
    defaultLanguage: string;
    defaultFramework?: string;
    templateDirectory?: string;
    customPrompts?: Record<string, string>;
  };
}

export class ProtocolIntegration {
  private server: MCPCursorProtocolServer;
  private xmlParser: XMLProtocolParser;
  private decisionEngine: DecisionEngine;
  private sessionManager: SessionManager;
  private workflowManager: WorkflowLoopManager;
  private workflowIntegration: WorkflowIntegrationService;
  private bidirectionalSync: BidirectionalSyncService;
  private realTimeCollaboration: RealTimeCollaborationService;
  private codeGeneration: CodeGenerationService;
  private config: IntegrationConfig;
  private isInitialized: boolean = false;

  constructor(config: IntegrationConfig = {}) {
    this.config = {
      enableLogging: true,
      maxRequestsPerSession: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION,
      sessionTimeoutMs: PROTOCOL_CONFIG.SESSION_TIMEOUT_MS,
      enableErrorRecovery: true,
      workflowEngine: {
        projectServiceUrl: process.env.PROJECT_SERVICE_URL || "http://localhost:3001",
        timeout: 30000,
        retryAttempts: 3,
        enableRealTimeSync: true,
        enableConflictDetection: true,
        ...config.workflowEngine
      },
      bidirectionalSync: {
        enableAutoSync: true,
        syncInterval: 5000,
        conflictResolution: "manual",
        enableVersioning: true,
        maxSyncRetries: 3,
        ...config.bidirectionalSync
      },
      realTimeCollaboration: {
        maxParticipants: 10,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        enableCursorSharing: true,
        enableRealTimeEditing: true,
        enableComments: true,
        enablePresenceIndicators: true,
        conflictResolution: "operational_transform",
        ...config.realTimeCollaboration
      },
      codeGeneration: {
        maxGenerationTime: 60000,
        maxFilesPerGeneration: 50,
        maxLinesPerFile: 1000,
        enableQualityAnalysis: true,
        enableOptimization: true,
        defaultLanguage: "typescript",
        defaultFramework: "react",
        ...config.codeGeneration
      },
      ...config
    };

    // Initialize components
    this.xmlParser = xmlParser;
    this.decisionEngine = new DecisionEngine();
    this.sessionManager = sessionManager;
    
    // Initialize workflow integration services
    this.workflowIntegration = new WorkflowIntegrationService(this.config.workflowEngine!);
    this.bidirectionalSync = new BidirectionalSyncService(
      this.workflowIntegration,
      this.config.bidirectionalSync!
    );
    this.realTimeCollaboration = new RealTimeCollaborationService(
      this.workflowIntegration,
      this.config.realTimeCollaboration!
    );
    this.codeGeneration = new CodeGenerationService(
      this.workflowIntegration,
      this.config.codeGeneration!
    );
    
    this.workflowManager = new WorkflowLoopManager(
      this.decisionEngine,
      this.sessionManager,
      this.xmlParser
    );
    this.server = new MCPCursorProtocolServer();
  }

  /**
   * Initialize the integrated protocol system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Protocol integration already initialized');
      return;
    }

    const context: ErrorContext = {
      operation: 'initializeIntegration',
      additionalData: { config: this.config }
    };

    try {
      logger.info('Initializing MCP Cursor Protocol integration', this.config);

      // Validate configuration
      this.validateConfiguration();

      // Initialize error handling
      await this.initializeErrorHandling();

      // Initialize session management
      this.initializeSessionManagement();

      // Initialize workflow integration services
      await this.initializeWorkflowIntegration();

      // Initialize bidirectional sync
      await this.initializeBidirectionalSync();

      // Initialize real-time collaboration
      await this.initializeRealTimeCollaboration();

      // Initialize code generation
      await this.initializeCodeGeneration();

      // Initialize XML processing
      this.initializeXMLProcessing();

      // Initialize MCP server
      await this.initializeMCPServer();

      // Set up component connections
      this.wireComponents();

      // Start background processes
      this.startBackgroundProcesses();

      this.isInitialized = true;
      logger.info('MCP Cursor Protocol integration initialized successfully');

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError('Failed to initialize protocol integration', error);
        throw new Error(`Integration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      logger.warn('Integration initialized with partial functionality due to errors');
      this.isInitialized = true;
    }
  }

  /**
   * Start the integrated protocol system
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const context: ErrorContext = {
      operation: 'startIntegration',
      additionalData: { isInitialized: this.isInitialized }
    };

    try {
      logger.info('Starting MCP Cursor Protocol integration');

      // Start the MCP server
      await this.server.start();

      // Log successful startup
      logger.info('MCP Cursor Protocol integration started successfully', {
        serverRunning: true,
        componentsWired: true,
        backgroundProcessesActive: true
      });

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError('Failed to start protocol integration', error);
        throw new Error(`Integration startup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      logger.warn('Integration started with limited functionality due to errors');
    }
  }

  /**
   * Stop the integrated protocol system
   */
  async stop(): Promise<void> {
    const context: ErrorContext = {
      operation: 'stopIntegration',
      additionalData: { isInitialized: this.isInitialized }
    };

    try {
      logger.info('Stopping MCP Cursor Protocol integration');

      // Stop background processes
      this.stopBackgroundProcesses();

      // Stop workflow integration services
      if (this.workflowIntegration) {
        // WorkflowIntegrationService doesn't have a stop method, but we can log
        logger.info('Workflow integration stopped');
      }

      if (this.bidirectionalSync) {
        await this.bidirectionalSync.stop();
      }

      if (this.realTimeCollaboration) {
        await this.realTimeCollaboration.stop();
      }

      if (this.codeGeneration) {
        await this.codeGeneration.stop();
      }

      // Stop the MCP server
      await this.server.stop();

      // Clean up sessions
      this.sessionManager.cleanupExpiredSessions();

      // Reset initialization state
      this.isInitialized = false;

      logger.info('MCP Cursor Protocol integration stopped successfully');

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError('Error during integration shutdown', error);
      }

      // Force reset even if errors occurred
      this.isInitialized = false;
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    serverRunning: boolean;
    activeSessions: number;
    totalSessions: number;
    config: IntegrationConfig;
  } {
    return {
      initialized: this.isInitialized,
      serverRunning: this.isInitialized, // Simplified - could add actual server status check
      activeSessions: this.sessionManager.getActiveSessions().length,
      totalSessions: this.sessionManager.getSessionCount(),
      config: this.config
    };
  }

  /**
   * Process a workflow request (main integration point)
   */
  async processWorkflowRequest(xmlRequest: string, userId: string = 'default_user'): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Protocol integration not initialized');
    }

    const context: ErrorContext = {
      operation: 'processWorkflowRequest',
      userId,
      additionalData: { xmlRequestLength: xmlRequest?.length || 0 }
    };

    try {
      // Parse XML request
      const parseResult = this.xmlParser.parseRequest(xmlRequest);
      if (!parseResult.success || !parseResult.data) {
        throw new Error(`XML parsing failed: ${parseResult.error}`);
      }

      const request = parseResult.data;
      context.requestId = request.requestId;

      // Process through workflow manager
      const workflowResult = await this.workflowManager.processWorkflowStep(request, userId);

      // Format response as XML
      const formatResult = this.xmlParser.formatResponse(workflowResult.response);
      if (!formatResult.success || !formatResult.data) {
        throw new Error(`XML formatting failed: ${formatResult.error}`);
      }

      return formatResult.data;

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData?.xmlResponse) {
        return recoveryResult.fallbackData.xmlResponse;
      }

      // Create error response
      const errorResponse = {
        requestId: context.requestId || 'unknown',
        action: 'complete' as const,
        instructions: 'Error occurred during processing',
        parameters: {},
        reasoning: `Integration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        finalResponse: `An error occurred during workflow processing: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      const errorFormatResult = this.xmlParser.formatResponse(errorResponse);
      return errorFormatResult.success && errorFormatResult.data 
        ? errorFormatResult.data 
        : '<mcp_response><request_id>unknown</request_id><action>complete</action><instructions>Error occurred</instructions><reasoning>Integration error</reasoning><final_response>Internal error occurred</final_response></mcp_response>';
    }
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    if (this.config.maxRequestsPerSession && this.config.maxRequestsPerSession <= 0) {
      throw new Error('maxRequestsPerSession must be greater than 0');
    }

    if (this.config.sessionTimeoutMs && this.config.sessionTimeoutMs <= 0) {
      throw new Error('sessionTimeoutMs must be greater than 0');
    }
  }

  /**
   * Initialize error handling
   */
  private async initializeErrorHandling(): Promise<void> {
    if (this.config.enableErrorRecovery) {
      // Error handling is already initialized via imports
      logger.info('Error handling initialized with recovery enabled');
    } else {
      logger.info('Error handling initialized without recovery');
    }
  }

  /**
   * Initialize workflow integration
   */
  private async initializeWorkflowIntegration(): Promise<void> {
    await this.workflowIntegration.initialize();
    logger.info("Workflow integration initialized");
  }

  /**
   * Initialize bidirectional sync
   */
  private async initializeBidirectionalSync(): Promise<void> {
    await this.bidirectionalSync.initialize();
    logger.info("Bidirectional sync initialized");
  }

  /**
   * Initialize real-time collaboration
   */
  private async initializeRealTimeCollaboration(): Promise<void> {
    await this.realTimeCollaboration.initialize();
    logger.info("Real-time collaboration initialized");
  }

  /**
   * Initialize code generation
   */
  private async initializeCodeGeneration(): Promise<void> {
    await this.codeGeneration.initialize();
    logger.info("Code generation initialized");
  }

  /**
   * Initialize session management
   */
  private initializeSessionManagement(): void {
    // Session manager is already initialized via imports
    // Update configuration if needed
    if (this.config.maxRequestsPerSession) {
      // Configuration is handled at the protocol level
      logger.info('Session management initialized', {
        maxRequestsPerSession: this.config.maxRequestsPerSession
      });
    }
  }

  /**
   * Initialize XML processing
   */
  private initializeXMLProcessing(): void {
    // XML parser is already initialized via imports
    logger.info('XML processing initialized');
  }

  /**
   * Initialize MCP server
   */
  private async initializeMCPServer(): Promise<void> {
    // MCP server is already initialized in constructor
    logger.info('MCP server initialized');
  }

  /**
   * Wire all components together
   */
  private wireComponents(): void {
    // Components are already wired through constructor dependencies
    // This method serves as a verification point
    
    logger.info('Components wired successfully', {
      xmlParser: !!this.xmlParser,
      decisionEngine: !!this.decisionEngine,
      sessionManager: !!this.sessionManager,
      workflowManager: !!this.workflowManager,
      server: !!this.server
    });
  }

  /**
   * Start background processes
   */
  private startBackgroundProcesses(): void {
    // Session cleanup is handled by the server
    logger.info('Background processes started');
  }

  /**
   * Stop background processes
   */
  private stopBackgroundProcesses(): void {
    // Background processes are handled by the server
    logger.info('Background processes stopped');
  }

  /**
   * Get component references (for testing)
   */
  getComponents(): {
    server: MCPCursorProtocolServer;
    xmlParser: XMLProtocolParser;
    decisionEngine: DecisionEngine;
    sessionManager: SessionManager;
    workflowManager: WorkflowLoopManager;
    workflowIntegration: WorkflowIntegrationService;
    bidirectionalSync: BidirectionalSyncService;
    realTimeCollaboration: RealTimeCollaborationService;
    codeGeneration: CodeGenerationService;
  } {
    return {
      server: this.server,
      xmlParser: this.xmlParser,
      decisionEngine: this.decisionEngine,
      sessionManager: this.sessionManager,
      workflowManager: this.workflowManager,
      workflowIntegration: this.workflowIntegration,
      bidirectionalSync: this.bidirectionalSync,
      realTimeCollaboration: this.realTimeCollaboration,
      codeGeneration: this.codeGeneration
    };
  }
}

// Create and export default integration instance
export const protocolIntegration = new ProtocolIntegration();

// Export for direct use
export default ProtocolIntegration;