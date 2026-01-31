/**
 * Quikim - MCP Workflow Engine Integration Service
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';

export type ArtifactType = "requirements" | "design" | "wireframes" | "code" | "tests";
export type ChangeType = "create" | "update" | "delete";
export type ChangeCategory = "breaking" | "feature" | "refactor" | "fix" | "docs" | "style";
export type LockType = "read" | "write" | "exclusive";
export type RiskLevel = "low" | "medium" | "high";
export type ImpactLevel = "low" | "medium" | "high" | "critical";

export interface ChangeEvent {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  changeType: ChangeType;
  changeCategory: ChangeCategory;
  oldContent?: string;
  newContent: string;
  diff?: string;
  userId: string;
  message?: string;
  metadata?: any;
  createdAt: Date;
}

export interface AffectedArtifact {
  artifactType: ArtifactType;
  artifactId: string;
  impactLevel: ImpactLevel;
  suggestedChanges: string[];
}

export interface ImpactAnalysis {
  id: string;
  changeEventId: string;
  affectedArtifacts: AffectedArtifact[];
  requiresApproval: boolean;
  approvers: string[];
  riskLevel: RiskLevel;
  riskFactors: string[];
  estimatedEffort?: number;
  createdAt: Date;
}

export interface PropagationPlan {
  id: string;
  impactAnalysisId: string;
  steps: ExecutionStep[];
  status: "pending" | "approved" | "executing" | "completed" | "failed";
  executedAt?: Date;
  executedBy?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionStep {
  order: number;
  artifactType: ArtifactType;
  artifactId: string;
  action: "update" | "create" | "delete";
  content: string;
  dependencies: string[];
}

export interface ResourceLock {
  id: string;
  projectId: string;
  resourceType: ArtifactType;
  resourceId: string;
  lockType: LockType;
  lockedBy: string;
  reason?: string;
  acquiredAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  metadata?: any;
}

export interface WorkflowEngineConfig {
  projectServiceUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  enableRealTimeSync: boolean;
  enableConflictDetection: boolean;
}

export interface SyncEvent {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  action: "sync_to_ide" | "sync_from_ide";
  content: string;
  timestamp: Date;
  userId: string;
  metadata?: any;
}

export interface CollaborationEvent {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  eventType: "user_joined" | "user_left" | "artifact_locked" | "artifact_unlocked" | "change_made";
  artifactType?: ArtifactType;
  artifactId?: string;
  timestamp: Date;
  metadata?: any;
}

/**
 * Workflow Engine Integration Service
 * Provides integration between MCP server and the workflow engine
 */
export class WorkflowIntegrationService {
  private config: WorkflowEngineConfig;
  private activeLocks: Map<string, ResourceLock> = new Map();
  private syncQueue: SyncEvent[] = [];
  private collaborationEvents: CollaborationEvent[] = [];
  private isInitialized: boolean = false;

  constructor(config: WorkflowEngineConfig) {
    this.config = config;
  }

