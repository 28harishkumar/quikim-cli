/**
 * Quikim - Enhanced Bidirectional Sync Service
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { createHash } from "crypto";
import { diff_match_patch } from "diff-match-patch";
import { watch, FSWatcher } from "chokidar";
import { join } from "path";
import { readFile, writeFile, mkdir, access, readdir } from "fs/promises";
import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { WorkflowIntegrationService, ArtifactType, ChangeCategory } from './workflow-integration.js';

export interface SyncConfiguration {
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  conflictResolution: "manual" | "auto_merge" | "last_writer_wins" | "three_way_merge";
  enableVersioning: boolean;
  maxSyncRetries: number;
  enableFileWatchers: boolean;
  projectPath?: string; // Path to project root for file watching
}

export interface SyncStatus {
  artifactId: string;
  artifactType: ArtifactType;
  lastSyncTime: Date;
  syncDirection: "to_ide" | "from_ide" | "bidirectional";
  status: "synced" | "pending" | "conflict" | "error";
  conflictReason?: string;
  errorMessage?: string;
  version?: number;
  vectorClock?: VectorClock;
}

export interface VectorClock {
  [userId: string]: number;
}

export interface SyncState {
  lastSyncChecksum: string;
  lastSyncTime: Date;
  version: number;
  vectorClock: VectorClock;
  baseContent?: string; // For three-way merge
  baseChecksum?: string;
}

export interface ConflictResolution {
  artifactId: string;
  artifactType: ArtifactType;
  conflictId: string;
  resolution: "keep_ide" | "keep_server" | "merge" | "manual" | "three_way";
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
  metadata?: Record<string, unknown>;
  vectorClock?: VectorClock;
}

export interface SyncConflict {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  ideContent: string;
  serverContent: string;
  baseContent?: string; // For three-way merge
  ideChecksum: string;
  serverChecksum: string;
  baseChecksum?: string;
  ideVectorClock: VectorClock;
  serverVectorClock: VectorClock;
  conflictType: "content" | "version" | "lock" | "concurrent";
  detectedAt: Date;
  status: "pending" | "resolved" | "ignored";
}

/**
 * Enhanced Bidirectional Sync Service
 * Handles synchronization between IDE and server with advanced conflict resolution
 */
export class BidirectionalSyncService {
  private workflowIntegration: WorkflowIntegrationService;
  private config: SyncConfiguration;
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private syncEvents: SyncEvent[] = [];
  private conflicts: Map<string, SyncConflict> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private fileWatchers: Map<string, FSWatcher> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private dmp = new diff_match_patch();
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
      logger.info("Initializing enhanced bidirectional sync service", this.config);

      // Validate configuration
      this.validateConfiguration();

      // Load persisted sync states
      if (this.config.projectPath) {
        await this.loadSyncStates();
      }

      // Start file watchers if enabled
      if (this.config.enableFileWatchers && this.config.projectPath) {
        await this.startFileWatchers();
      }

      // Start auto-sync if enabled
      if (this.config.enableAutoSync) {
        await this.startAutoSync();
      }

      this.isInitialized = true;
      logger.info("Enhanced bidirectional sync service initialized successfully");

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
    metadata?: Record<string, unknown>
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
      const vectorClock = this.updateVectorClock(statusKey, userId);

      // Load sync state for three-way merge
      const syncState = this.syncStates.get(statusKey);
      
      // Check for conflicts before syncing
      const conflict = await this.detectConflictWithVectorClock(
        projectId,
        artifactType,
        artifactId,
        content,
        checksum,
        vectorClock,
        "to_ide",
        syncState
      );

