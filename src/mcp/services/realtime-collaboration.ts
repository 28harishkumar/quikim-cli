/**
 * Quikim - Real-time Collaboration Service
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { WorkflowIntegrationService, ArtifactType } from './workflow-integration.js';

export interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  status: "online" | "away" | "offline";
  lastSeen: Date;
  currentProject?: string;
  currentArtifact?: {
    type: ArtifactType;
    id: string;
  };
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  participants: CollaborationUser[];
  owner: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  metadata?: any;
}

export interface CollaborationEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: CollaborationEventType;
  timestamp: Date;
  data?: any;
  metadata?: any;
}

export type CollaborationEventType =
  | "user_joined"
  | "user_left"
  | "cursor_moved"
  | "text_changed"
  | "selection_changed"
  | "artifact_locked"
  | "artifact_unlocked"
  | "comment_added"
  | "comment_resolved"
  | "presence_updated";

export interface CursorPosition {
  userId: string;
  line: number;
  column: number;
  artifactType: ArtifactType;
  artifactId: string;
  timestamp: Date;
}

export interface TextChange {
  userId: string;
  artifactType: ArtifactType;
  artifactId: string;
  operation: "insert" | "delete" | "replace";
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  content: string;
  timestamp: Date;
}

export interface Comment {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  userId: string;
  userName: string;
  content: string;
  position?: {
    line: number;
    column: number;
  };
  status: "open" | "resolved" | "archived";
  createdAt: Date;
  updatedAt: Date;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  status: "online" | "away" | "offline";
  currentActivity?: string;
  lastSeen: Date;
  metadata?: any;
}

export interface CollaborationConfig {
  maxParticipants: number;
  sessionTimeout: number; // milliseconds
  enableCursorSharing: boolean;
  enableRealTimeEditing: boolean;
  enableComments: boolean;
  enablePresenceIndicators: boolean;
  conflictResolution: "operational_transform" | "last_writer_wins" | "manual";
}

/**
 * Real-time Collaboration Service
 * Handles real-time collaboration features for the MCP server
 */
export class RealTimeCollaborationService {
  private config: CollaborationConfig;
  private sessions: Map<string, CollaborationSession> = new Map();
  private users: Map<string, CollaborationUser> = new Map();
  private events: CollaborationEvent[] = [];
  private cursors: Map<string, CursorPosition> = new Map();
  private comments: Map<string, Comment> = new Map();
  private presence: Map<string, PresenceInfo> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized: boolean = false;

  constructor(
    _workflowIntegration: WorkflowIntegrationService,
    config: CollaborationConfig
  ) {
    this.config = config;
  }

