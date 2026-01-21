/**
 * Quikim - Bidirectional Sync Service
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { WorkflowIntegrationService, ArtifactType, ChangeCategory } from './workflow-integration.js';

export interface SyncConfiguration {
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  conflictResolution: "manual" | "auto_merge" | "last_writer_wins";
  enableVersioning: boolean;
  maxSyncRetries: number;
}

export interface SyncStatus {
  artifactId: string;
  artifactType: ArtifactType;
  lastSyncTime: Date;
  syncDirection: "to_ide" | "from_ide" | "bidirectional";
  status: "synced" | "pending" | "conflict" | "error";
  conflictReason?: string;
  errorMessage?: string;
}

export interface ConflictResolution {
  artifactId: string;
  artifactType: ArtifactType;
  conflictId: string;
  resolution: "keep_ide" | "keep_server" | "merge" | "manual";
  resolvedContent?: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export interface SyncEvent {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  direction: "to_ide" | "from_ide";
  content: string;
  checksum: string;
  timestamp: Date;
  userId: string;
  metadata?: any;
}

export interface SyncConflict {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  ideContent: string;
  serverContent: string;
  ideChecksum: string;
  serverChecksum: string;
  conflictType: "content" | "version" | "lock";
  detectedAt: Date;
  status: "pending" | "resolved" | "ignored";
}

/**
 * Bidirectional Sync Service
 * Handles synchronization between IDE and server with conflict resolution
 */
export class BidirectionalSyncService {
  private workflowIntegration: WorkflowIntegrationService;
  private config: SyncConfiguration;
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private syncEvents: SyncEvent[] = [];
  private conflicts: Map<string, SyncConflict> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized: boolean = false;

  constructor(
    workflowIntegration: WorkflowIntegrationService,
    config: SyncConfiguration
  ) {
    this.workflowIntegration = workflowIntegration;
    this.config = config;
  }

