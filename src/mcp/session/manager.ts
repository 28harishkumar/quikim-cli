/**
 * WorkflowSession Manager
 * Handles session creation, tracking, cleanup, and request counting
 */

import { v4 as uuidv4 } from 'uuid';
import { PROTOCOL_CONFIG } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { summaryGenerator } from './summary.js';
import { 
  WorkflowSession, 
  CodebaseContext, 
  ActionHistory, 
  SessionSummary
} from './types.js';

export class SessionManager {
  private sessions: Map<string, WorkflowSession> = new Map();
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId
  
  /**
   * Create a new workflow session for a user prompt
   */
  createSession(userPrompt: string, userId?: string): WorkflowSession {
    const sessionId = uuidv4();
    
    const session: WorkflowSession = {
      sessionId,
      userPrompt,
      requestCount: 0,
      maxRequests: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION,
      startTime: new Date(),
      actions: [],
      currentContext: this.createEmptyContext(),
      status: 'active',
      lastActivity: new Date()
    };
    
    this.sessions.set(sessionId, session);
    
    // Track user session mapping for reset functionality
    if (userId) {
      const existingSessionId = this.userSessions.get(userId);
      if (existingSessionId) {
        // Reset previous session when new prompt comes
        logger.logSessionReset(existingSessionId, sessionId, userId);
        this.resetSession(existingSessionId);
      }
      this.userSessions.set(userId, sessionId);
    }
    
    // Log session creation
    logger.logSessionCreation(sessionId, userPrompt, userId);
    
    return session;
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): WorkflowSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get active session for a user
   */
  getUserSession(userId: string): WorkflowSession | undefined {
    const sessionId = this.userSessions.get(userId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }
  
  /**
   * Increment request count and check limits
   */
  incrementRequestCount(sessionId: string, action?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.requestCount++;
    session.lastActivity = new Date();
    
    // Log request increment
    logger.logRequestIncrement(sessionId, session.requestCount, action || 'unknown');
    
    // Check if limit reached
    if (session.requestCount >= session.maxRequests) {
      session.status = 'limit_reached';
      
      // Log limit enforcement
      logger.logRequestLimitEnforcement(sessionId, session.requestCount, session.userPrompt);
      
      return false; // Limit reached
    }
    
    return true; // Can continue
  }
  
  /**
   * Add action to session history
   */
  addAction(sessionId: string, action: ActionHistory): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.actions.push(action);
    session.lastActivity = new Date();
  }
  
  /**
   * Update session context
   */
  updateContext(sessionId: string, context: Partial<CodebaseContext>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.currentContext = {
      ...session.currentContext,
      ...context,
      lastAnalysis: new Date()
    };
    session.lastActivity = new Date();
  }
  
  /**
   * Mark session as completed
   */
  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.status = 'completed';
    session.lastActivity = new Date();
  }
  
  /**
   * Mark session as error
   */
  errorSession(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.status = 'error';
    session.lastActivity = new Date();
    
    // Add error to action history
    const errorAction: ActionHistory = {
      action: 'error',
      instructions: 'Session terminated due to error',
      executionResult: {
        success: false,
        output: '',
        error,
        filesModified: [],
        duration: 0
      },
      timestamp: new Date(),
      reasoning: 'Error occurred during session execution',
      requestId: uuidv4()
    };
    
    session.actions.push(errorAction);
  }
  
  /**
   * Reset session (for new user prompts)
   */
  resetSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Session doesn't exist, nothing to reset
    }
    
    // Mark as completed regardless of current status (active, limit_reached, etc.)
    if (session.status !== 'completed' && session.status !== 'error') {
      session.status = 'completed';
    }
    
    session.lastActivity = new Date();
  }
  
  /**
   * Check if session can accept more requests
   */
  canAcceptRequest(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    return session.status === 'active' && session.requestCount < session.maxRequests;
  }
  
  /**
   * Get session summary for completion
   */
  getSessionSummary(sessionId: string): SessionSummary {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return summaryGenerator.generateBasicSummary(session);
  }
  
  /**
   * Get detailed session summary with analytics
   */
  getDetailedSessionSummary(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return summaryGenerator.generateDetailedSummary(session);
  }
  
  /**
   * Get formatted summary for display
   */
  getFormattedSummary(sessionId: string): string {
    const detailedSummary = this.getDetailedSessionSummary(sessionId);
    return summaryGenerator.formatSummaryForDisplay(detailedSummary);
  }
  
  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceLastActivity > PROTOCOL_CONFIG.SESSION_TIMEOUT_MS) {
        expiredSessions.push(sessionId);
      }
    }
    
    // Remove expired sessions
    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
      
      // Remove from user mapping if exists
      for (const [userId, userSessionId] of this.userSessions) {
        if (userSessionId === sessionId) {
          this.userSessions.delete(userId);
          break;
        }
      }
    }
    
    // Log cleanup results
    logger.logSessionCleanup(expiredSessions.length, this.sessions.size + expiredSessions.length);
    
    return expiredSessions.length;
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): WorkflowSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }
  
  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
  
  /**
   * Create empty codebase context
   */
  private createEmptyContext(): CodebaseContext {
    return {
      files: [],
      detectedTechnology: [],
      projectStructure: {
        rootPath: '',
        directories: [],
        fileTypes: {},
        packageFiles: [],
        configFiles: []
      },
      lastAnalysis: new Date()
    };
  }
}

// Singleton instance
export const sessionManager = new SessionManager();