  /**
   * Initialize the workflow integration service
   */
  async initialize(): Promise<void> {
    const context: ErrorContext = {
      operation: "initializeWorkflowIntegration",
      additionalData: { config: this.config }
    };

    try {
      logger.info("Initializing workflow engine integration", this.config);

      // Validate configuration
      this.validateConfiguration();

      // Initialize real-time sync if enabled
      if (this.config.enableRealTimeSync) {
        await this.initializeRealTimeSync();
      }

      // Initialize conflict detection if enabled
      if (this.config.enableConflictDetection) {
        await this.initializeConflictDetection();
      }

      this.isInitialized = true;
      logger.info("Workflow engine integration initialized successfully");

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to initialize workflow integration", error);
        throw new Error(`Workflow integration initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      logger.warn("Workflow integration initialized with limited functionality");
      this.isInitialized = true;
    }
  }

  /**
   * Detect and record a change event
   */
  async detectChange(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    changeType: ChangeType,
    changeCategory: ChangeCategory,
    oldContent: string | undefined,
    newContent: string,
    userId: string,
    message?: string,
    metadata?: any
  ): Promise<ChangeEvent> {
    const context: ErrorContext = {
      operation: "detectChange",
      userId,
      additionalData: { 
        projectId, 
        artifactType, 
        artifactId, 
        changeType, 
        changeCategory 
      }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Detecting change event", {
        projectId,
        artifactType,
        artifactId,
        changeType,
        changeCategory,
        userId
      });

      // Create change event
      const changeEvent: ChangeEvent = {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        changeType,
        changeCategory,
        oldContent,
        newContent,
        diff: this.generateDiff(oldContent, newContent),
        userId,
        message,
        metadata,
        createdAt: new Date()
      };

      // Send to workflow engine service
      const response = await this.callWorkflowEngineAPI("/changes", "POST", {
        projectId,
        artifactType,
        artifactId,
        changeType,
        changeCategory,
        oldContent,
        newContent,
        userId,
        message,
        metadata
      });

      if (response.success) {
        // Trigger real-time sync if enabled
        if (this.config.enableRealTimeSync) {
          await this.triggerSync(changeEvent);
        }

        // Broadcast collaboration event
        await this.broadcastCollaborationEvent({
          id: this.generateId(),
          projectId,
          userId,
          userName: await this.getUserName(userId),
          eventType: "change_made",
          artifactType,
          artifactId,
          timestamp: new Date(),
          metadata: { changeType, changeCategory }
        });

        return response.data;
      } else {
        throw new Error(`Failed to detect change: ${response.error}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Return a fallback change event
        return {
          id: this.generateId(),
          projectId,
          artifactType,
          artifactId,
          changeType,
          changeCategory,
          oldContent,
          newContent,
          diff: this.generateDiff(oldContent, newContent),
          userId,
          message,
          metadata,
          createdAt: new Date()
        };
      }

      logger.logError("Failed to detect change", error);
      throw error;
    }
  }