      if (conflict) {
        const status: SyncStatus = {
          artifactId,
          artifactType,
          lastSyncTime: new Date(),
          syncDirection: "to_ide",
          status: "conflict",
          conflictReason: `Conflict detected: ${conflict.conflictType}`,
          vectorClock
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
        metadata,
        vectorClock
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

      // Update sync state
      await this.updateSyncState(statusKey, {
        lastSyncChecksum: checksum,
        lastSyncTime: new Date(),
        version: (syncState?.version || 0) + 1,
        vectorClock,
        baseContent: syncState?.baseContent || content,
        baseChecksum: syncState?.baseChecksum || checksum
      });

      // Update sync status
      const status: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "to_ide",
        status: "synced",
        version: syncState ? (syncState.version + 1) : 1,
        vectorClock
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
    metadata?: Record<string, unknown>
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
      const vectorClock = this.updateVectorClock(statusKey, userId);

      // Load sync state
      const syncState = this.syncStates.get(statusKey);

      // Check for conflicts before syncing
      const conflict = await this.detectConflictWithVectorClock(
        projectId,
        artifactType,
        artifactId,
        content,
        checksum,
        vectorClock,
        "from_ide",
        syncState
      );

      if (conflict) {
        const status: SyncStatus = {
          artifactId,
          artifactType,
          lastSyncTime: new Date(),
          syncDirection: "from_ide",
          status: "conflict",
          conflictReason: `Conflict detected: ${conflict.conflictType}`,
          vectorClock
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
        metadata,
        vectorClock
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
      const oldContent = syncState?.baseContent || "";

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

      // Update sync state
      await this.updateSyncState(statusKey, {
        lastSyncChecksum: checksum,
        lastSyncTime: new Date(),
        version: (syncState?.version || 0) + 1,
        vectorClock,
        baseContent: syncState?.baseContent || content,
        baseChecksum: syncState?.baseChecksum || checksum
      });

      // Update sync status
      const status: SyncStatus = {
        artifactId,
        artifactType,
        lastSyncTime: new Date(),
        syncDirection: "from_ide",
        status: "synced",
        version: syncState ? (syncState.version + 1) : 1,
        vectorClock
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
   * Perform bidirectional sync for an artifact with three-way merge support
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

      const statusKey = this.getStatusKey(projectId, artifactType, artifactId);
      const ideChecksum = this.calculateChecksum(ideContent);
      const serverChecksum = this.calculateChecksum(serverContent);
      const ideVectorClock = this.updateVectorClock(statusKey, userId);
      const serverVectorClock = this.updateVectorClock(statusKey, "server");

      // Check if content is identical
      if (ideChecksum === serverChecksum) {
        const status: SyncStatus = {
          artifactId,
          artifactType,
          lastSyncTime: new Date(),
          syncDirection: "bidirectional",
          status: "synced",
          vectorClock: ideVectorClock
        };
        
        this.syncStatuses.set(statusKey, status);
        return { status };
      }

      // Load sync state for three-way merge
      const syncState = this.syncStates.get(statusKey);
      const baseContent = syncState?.baseContent;
      const baseChecksum = syncState?.baseChecksum;

      // Check for concurrent modifications using vector clocks
      const isConcurrent = this.isConcurrentModification(
        ideVectorClock,
        serverVectorClock
      );

      // Create conflict
      const conflict = await this.createConflict(
        projectId,
        artifactType,
        artifactId,
        ideContent,
        serverContent,
        ideChecksum,
        serverChecksum,
        ideVectorClock,
        serverVectorClock,
        baseContent,
        baseChecksum,
        isConcurrent
      );

      // Attempt automatic resolution based on configuration
      if (this.config.conflictResolution !== "manual") {
        const resolution = await this.resolveConflictAutomatically(
          conflict,
          userId,
          baseContent
        );
        if (resolution) {
          // Update sync state with merged content
          await this.updateSyncState(statusKey, {
            lastSyncChecksum: this.calculateChecksum(resolution.resolvedContent || ""),
            lastSyncTime: new Date(),
            version: (syncState?.version || 0) + 1,
            vectorClock: this.mergeVectorClocks(ideVectorClock, serverVectorClock),
            baseContent: resolution.resolvedContent,
            baseChecksum: this.calculateChecksum(resolution.resolvedContent || "")
          });

          const status: SyncStatus = {
            artifactId,
            artifactType,
            lastSyncTime: new Date(),
            syncDirection: "bidirectional",
            status: "synced",
            version: syncState ? (syncState.version + 1) : 1,
            vectorClock: this.mergeVectorClocks(ideVectorClock, serverVectorClock)
          };
          
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
        conflictReason: "Manual resolution required",
        vectorClock: this.mergeVectorClocks(ideVectorClock, serverVectorClock)
      };
      
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
    resolution: "keep_ide" | "keep_server" | "merge" | "manual" | "three_way",
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
        case "three_way":
          if (!conflict.baseContent) {
            throw new Error("Base content required for three-way merge");
          }
          finalContent = this.threeWayMerge(
            conflict.baseContent,
            conflict.ideContent,
            conflict.serverContent
          );
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

      // Update sync state
      const statusKey = this.getStatusKey(
        conflict.projectId,
        conflict.artifactType,
        conflict.artifactId
      );

      await this.updateSyncState(statusKey, {
        lastSyncChecksum: this.calculateChecksum(finalContent),
        lastSyncTime: new Date(),
        version: (this.syncStates.get(statusKey)?.version || 0) + 1,
        vectorClock: this.mergeVectorClocks(
          conflict.ideVectorClock,
          conflict.serverVectorClock
        ),
        baseContent: finalContent,
        baseChecksum: this.calculateChecksum(finalContent)
      });
      
      const status: SyncStatus = {
        artifactId: conflict.artifactId,
        artifactType: conflict.artifactType,
        lastSyncTime: new Date(),
        syncDirection: "bidirectional",
        status: "synced",
        version: (this.syncStates.get(statusKey)?.version || 0) + 1,
        vectorClock: this.mergeVectorClocks(
          conflict.ideVectorClock,
          conflict.serverVectorClock
        )
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

    // Close all file watchers
    for (const [, watcher] of this.fileWatchers) {
      await watcher.close();
    }
    this.fileWatchers.clear();

    // Persist sync states
    if (this.config.projectPath) {
      await this.persistSyncStates();
    }

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

    const validResolutions = ["manual", "auto_merge", "last_writer_wins", "three_way_merge"];
    if (!validResolutions.includes(this.config.conflictResolution)) {
      throw new Error(`Invalid conflict resolution strategy. Must be one of: ${validResolutions.join(", ")}`);
    }
  }

  private async startAutoSync(): Promise<void> {
    logger.info("Starting auto-sync", { interval: this.config.syncInterval });
    
    // Implementation would set up periodic sync checks
    // For now, just log that it's enabled
  }

  private async startFileWatchers(): Promise<void> {
    if (!this.config.projectPath) {
      return;
    }

    const quikimDir = join(this.config.projectPath, ".quikim");
    
    try {
      await access(quikimDir);
    } catch {
      // Directory doesn't exist yet, will be created when needed
      return;
    }

    logger.info("Starting file watchers", { path: quikimDir });

    const watcher = watch(quikimDir, {
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
    });

    watcher.on("change", async (path) => {
      logger.info("File change detected", { path });
      // Handle file change - would trigger sync
      // This is a placeholder for actual implementation
    });

    this.fileWatchers.set(quikimDir, watcher);
  }

  private getStatusKey(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string
  ): string {
    return `${projectId}:${artifactType}:${artifactId}`;
  }

  /**
   * Calculate SHA-256 checksum for content
   */
  private calculateChecksum(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Update vector clock for a user
   */
  private updateVectorClock(statusKey: string, userId: string): VectorClock {
    const syncState = this.syncStates.get(statusKey);
    const vectorClock = syncState?.vectorClock || {};
    
    vectorClock[userId] = (vectorClock[userId] || 0) + 1;
    return { ...vectorClock };
  }

  /**
   * Check if two vector clocks indicate concurrent modifications
   */
  private isConcurrentModification(
    clock1: VectorClock,
    clock2: VectorClock
  ): boolean {
    const allUsers = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    
    let clock1HappenedBefore = true;
    let clock2HappenedBefore = true;

    for (const user of allUsers) {
      const v1 = clock1[user] || 0;
      const v2 = clock2[user] || 0;

      if (v1 > v2) {
        clock2HappenedBefore = false;
      }
      if (v2 > v1) {
        clock1HappenedBefore = false;
      }
    }

    // If neither happened before the other, they're concurrent
    return !clock1HappenedBefore && !clock2HappenedBefore;
  }

  /**
   * Merge two vector clocks (take maximum for each user)
   */
  private mergeVectorClocks(
    clock1: VectorClock,
    clock2: VectorClock
  ): VectorClock {
    const merged: VectorClock = {};
    const allUsers = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const user of allUsers) {
      merged[user] = Math.max(clock1[user] || 0, clock2[user] || 0);
    }

    return merged;
  }

  private async detectConflictWithVectorClock(
    _projectId: string,
    _artifactType: ArtifactType,
    _artifactId: string,
    _content: string,
    checksum: string,
    vectorClock: VectorClock,
    _direction: "to_ide" | "from_ide",
    syncState?: SyncState
  ): Promise<SyncConflict | null> {
    // Check if content has changed since last sync
    if (syncState && syncState.lastSyncChecksum === checksum) {
      return null; // No change, no conflict
    }

    // Check for concurrent modifications using vector clocks
    if (syncState?.vectorClock) {
      const isConcurrent = this.isConcurrentModification(
        vectorClock,
        syncState.vectorClock
      );

      if (isConcurrent) {
        // Would need to fetch server content to create full conflict
        // For now, return null and let bidirectionalSync handle it
        return null;
      }
    }

    return null;
  }

  private async createConflict(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    ideContent: string,
    serverContent: string,
    ideChecksum: string,
    serverChecksum: string,
    ideVectorClock: VectorClock,
    serverVectorClock: VectorClock,
    baseContent?: string,
    baseChecksum?: string,
    isConcurrent?: boolean
  ): Promise<SyncConflict> {
    const conflict: SyncConflict = {
      id: this.generateId(),
      projectId,
      artifactType,
      artifactId,
      ideContent,
      serverContent,
      baseContent,
      ideChecksum,
      serverChecksum,
      baseChecksum,
      ideVectorClock,
      serverVectorClock,
      conflictType: isConcurrent ? "concurrent" : "content",
      detectedAt: new Date(),
      status: "pending"
    };

    this.conflicts.set(conflict.id, conflict);
    return conflict;
  }

  private async resolveConflictAutomatically(
    conflict: SyncConflict,
    _userId: string,
    baseContent?: string
  ): Promise<ConflictResolution | null> {
    switch (this.config.conflictResolution) {
      case "auto_merge":
        const mergedContent = this.mergeContent(
          conflict.ideContent,
          conflict.serverContent
        );
        return {
          artifactId: conflict.artifactId,
          artifactType: conflict.artifactType,
          conflictId: conflict.id,
          resolution: "merge",
          resolvedContent: mergedContent,
          resolvedBy: "auto_merge",
          resolvedAt: new Date()
        };

      case "three_way_merge":
        if (baseContent || conflict.baseContent) {
          const threeWayMerged = this.threeWayMerge(
            baseContent || conflict.baseContent || "",
            conflict.ideContent,
            conflict.serverContent
          );
          return {
            artifactId: conflict.artifactId,
            artifactType: conflict.artifactType,
            conflictId: conflict.id,
            resolution: "three_way",
            resolvedContent: threeWayMerged,
            resolvedBy: "three_way_merge",
            resolvedAt: new Date()
          };
        }
        // Fallback to regular merge if no base
        const fallbackMerged = this.mergeContent(
          conflict.ideContent,
          conflict.serverContent
        );
        return {
          artifactId: conflict.artifactId,
          artifactType: conflict.artifactType,
          conflictId: conflict.id,
          resolution: "merge",
          resolvedContent: fallbackMerged,
          resolvedBy: "auto_merge",
          resolvedAt: new Date()
        };

      case "last_writer_wins":
        // Compare timestamps from vector clocks (simplified - use server as default)
        return {
          artifactId: conflict.artifactId,
          artifactType: conflict.artifactType,
          conflictId: conflict.id,
          resolution: "keep_server",
          resolvedContent: conflict.serverContent,
          resolvedBy: "last_writer_wins",
          resolvedAt: new Date()
        };

      default:
        return null;
    }
  }

  /**
   * Merge content using diff-match-patch
   */
  private mergeContent(ideContent: string, serverContent: string): string {
    const diffs = this.dmp.diff_main(ideContent, serverContent);
    this.dmp.diff_cleanupSemantic(diffs);

    // Try to create patches and apply them
    const patches = this.dmp.patch_make(ideContent, diffs);
    const [mergedText, results] = this.dmp.patch_apply(patches, ideContent);

    // If merge failed, return conflict markers
    if (results.some((r: boolean) => !r)) {
      return this.createConflictMarkers(ideContent, serverContent);
    }

    return mergedText;
  }

  /**
   * Three-way merge using base, local, and remote
   */
  private threeWayMerge(
    baseContent: string,
    localContent: string,
    remoteContent: string
  ): string {
    // Calculate diffs from base to local and remote
    const localDiffs = this.dmp.diff_main(baseContent, localContent);
    const remoteDiffs = this.dmp.diff_main(baseContent, remoteContent);

    this.dmp.diff_cleanupSemantic(localDiffs);
    this.dmp.diff_cleanupSemantic(remoteDiffs);

    // Create patches
    const localPatches = this.dmp.patch_make(baseContent, localDiffs);
    const remotePatches = this.dmp.patch_make(baseContent, remoteDiffs);

    // Apply local patches first
    const [afterLocal, localResults] = this.dmp.patch_apply(localPatches, baseContent);
    if (localResults.some((r: boolean) => !r)) {
      // Local patch failed, fallback to conflict markers
      return this.createConflictMarkers(localContent, remoteContent);
    }

    // Apply remote patches to the result
    const [finalContent, remoteResults] = this.dmp.patch_apply(remotePatches, afterLocal);
    if (remoteResults.some((r: boolean) => !r)) {
      // Remote patch failed, fallback to conflict markers
      return this.createConflictMarkers(localContent, remoteContent);
    }

    return finalContent;
  }

  /**
   * Create conflict markers for manual resolution
   */
  private createConflictMarkers(localContent: string, remoteContent: string): string {
    return `<<<<<<< IDE
${localContent}
=======
${remoteContent}
>>>>>>> SERVER
`;
  }

  private inferChangeCategory(
    artifactType: ArtifactType,
    content: string
  ): ChangeCategory {
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
    
    return "feature";
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Update sync state and persist it
   */
  private async updateSyncState(
    statusKey: string,
    state: SyncState
  ): Promise<void> {
    this.syncStates.set(statusKey, state);

    if (this.config.projectPath) {
      await this.persistSyncState(statusKey, state);
    }
  }

  /**
   * Persist a single sync state to disk
   */
  private async persistSyncState(
    statusKey: string,
    state: SyncState
  ): Promise<void> {
    if (!this.config.projectPath) {
      return;
    }

    const syncStateDir = join(this.config.projectPath, ".quikim", ".sync-state");
    await mkdir(syncStateDir, { recursive: true });

    const stateFile = join(syncStateDir, `${statusKey.replace(/:/g, "_")}.json`);
    await writeFile(stateFile, JSON.stringify(state, null, 2), "utf-8");
  }

  /**
   * Load sync state from disk
   */
  private async loadSyncState(statusKey: string): Promise<SyncState | null> {
    if (!this.config.projectPath) {
      return null;
    }

    const syncStateDir = join(this.config.projectPath, ".quikim", ".sync-state");
    const stateFile = join(syncStateDir, `${statusKey.replace(/:/g, "_")}.json`);

    try {
      const content = await readFile(stateFile, "utf-8");
      const state = JSON.parse(content) as SyncState;
      
      // Convert date strings back to Date objects
      state.lastSyncTime = new Date(state.lastSyncTime);
      
      return state;
    } catch {
      return null;
    }
  }

  /**
   * Load all sync states from disk
   */
  private async loadSyncStates(): Promise<void> {
    if (!this.config.projectPath) {
      return;
    }

    const syncStateDir = join(this.config.projectPath, ".quikim", ".sync-state");

    try {
      const files = await readdir(syncStateDir);
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          const statusKey = file.replace(".json", "").replace(/_/g, ":");
          const state = await this.loadSyncState(statusKey);
          if (state) {
            this.syncStates.set(statusKey, state);
          }
        }
      }
    } catch {
      // Directory doesn't exist yet, that's fine
    }
  }

  /**
   * Persist all sync states to disk
   */
  private async persistSyncStates(): Promise<void> {
    for (const [statusKey, state] of this.syncStates) {
      await this.persistSyncState(statusKey, state);
    }
  }
}