  /**
   * Initialize the real-time collaboration service
   */
  async initialize(): Promise<void> {
    const context: ErrorContext = {
      operation: "initializeRealTimeCollaboration",
      additionalData: { config: this.config }
    };

    try {
      logger.info("Initializing real-time collaboration service", this.config);

      // Validate configuration
      this.validateConfiguration();

      // Start cleanup intervals
      this.startCleanupIntervals();

      this.isInitialized = true;
      logger.info("Real-time collaboration service initialized successfully");

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to initialize real-time collaboration", error);
        throw new Error(`Real-time collaboration initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      logger.warn("Real-time collaboration initialized with limited functionality");
      this.isInitialized = true;
    }
  }

  /**
   * Create or join a collaboration session
   */
  async joinSession(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    user: CollaborationUser
  ): Promise<CollaborationSession> {
    const context: ErrorContext = {
      operation: "joinSession",
      userId: user.id,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Real-time collaboration not initialized");
      }

      logger.info("User joining collaboration session", {
        projectId,
        artifactType,
        artifactId,
        userId: user.id,
        userName: user.name
      });

      const sessionKey = this.getSessionKey(projectId, artifactType, artifactId);
      let session = this.sessions.get(sessionKey);

      if (!session) {
        // Create new session
        session = {
          id: this.generateId(),
          projectId,
          artifactType,
          artifactId,
          participants: [],
          owner: user.id,
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true
        };
        this.sessions.set(sessionKey, session);
      }

      // Check participant limit
      if (session.participants.length >= this.config.maxParticipants) {
        throw new Error(`Session is full (max ${this.config.maxParticipants} participants)`);
      }

      // Add user to session if not already present
      const existingParticipant = session.participants.find(p => p.id === user.id);
      if (!existingParticipant) {
        session.participants.push(user);
        session.lastActivity = new Date();

        // Update user info
        user.currentProject = projectId;
        user.currentArtifact = { type: artifactType, id: artifactId };
        user.status = "online";
        user.lastSeen = new Date();
        this.users.set(user.id, user);

        // Update presence
        this.updatePresence(user.id, {
          userId: user.id,
          userName: user.name,
          status: "online",
          currentActivity: `Editing ${artifactType}: ${artifactId}`,
          lastSeen: new Date()
        });

        // Broadcast join event
        await this.broadcastEvent(session.id, {
          id: this.generateId(),
          sessionId: session.id,
          userId: user.id,
          eventType: "user_joined",
          timestamp: new Date(),
          data: { user }
        });

        // Set session timeout
        this.setSessionTimeout(session);
      }

      logger.info("User joined collaboration session successfully", {
        sessionId: session.id,
        userId: user.id,
        participantCount: session.participants.length
      });

      return session;

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to join collaboration session", error);
        throw error;
      }

      // Return a fallback session
      return {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        participants: [user],
        owner: user.id,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      };
    }
  }

  /**
   * Leave a collaboration session
   */
  async leaveSession(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    userId: string
  ): Promise<void> {
    const context: ErrorContext = {
      operation: "leaveSession",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Real-time collaboration not initialized");
      }

      logger.info("User leaving collaboration session", {
        projectId,
        artifactType,
        artifactId,
        userId
      });

      const sessionKey = this.getSessionKey(projectId, artifactType, artifactId);
      const session = this.sessions.get(sessionKey);

      if (!session) {
        logger.warn("Session not found for leave operation", { sessionKey });
        return;
      }

      // Remove user from session
      session.participants = session.participants.filter(p => p.id !== userId);
      session.lastActivity = new Date();

      // Update user status
      const user = this.users.get(userId);
      if (user) {
        user.status = "offline";
        user.lastSeen = new Date();
        user.currentProject = undefined;
        user.currentArtifact = undefined;
        this.users.set(userId, user);
      }

      // Update presence
      this.updatePresence(userId, {
        userId,
        userName: user?.name || "Unknown",
        status: "offline",
        lastSeen: new Date()
      });

      // Remove cursor position
      const cursorKey = this.getCursorKey(userId, artifactType, artifactId);
      this.cursors.delete(cursorKey);

      // Broadcast leave event
      await this.broadcastEvent(session.id, {
        id: this.generateId(),
        sessionId: session.id,
        userId,
        eventType: "user_left",
        timestamp: new Date(),
        data: { userId }
      });

      // Clean up session if empty
      if (session.participants.length === 0) {
        session.isActive = false;
        this.sessions.delete(sessionKey);
        
        // Clear session timeout
        const timeout = this.sessionTimeouts.get(session.id);
        if (timeout) {
          clearTimeout(timeout);
          this.sessionTimeouts.delete(session.id);
        }
      }

      logger.info("User left collaboration session successfully", {
        sessionId: session.id,
        userId,
        remainingParticipants: session.participants.length
      });

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to leave collaboration session", error);
        throw error;
      }
    }
  }

  /**
   * Update cursor position
   */
  async updateCursor(
    userId: string,
    artifactType: ArtifactType,
    artifactId: string,
    line: number,
    column: number
  ): Promise<void> {
    const context: ErrorContext = {
      operation: "updateCursor",
      userId,
      additionalData: { artifactType, artifactId, line, column }
    };

    try {
      if (!this.isInitialized || !this.config.enableCursorSharing) {
        return;
      }

      const cursorKey = this.getCursorKey(userId, artifactType, artifactId);
      const cursor: CursorPosition = {
        userId,
        line,
        column,
        artifactType,
        artifactId,
        timestamp: new Date()
      };

      this.cursors.set(cursorKey, cursor);

      // Find relevant session and broadcast
      const session = this.findSessionByArtifact(artifactType, artifactId);
      if (session && session.participants.some(p => p.id === userId)) {
        await this.broadcastEvent(session.id, {
          id: this.generateId(),
          sessionId: session.id,
          userId,
          eventType: "cursor_moved",
          timestamp: new Date(),
          data: { cursor }
        });
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to update cursor position", error);
      }
    }
  }

  /**
   * Handle text change
   */
  async handleTextChange(
    userId: string,
    artifactType: ArtifactType,
    artifactId: string,
    change: Omit<TextChange, "userId" | "artifactType" | "artifactId" | "timestamp">
  ): Promise<void> {
    const context: ErrorContext = {
      operation: "handleTextChange",
      userId,
      additionalData: { artifactType, artifactId, operation: change.operation }
    };

    try {
      if (!this.isInitialized || !this.config.enableRealTimeEditing) {
        return;
      }

      const textChange: TextChange = {
        userId,
        artifactType,
        artifactId,
        timestamp: new Date(),
        ...change
      };

      // Find relevant session and broadcast
      const session = this.findSessionByArtifact(artifactType, artifactId);
      if (session && session.participants.some(p => p.id === userId)) {
        await this.broadcastEvent(session.id, {
          id: this.generateId(),
          sessionId: session.id,
          userId,
          eventType: "text_changed",
          timestamp: new Date(),
          data: { change: textChange }
        });

        // Update session activity
        session.lastActivity = new Date();
      }

      logger.debug("Text change handled", {
        userId,
        artifactType,
        artifactId,
        operation: change.operation
      });

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to handle text change", error);
      }
    }
  }

  /**
   * Add a comment
   */
  async addComment(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string,
    userId: string,
    userName: string,
    content: string,
    position?: { line: number; column: number }
  ): Promise<Comment> {
    const context: ErrorContext = {
      operation: "addComment",
      userId,
      additionalData: { projectId, artifactType, artifactId }
    };

    try {
      if (!this.isInitialized || !this.config.enableComments) {
        throw new Error("Comments are not enabled");
      }

      logger.info("Adding comment", {
        projectId,
        artifactType,
        artifactId,
        userId,
        position
      });

      const comment: Comment = {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        userId,
        userName,
        content,
        position,
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
        replies: []
      };

      this.comments.set(comment.id, comment);

      // Find relevant session and broadcast
      const session = this.findSessionByArtifact(artifactType, artifactId);
      if (session) {
        await this.broadcastEvent(session.id, {
          id: this.generateId(),
          sessionId: session.id,
          userId,
          eventType: "comment_added",
          timestamp: new Date(),
          data: { comment }
        });
      }

      logger.info("Comment added successfully", {
        commentId: comment.id,
        userId,
        artifactType,
        artifactId
      });

      return comment;

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to add comment", error);
        throw error;
      }

      // Return a fallback comment
      return {
        id: this.generateId(),
        projectId,
        artifactType,
        artifactId,
        userId,
        userName,
        content,
        position,
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
        replies: []
      };
    }
  }

  /**
   * Resolve a comment
   */
  async resolveComment(commentId: string, userId: string): Promise<void> {
    const context: ErrorContext = {
      operation: "resolveComment",
      userId,
      additionalData: { commentId }
    };

    try {
      if (!this.isInitialized || !this.config.enableComments) {
        throw new Error("Comments are not enabled");
      }

      const comment = this.comments.get(commentId);
      if (!comment) {
        throw new Error(`Comment not found: ${commentId}`);
      }

      comment.status = "resolved";
      comment.updatedAt = new Date();
      this.comments.set(commentId, comment);

      // Find relevant session and broadcast
      const session = this.findSessionByArtifact(comment.artifactType, comment.artifactId);
      if (session) {
        await this.broadcastEvent(session.id, {
          id: this.generateId(),
          sessionId: session.id,
          userId,
          eventType: "comment_resolved",
          timestamp: new Date(),
          data: { commentId, resolvedBy: userId }
        });
      }

      logger.info("Comment resolved", { commentId, userId });

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to resolve comment", error);
        throw error;
      }
    }
  }

  /**
   * Get active sessions for a project
   */
  getActiveSessions(projectId: string): CollaborationSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.projectId === projectId && session.isActive);
  }

  /**
   * Get cursor positions for an artifact
   */
  getCursorPositions(artifactType: ArtifactType, artifactId: string): CursorPosition[] {
    return Array.from(this.cursors.values())
      .filter(cursor => 
        cursor.artifactType === artifactType && 
        cursor.artifactId === artifactId
      );
  }

  /**
   * Get comments for an artifact
   */
  getComments(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string
  ): Comment[] {
    return Array.from(this.comments.values())
      .filter(comment => 
        comment.projectId === projectId &&
        comment.artifactType === artifactType &&
        comment.artifactId === artifactId
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get presence information for users
   */
  getPresenceInfo(userIds?: string[]): PresenceInfo[] {
    const allPresence = Array.from(this.presence.values());
    
    if (userIds) {
      return allPresence.filter(presence => userIds.includes(presence.userId));
    }
    
    return allPresence;
  }

  /**
   * Stop the real-time collaboration service
   */
  async stop(): Promise<void> {
    logger.info("Stopping real-time collaboration service");

    // Clear all session timeouts
    for (const [, timeout] of this.sessionTimeouts) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();

    // Mark all sessions as inactive
    for (const session of this.sessions.values()) {
      session.isActive = false;
    }

    this.isInitialized = false;
    logger.info("Real-time collaboration service stopped");
  }

  // Private helper methods

  private validateConfiguration(): void {
    if (this.config.maxParticipants <= 0) {
      throw new Error("Max participants must be greater than 0");
    }

    if (this.config.sessionTimeout <= 0) {
      throw new Error("Session timeout must be greater than 0");
    }

    if (!["operational_transform", "last_writer_wins", "manual"].includes(this.config.conflictResolution)) {
      throw new Error("Invalid conflict resolution strategy");
    }
  }

  private startCleanupIntervals(): void {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);

    // Clean up old events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000);
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const sessionsToRemove: string[] = [];

    for (const [key, session] of this.sessions) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      if (inactiveTime > this.config.sessionTimeout) {
        session.isActive = false;
        sessionsToRemove.push(key);
      }
    }

    for (const key of sessionsToRemove) {
      this.sessions.delete(key);
    }

    if (sessionsToRemove.length > 0) {
      logger.info(`Cleaned up ${sessionsToRemove.length} inactive sessions`);
    }
  }

  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const initialCount = this.events.length;
    
    this.events = this.events.filter(event => event.timestamp > cutoffTime);
    
    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} old collaboration events`);
    }
  }