  /**
   * Analyze the impact of a change event
   */
  async analyzeImpact(changeEventId: string): Promise<ImpactAnalysis> {
    const context: ErrorContext = {
      operation: "analyzeImpact",
      additionalData: { changeEventId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Analyzing impact", { changeEventId });

      const response = await this.callWorkflowEngineAPI(
        `/changes/${changeEventId}/analyze`,
        "POST",
        {}
      );

      if (response.success) {
        return response.data;
      } else {
        throw new Error(`Failed to analyze impact: ${response.error}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Return a fallback impact analysis
        return {
          id: this.generateId(),
          changeEventId,
          affectedArtifacts: [],
          requiresApproval: false,
          approvers: [],
          riskLevel: "low",
          riskFactors: [],
          createdAt: new Date()
        };
      }

      logger.logError("Failed to analyze impact", error);
      throw error;
    }
  }

  /**
   * Generate a propagation plan
   */
  async generatePropagationPlan(impactAnalysisId: string): Promise<PropagationPlan> {
    const context: ErrorContext = {
      operation: "generatePropagationPlan",
      additionalData: { impactAnalysisId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Generating propagation plan", { impactAnalysisId });

      const response = await this.callWorkflowEngineAPI(
        `/impact-analyses/${impactAnalysisId}/plan`,
        "POST",
        {}
      );

      if (response.success) {
        return response.data;
      } else {
        throw new Error(`Failed to generate propagation plan: ${response.error}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Return a fallback propagation plan
        return {
          id: this.generateId(),
          impactAnalysisId,
          steps: [],
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      logger.logError("Failed to generate propagation plan", error);
      throw error;
    }
  }

  /**
   * Execute a propagation plan
   */
  async executePropagation(
    propagationPlanId: string,
    executorId: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    const context: ErrorContext = {
      operation: "executePropagation",
      userId: executorId,
      additionalData: { propagationPlanId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Executing propagation plan", { propagationPlanId, executorId });

      const response = await this.callWorkflowEngineAPI(
        `/propagation-plans/${propagationPlanId}/execute`,
        "POST",
        { executorId }
      );

      if (response.success) {
        return response.data;
      } else {
        throw new Error(`Failed to execute propagation: ${response.error}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success) {
        return { success: false, errors: ["Propagation failed with recovery"] };
      }

      logger.logError("Failed to execute propagation", error);
      throw error;
    }
  }

  /**
   * Acquire a resource lock
   */
  async acquireLock(
    projectId: string,
    resourceType: ArtifactType,
    resourceId: string,
    lockType: LockType,
    lockedBy: string,
    reason?: string,
    expiresAt?: Date
  ): Promise<ResourceLock> {
    const context: ErrorContext = {
      operation: "acquireLock",
      userId: lockedBy,
      additionalData: { 
        projectId, 
        resourceType, 
        resourceId, 
        lockType 
      }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Acquiring resource lock", {
        projectId,
        resourceType,
        resourceId,
        lockType,
        lockedBy
      });

      const response = await this.callWorkflowEngineAPI("/locks", "POST", {
        projectId,
        resourceType,
        resourceId,
        lockType,
        lockedBy,
        reason,
        expiresAt
      });

      if (response.success) {
        const lock = response.data;
        this.activeLocks.set(lock.id, lock);

        // Broadcast collaboration event
        await this.broadcastCollaborationEvent({
          id: this.generateId(),
          projectId,
          userId: lockedBy,
          userName: await this.getUserName(lockedBy),
          eventType: "artifact_locked",
          artifactType: resourceType,
          artifactId: resourceId,
          timestamp: new Date(),
          metadata: { lockType, reason }
        });

        return lock;
      } else {
        throw new Error(`Failed to acquire lock: ${response.error}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Return a fallback lock
        const lock: ResourceLock = {
          id: this.generateId(),
          projectId,
          resourceType,
          resourceId,
          lockType,
          lockedBy,
          reason,
          acquiredAt: new Date(),
          expiresAt,
          isActive: true
        };
        this.activeLocks.set(lock.id, lock);
        return lock;
      }

      logger.logError("Failed to acquire lock", error);
      throw error;
    }
  }

  /**
   * Release a resource lock
   */
  async releaseLock(lockId: string): Promise<void> {
    const context: ErrorContext = {
      operation: "releaseLock",
      additionalData: { lockId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Releasing resource lock", { lockId });

      const lock = this.activeLocks.get(lockId);
      
      const response = await this.callWorkflowEngineAPI(`/locks/${lockId}`, "DELETE", {});

      if (response.success) {
        this.activeLocks.delete(lockId);

        // Broadcast collaboration event if we have lock info
        if (lock) {
          await this.broadcastCollaborationEvent({
            id: this.generateId(),
            projectId: lock.projectId,
            userId: lock.lockedBy,
            userName: await this.getUserName(lock.lockedBy),
            eventType: "artifact_unlocked",
            artifactType: lock.resourceType,
            artifactId: lock.resourceId,
            timestamp: new Date()
          });
        }
      } else {
        throw new Error(`Failed to release lock: ${response.error}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success) {
        // Remove from local cache even if API call failed
        this.activeLocks.delete(lockId);
        return;
      }

      logger.logError("Failed to release lock", error);
      throw error;
    }
  }

  /**
   * Sync artifact to IDE
   */
  async syncToIDE(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    content: string,
    userId: string
  ): Promise<void> {
    const context: ErrorContext = {
      operation: "syncToIDE",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Syncing to IDE", {
        projectId,
        artifactType,
        artifactId,
        userId
      });

      const syncEvent: SyncEvent = {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        action: "sync_to_ide",
        content,
        timestamp: new Date(),
        userId
      };

      this.syncQueue.push(syncEvent);

      // Process sync queue
      await this.processSyncQueue();

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to sync to IDE", error);
        throw error;
      }
    }
  }

  /**
   * Sync artifact from IDE
   */
  async syncFromIDE(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    content: string,
    userId: string
  ): Promise<void> {
    const context: ErrorContext = {
      operation: "syncFromIDE",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Workflow integration not initialized");
      }

      logger.info("Syncing from IDE", {
        projectId,
        artifactType,
        artifactId,
        userId
      });

      const syncEvent: SyncEvent = {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        action: "sync_from_ide",
        content,
        timestamp: new Date(),
        userId
      };

      this.syncQueue.push(syncEvent);

      // Process sync queue
      await this.processSyncQueue();

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to sync from IDE", error);
        throw error;
      }
    }
  }

  /**
   * Get collaboration events for a project
   */
  getCollaborationEvents(projectId: string, since?: Date): CollaborationEvent[] {
    let events = this.collaborationEvents.filter(event => event.projectId === projectId);
    
    if (since) {
      events = events.filter(event => event.timestamp > since);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get active locks for a project
   */
  getActiveLocks(projectId: string): ResourceLock[] {
    return Array.from(this.activeLocks.values())
      .filter(lock => lock.projectId === projectId && lock.isActive);
  }

  /**
   * Get sync queue status
   */
  getSyncQueueStatus(): {
    queueLength: number;
    pendingEvents: SyncEvent[];
  } {
    return {
      queueLength: this.syncQueue.length,
      pendingEvents: [...this.syncQueue]
    };
  }

  // Private helper methods

  private validateConfiguration(): void {
    if (!this.config.projectServiceUrl) {
      throw new Error("Project service URL is required");
    }

    if (this.config.timeout <= 0) {
      throw new Error("Timeout must be greater than 0");
    }

    if (this.config.retryAttempts < 0) {
      throw new Error("Retry attempts must be non-negative");
    }
  }

  private async initializeRealTimeSync(): Promise<void> {
    logger.info("Initializing real-time sync");
    // Implementation would set up WebSocket connections or similar
  }

  private async initializeConflictDetection(): Promise<void> {
    logger.info("Initializing conflict detection");
    // Implementation would set up conflict detection mechanisms
  }

  private async callWorkflowEngineAPI(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    data?: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Mock implementation - in real scenario, this would make HTTP calls
      logger.info(`Calling workflow engine API: ${method} ${endpoint}`, data);
      
      // Simulate API response
      return {
        success: true,
        data: {
          id: this.generateId(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  private generateDiff(oldContent?: string, newContent?: string): string {
    if (!oldContent) return `+++ ${newContent?.length || 0} lines added`;
    if (!newContent) return `--- ${oldContent.length} lines removed`;
    
    // Simple diff implementation
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    
    return `@@ -${oldLines.length} +${newLines.length} @@`;
  }

  private async triggerSync(changeEvent: ChangeEvent): Promise<void> {
    const syncEvent: SyncEvent = {
      id: this.generateId(),
      projectId: changeEvent.projectId,
      artifactType: changeEvent.artifactType,
      artifactId: changeEvent.artifactId,
      action: "sync_to_ide",
      content: changeEvent.newContent,
      timestamp: new Date(),
      userId: changeEvent.userId
    };

    this.syncQueue.push(syncEvent);
    await this.processSyncQueue();
  }

  private async processSyncQueue(): Promise<void> {
    while (this.syncQueue.length > 0) {
      const event = this.syncQueue.shift();
      if (event) {
        logger.info("Processing sync event", event);
        // Implementation would handle actual sync
      }
    }
  }

  private async broadcastCollaborationEvent(event: CollaborationEvent): Promise<void> {
    this.collaborationEvents.push(event);
    
    // Keep only recent events (last 1000)
    if (this.collaborationEvents.length > 1000) {
      this.collaborationEvents = this.collaborationEvents.slice(-1000);
    }

    logger.info("Broadcasting collaboration event", event);
    // Implementation would broadcast to connected clients
  }

  private async getUserName(userId: string): Promise<string> {
    // Mock implementation - would fetch from user service
    return `User_${userId.substring(0, 8)}`;
  }

  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}