  /**
   * Initialize the bidirectional sync service
   */
  async initialize(): Promise<void> {
    const context: ErrorContext = {
      operation: "initializeBidirectionalSync",
      additionalData: { config: this.config }
    };

    try {
      logger.info("Initializing bidirectional sync service", this.config);

      // Validate configuration
      this.validateConfiguration();

      // Start auto-sync if enabled
      if (this.config.enableAutoSync) {
        await this.startAutoSync();
      }

      this.isInitialized = true;
      logger.info("Bidirectional sync service initialized successfully");

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to initialize bidirectional sync", error);
        throw new Error(`Bidirectional sync initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      logger.warn("Bidirectional sync initialized with limited functionality");
      this.isInitialized = true;
    }
  }

  /**
   * Sync artifact from server to IDE
   */
  async syncToIDE(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    content: string,
    userId: string,
    metadata?: any
  ): Promise<SyncStatus> {
    const context: ErrorContext = {
      operation: "syncToIDE",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Bidirectional sync not initialized");
      }

      logger.info("Syncing to IDE", {
        projectId,
        artifactType,
        artifactId,
        userId
      });

      const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
      const checksum = this.calculateChecksum(content);

      // Check for conflicts before syncing
      const conflict = await this.detectConflict(
        projectId,
        artifactType,
        artifactId,
        content,
        checksum,
        "to_ide"
      );

      if (conflict) {
        const status: SyncStatus = {
          artifactId,
          artifactType,
          lastSyncTime: new Date(),
          syncDirection: "to_ide",
          status: "conflict",
          conflictReason: `Conflict detected: ${conflict.conflictType}`
        };
        this.syncStatuses.set(statusKey, status);
        return status;
      }

      // Create sync event
      const syncEvent: SyncEvent = {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        direction: "to_ide",
        content,
        checksum,
        timestamp: new Date(),
        userId,
        metadata
      };

      this.syncEvents.push(syncEvent);

      // Perform the sync through workflow integration
      await this.workflowIntegration.syncToIDE(
        projectId,
        artifactType,
        artifactId,
        content,
        userId
      );

      // Update sync status
      const status: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "to_ide",
        status: "synced"
      };
      this.syncStatuses.set(statusKey, status);

      logger.info("Successfully synced to IDE", { projectId, artifactType, artifactId });
      return status;

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
      const errorStatus: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "to_ide",
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      };
      this.syncStatuses.set(statusKey, errorStatus);

      if (!recoveryResult.success) {
        logger.logError("Failed to sync to IDE", error);
        throw error;
      }

      return errorStatus;
    }
  }

  /**
   * Sync artifact from IDE to server
   */
  async syncFromIDE(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    content: string,
    userId: string,
    metadata?: any
  ): Promise<SyncStatus> {
    const context: ErrorContext = {
      operation: "syncFromIDE",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Bidirectional sync not initialized");
      }

      logger.info("Syncing from IDE", {
        projectId,
        artifactType,
        artifactId,
        userId
      });

      const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
      const checksum = this.calculateChecksum(content);

      // Check for conflicts before syncing
      const conflict = await this.detectConflict(
        projectId,
        artifactType,
        artifactId,
        content,
        checksum,
        "from_ide"
      );

      if (conflict) {
        const status: SyncStatus = {
          artifactId,
          artifactType,
          lastSyncTime: new Date(),
          syncDirection: "from_ide",
          status: "conflict",
          conflictReason: `Conflict detected: ${conflict.conflictType}`
        };
        this.syncStatuses.set(statusKey, status);
        return status;
      }

      // Create sync event
      const syncEvent: SyncEvent = {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        direction: "from_ide",
        content,
        checksum,
        timestamp: new Date(),
        userId,
        metadata
      };

      this.syncEvents.push(syncEvent);

      // Perform the sync through workflow integration
      await this.workflowIntegration.syncFromIDE(
        projectId,
        artifactType,
        artifactId,
        content,
        userId
      );

      // Detect and record the change
      const existingStatus = this.syncStatuses.get(statusKey);
      const oldContent = existingStatus ? undefined : ""; // Would fetch from server in real implementation

      await this.workflowIntegration.detectChange(
        projectId,
        artifactType,
        artifactId,
        existingStatus ? "update" : "create",
        this.inferChangeCategory(artifactType, content),
        oldContent,
        content,
        userId,
        "Synced from IDE",
        metadata
      );

      // Update sync status
      const status: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "from_ide",
        status: "synced"
      };
      this.syncStatuses.set(statusKey, status);

      logger.info("Successfully synced from IDE", { projectId, artifactType, artifactId });
      return status;

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
      const errorStatus: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "from_ide",
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      };
      this.syncStatuses.set(statusKey, errorStatus);

      if (!recoveryResult.success) {
        logger.logError("Failed to sync from IDE", error);
        throw error;
      }

      return errorStatus;
    }
  }

  /**
   * Perform bidirectional sync for an artifact
   */
  async bidirectionalSync(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    ideContent: string,
    serverContent: string,
    userId: string
  ): Promise<{
    status: SyncStatus;
    resolvedContent?: string;
    conflict?: SyncConflict;
  }> {
    const context: ErrorContext = {
      operation: "bidirectionalSync",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Bidirectional sync not initialized");
      }

      logger.info("Performing bidirectional sync", {
        projectId,
        artifactType,
        artifactId,
        userId
      });

      const ideChecksum = this.calculateChecksum(ideContent);
      const serverChecksum = this.calculateChecksum(serverContent);

      // Check if content is identical
      if (ideChecksum === serverChecksum) {
        const status: SyncStatus = {
          artifactId,
          artifactType,
          lastSyncTime: new Date(),
          syncDirection: "bidirectional",
          status: "synced"
        };
        
        const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
        this.syncStatuses.set(statusKey, status);
        
        return { status };
      }

      // Content differs - check for conflicts
      const conflict = await this.createConflict(
        projectId,
        artifactType,
        artifactId,
        ideContent,
        serverContent,
        ideChecksum,
        serverChecksum
      );

      // Attempt automatic resolution based on configuration
      if (this.config.conflictResolution !== "manual") {
        const resolution = await this.resolveConflictAutomatically(conflict, userId);
        if (resolution) {
          const status: SyncStatus = {
            artifactId,
            artifactType,
            lastSyncTime: new Date(),
            syncDirection: "bidirectional",
            status: "synced"
          };
          
          const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
          this.syncStatuses.set(statusKey, status);
          
          return { 
            status, 
            resolvedContent: resolution.resolvedContent 
          };
        }
      }

      // Manual resolution required
      const status: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "bidirectional",
        status: "conflict",
        conflictReason: "Manual resolution required"
      };
      
      const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
      this.syncStatuses.set(statusKey, status);
      
      return { status, conflict };

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      const errorStatus: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "bidirectional",
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      };

      if (!recoveryResult.success) {
        logger.logError("Failed to perform bidirectional sync", error);
        throw error;
      }

      return { status: errorStatus };
    }
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: "keep_ide" | "keep_server" | "merge" | "manual",
    resolvedContent?: string,
    resolvedBy?: string
  ): Promise<ConflictResolution> {
    const context: ErrorContext = {
      operation: "resolveConflict",
      userId: resolvedBy,
      additionalData: { conflictId, resolution }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Bidirectional sync not initialized");
      }

      const conflict = this.conflicts.get(conflictId);
      if (!conflict) {
        throw new Error(`Conflict not found: ${conflictId}`);
      }

      logger.info("Resolving sync conflict", {
        conflictId,
        resolution,
        artifactType: conflict.artifactType,
        artifactId: conflict.artifactId
      });

      let finalContent: string;

      switch (resolution) {
        case "keep_ide":
          finalContent = conflict.ideContent;
          break;
        case "keep_server":
          finalContent = conflict.serverContent;
          break;
        case "merge":
          finalContent = this.mergeContent(conflict.ideContent, conflict.serverContent);
          break;
        case "manual":
          if (!resolvedContent) {
            throw new Error("Resolved content is required for manual resolution");
          }
          finalContent = resolvedContent;
          break;
        default:
          throw new Error(`Invalid resolution strategy: ${resolution}`);
      }

      // Create resolution record
      const conflictResolution: ConflictResolution = {
        artifactId: conflict.artifactId,
        artifactType: conflict.artifactType,
        conflictId,
        resolution,
        resolvedContent: finalContent,
        resolvedBy: resolvedBy || "system",
        resolvedAt: new Date()
      };

      // Update conflict status
      conflict.status = "resolved";
      this.conflicts.set(conflictId, conflict);

      // Update sync status
      const statusKey = this.getStatusKey(
        conflict.projectId,
        conflict.artifactType,
        conflict.artifactId
      );
      
      const status: SyncStatus = {
        artifactId: conflict.artifactId,
        artifactType: conflict.artifactType,
        lastSyncTime: new Date(),
        syncDirection: "bidirectional",
        status: "synced"
      };
      this.syncStatuses.set(statusKey, status);

      logger.info("Conflict resolved successfully", {
        conflictId,
        resolution,
        resolvedBy: conflictResolution.resolvedBy
      });

      return conflictResolution;

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to resolve conflict", error);
        throw error;
      }

      // Return a fallback resolution
      const conflict = this.conflicts.get(conflictId);
      return {
        artifactId: conflict?.artifactId || "unknown",
        artifactType: conflict?.artifactType || "code",
        conflictId,
        resolution: "keep_server",
        resolvedContent: conflict?.serverContent,
        resolvedBy: resolvedBy || "system",
        resolvedAt: new Date()
      };
    }
  }

  /**
   * Get sync status for an artifact
   */
  getSyncStatus(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string
  ): SyncStatus | undefined {
    const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
    return this.syncStatuses.get(statusKey);
  }

  /**
   * Get all sync statuses for a project
   */
  getProjectSyncStatuses(_projectId: string): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  /**
   * Get pending conflicts for a project
   */
  getPendingConflicts(projectId: string): SyncConflict[] {
    return Array.from(this.conflicts.values())
      .filter(conflict => 
        conflict.projectId === projectId && 
        conflict.status === "pending"
      );
  }

  /**
   * Get sync events for a project
   */
  getSyncEvents(projectId: string, limit: number = 100): SyncEvent[] {
    return this.syncEvents
      .filter(event => event.projectId === projectId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Stop the bidirectional sync service
   */
  async stop(): Promise<void> {
    logger.info("Stopping bidirectional sync service");

    // Clear all sync intervals
    for (const [, interval] of this.syncIntervals) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();

    this.isInitialized = false;
    logger.info("Bidirectional sync service stopped");
  }

  // Private helper methods

  private validateConfiguration(): void {
    if (this.config.syncInterval <= 0) {
      throw new Error("Sync interval must be greater than 0");
    }

    if (this.config.maxSyncRetries < 0) {
      throw new Error("Max sync retries must be non-negative");
    }

    if (!["manual", "auto_merge", "last_writer_wins"].includes(this.config.conflictResolution)) {
      throw new Error("Invalid conflict resolution strategy");
    }
  }

  private async startAutoSync(): Promise<void> {
    logger.info("Starting auto-sync", { interval: this.config.syncInterval });
    
    // Implementation would set up periodic sync checks
    // For now, just log that it's enabled
  }

  private getStatusKey(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string
  ): string {
    return `${projectId}:${artifactType}:${artifactId}`;
  }

  private calculateChecksum(content: string): string {
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private async detectConflict(
    _projectId: string,
    _artifactType: ArtifactType,
    _artifactId: string,
    _content: string,
    _checksum: string,
    _direction: "to_ide" | "from_ide"
  ): Promise<SyncConflict | null> {
    // Implementation would check for actual conflicts
    // For now, return null (no conflicts)
    return null;
  }

  private async createConflict(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    ideContent: string,
    serverContent: string,
    ideChecksum: string,
    serverChecksum: string
  ): Promise<SyncConflict> {
    const conflict: SyncConflict = {
      id: this.generateId(),
      projectId,
      artifactType,
      artifactId,
      ideContent,
      serverContent,
      ideChecksum,
      serverChecksum,
      conflictType: "content",
      detectedAt: new Date(),
      status: "pending"
    };

    this.conflicts.set(conflict.id, conflict);
    return conflict;
  }

  private async resolveConflictAutomatically(
    conflict: SyncConflict,
    _userId: string
  ): Promise<ConflictResolution | null> {
    switch (this.config.conflictResolution) {
      case "auto_merge":
        const mergedContent = this.mergeContent(conflict.ideContent, conflict.serverContent);
        return {
          artifactId: conflict.artifactId,
          artifactType: conflict.artifactType,
          conflictId: conflict.id,
          resolution: "merge",
          resolvedContent: mergedContent,
          resolvedBy: "auto_merge",
          resolvedAt: new Date()
        };

      case "last_writer_wins":
        // In a real implementation, would check timestamps
        return {
          artifactId: conflict.artifactId,
          artifactType: conflict.artifactType,
          conflictId: conflict.id,
          resolution: "keep_ide",
          resolvedContent: conflict.ideContent,
          resolvedBy: "last_writer_wins",
          resolvedAt: new Date()
        };

      default:
        return null;
    }
  }

  private mergeContent(ideContent: string, serverContent: string): string {
    // Simple merge implementation - in practice would use proper diff/merge algorithms
    const ideLines = ideContent.split("\n");
    const serverLines = serverContent.split("\n");
    
    // Simple line-by-line merge
    const merged: string[] = [];
    const maxLines = Math.max(ideLines.length, serverLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const ideLine = ideLines[i] || "";
      const serverLine = serverLines[i] || "";
      
      if (ideLine === serverLine) {
        merged.push(ideLine);
      } else if (ideLine && serverLine) {
        merged.push(`<<<<<<< IDE`);
        merged.push(ideLine);
        merged.push("=======");
        merged.push(serverLine);
        merged.push(">>>>>>> SERVER");
      } else {
        merged.push(ideLine || serverLine);
      }
    }
    
    return merged.join("\n");
  }

  private inferChangeCategory(
    artifactType: ArtifactType,
    content: string
  ): ChangeCategory {
    // Simple heuristics to infer change category
    if (content.includes("BREAKING") || content.includes("breaking")) {
      return "breaking";
    }
    if (content.includes("TODO") || content.includes("FIXME")) {
      return "fix";
    }
    if (content.includes("feat") || content.includes("feature")) {
      return "feature";
    }
    if (content.includes("refactor")) {
      return "refactor";
    }
    if (content.includes("doc") || artifactType === "requirements") {
      return "docs";
    }
    
    return "feature"; // Default
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}