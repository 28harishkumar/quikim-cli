/**
 * Quikim - Integration Layer for Workflow Services
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { WorkflowIntegrationService } from '../services/workflow-integration.js';
import { BidirectionalSyncService } from '../services/bidirectional-sync.js';
import { RealTimeCollaborationService } from '../services/realtime-collaboration.js';
import { CodeGenerationService } from '../services/code-generation.js';
import { AIAgent } from '../agent/index.js';
import { QuikimAPIClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { getQuikimProjectRoot } from '../../config/project-root.js';

export interface IntegrationConfig {
  enableLogging?: boolean;
  enableErrorRecovery?: boolean;
  aiAgent?: {
    enabled: boolean;
    maxRetries: number;
    verbose: boolean;
  };
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
    conflictResolution: "manual" | "auto_merge" | "last_writer_wins" | "three_way_merge";
    enableVersioning: boolean;
    maxSyncRetries: number;
    enableFileWatchers: boolean;
    projectPath?: string;
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
  private workflowIntegration: WorkflowIntegrationService;
  private bidirectionalSync: BidirectionalSyncService;
  private realTimeCollaboration: RealTimeCollaborationService;
  private codeGeneration: CodeGenerationService;
  private aiAgent?: AIAgent;
  private apiClient?: QuikimAPIClient;
  private config: IntegrationConfig;
  private isInitialized: boolean = false;

  constructor(config: IntegrationConfig = {}) {
    this.config = {
      enableLogging: true,
      enableErrorRecovery: true,
      aiAgent: {
        enabled: true,
        maxRetries: 3,
        verbose: true,
        ...config.aiAgent
      },
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
        conflictResolution: "three_way_merge",
        enableVersioning: true,
        maxSyncRetries: 3,
        enableFileWatchers: true,
        projectPath: getQuikimProjectRoot(),
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

    // Initialize API client and AI Agent
    if (this.config.aiAgent?.enabled) {
      this.apiClient = new QuikimAPIClient({
        baseURL: this.config.workflowEngine!.projectServiceUrl,
        apiKey: this.config.workflowEngine!.apiKey,
        timeout: this.config.workflowEngine!.timeout,
        retryAttempts: this.config.workflowEngine!.retryAttempts
      });
      
      this.aiAgent = new AIAgent({
        apiClient: this.apiClient,
        maxRetries: this.config.aiAgent.maxRetries,
        verbose: this.config.aiAgent.verbose
      });
    }
    
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
  }

  /**
   * Initialize the integrated protocol system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Protocol integration already initialized");
      return;
    }

    const context: ErrorContext = {
      operation: "initializeIntegration",
      additionalData: { config: this.config }
    };

    try {
      logger.info("Initializing MCP Cursor Protocol integration", this.config);

      // Initialize workflow integration services
      await this.workflowIntegration.initialize();
      await this.bidirectionalSync.initialize();
      await this.realTimeCollaboration.initialize();
      await this.codeGeneration.initialize();

      this.isInitialized = true;
      logger.info("MCP Cursor Protocol integration initialized successfully");

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to initialize protocol integration", error);
        throw new Error(`Integration initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      logger.warn("Integration initialized with partial functionality due to errors");
      this.isInitialized = true;
    }
  }

  /**
   * Stop the integrated protocol system
   */
  async stop(): Promise<void> {
    const context: ErrorContext = {
      operation: "stopIntegration",
      additionalData: { isInitialized: this.isInitialized }
    };

    try {
      logger.info("Stopping MCP Cursor Protocol integration");

      if (this.bidirectionalSync) {
        await this.bidirectionalSync.stop();
      }

      if (this.realTimeCollaboration) {
        await this.realTimeCollaboration.stop();
      }

      if (this.codeGeneration) {
        await this.codeGeneration.stop();
      }

      this.isInitialized = false;
      logger.info("MCP Cursor Protocol integration stopped successfully");

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Error during integration shutdown", error);
      }

      this.isInitialized = false;
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    config: IntegrationConfig;
  } {
    return {
      initialized: this.isInitialized,
      config: this.config
    };
  }

  /**
   * Process an AI Agent request (for API interaction)
   */
  async processAgentRequest(requestId: string, intent: string, data?: Record<string, unknown>, projectId?: string): Promise<unknown> {
    if (!this.aiAgent) {
      throw new Error("AI Agent is not enabled");
    }

    return this.aiAgent.processRequest({
      requestId,
      intent,
      data,
      projectId
    });
  }

  /**
   * Get component references (for testing and workflow tools)
   */
  getComponents(): {
    workflowIntegration: WorkflowIntegrationService;
    bidirectionalSync: BidirectionalSyncService;
    realTimeCollaboration: RealTimeCollaborationService;
    codeGeneration: CodeGenerationService;
    aiAgent?: AIAgent;
    apiClient?: QuikimAPIClient;
  } {
    return {
      workflowIntegration: this.workflowIntegration,
      bidirectionalSync: this.bidirectionalSync,
      realTimeCollaboration: this.realTimeCollaboration,
      codeGeneration: this.codeGeneration,
      aiAgent: this.aiAgent,
      apiClient: this.apiClient
    };
  }
}

// Create and export default integration instance
export const protocolIntegration = new ProtocolIntegration();

// Export for direct use
export default ProtocolIntegration;