  private getSessionKey(
    projectId: string,
    artifactType: ArtifactType,
    artifactId: string
  ): string {
    return `${projectId}:${artifactType}:${artifactId}`;
  }

  private getCursorKey(
    userId: string,
    artifactType: ArtifactType,
    artifactId: string
  ): string {
    return `${userId}:${artifactType}:${artifactId}`;
  }

  private findSessionByArtifact(
    artifactType: ArtifactType,
    artifactId: string
  ): CollaborationSession | undefined {
    return Array.from(this.sessions.values())
      .find(session => 
        session.artifactType === artifactType && 
        session.artifactId === artifactId &&
        session.isActive
      );
  }

  private setSessionTimeout(session: CollaborationSession): void {
    // Clear existing timeout
    const existingTimeout = this.sessionTimeouts.get(session.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      session.isActive = false;
      this.sessionTimeouts.delete(session.id);
      logger.info(`Session ${session.id} timed out`);
    }, this.config.sessionTimeout);

    this.sessionTimeouts.set(session.id, timeout);
  }

  private updatePresence(userId: string, presence: PresenceInfo): void {
    this.presence.set(userId, presence);
  }

  private async broadcastEvent(
    sessionId: string,
    event: CollaborationEvent
  ): Promise<void> {
    this.events.push(event);
    
    // Keep only recent events (last 10000)
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    logger.debug("Broadcasting collaboration event", {
      sessionId,
      eventType: event.eventType,
      userId: event.userId
    });

    // In a real implementation, this would broadcast to connected clients
    // via WebSockets, Server-Sent Events, or similar real-time mechanism
  }

  private generateId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}