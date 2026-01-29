/**
 * Logging utility for MCP Cursor Protocol
 * Handles request limit enforcement logging and general system logging
 */

import { PROTOCOL_CONFIG } from './constants.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  sessionId?: string;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  
  constructor(private logLevel: LogLevel = PROTOCOL_CONFIG.LOG_LEVEL) {}
  
  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>, sessionId?: string): void {
    this.log('debug', message, context, sessionId);
  }
  
  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>, sessionId?: string): void {
    this.log('info', message, context, sessionId);
  }
  
  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>, sessionId?: string): void {
    this.log('warn', message, context, sessionId);
  }
  
  /**
   * Log error message
   */
  error(message: string, context?: Record<string, any>, sessionId?: string): void {
    this.log('error', message, context, sessionId);
  }

  /**
   * Log general error with Error object
   */
  logError(message: string, error: Error | unknown, sessionId?: string): void {
    const errorContext = {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : 'Unknown'
    };
    
    this.error(message, errorContext, sessionId);
  }

  /**
   * Log request received
   */
  logRequestReceived(requestId: string, requestType: string, userId: string): void {
    this.info('Request received', {
      requestId,
      requestType,
      userId
    });
  }

  /**
   * Log response sent
   */
  logResponseSent(requestId: string, action: string, userId: string): void {
    this.info('Response sent', {
      requestId,
      action,
      userId
    });
  }

  /**
   * Log server start
   */
  logServerStart(): void {
    this.info('MCP Cursor Protocol Server started', {
      version: '1.0.0',
      maxRequestsPerSession: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION,
      sessionTimeoutMs: PROTOCOL_CONFIG.SESSION_TIMEOUT_MS
    });
  }

  /**
   * Log server stop
   */
  logServerStop(): void {
    this.info('MCP Cursor Protocol Server stopped');
  }
  
  /**
   * Log request limit enforcement events
   */
  logRequestLimitEnforcement(sessionId: string, requestCount: number, userPrompt: string): void {
    this.warn('Request limit reached - forcing completion', {
      sessionId,
      requestCount,
      maxRequests: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION,
      userPrompt: userPrompt.substring(0, 100) + (userPrompt.length > 100 ? '...' : ''),
      enforcementReason: 'Maximum requests per session exceeded'
    }, sessionId);
  }
  
  /**
   * Log session creation
   */
  logSessionCreation(sessionId: string, userPrompt: string, userId?: string): void {
    this.info('New session created', {
      sessionId,
      userPrompt: userPrompt.substring(0, 100) + (userPrompt.length > 100 ? '...' : ''),
      userId,
      maxRequests: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION
    }, sessionId);
  }
  
  /**
   * Log session completion
   */
  logSessionCompletion(sessionId: string, reason: 'completed' | 'limit_reached' | 'error', summary: any): void {
    this.info('Session completed', {
      sessionId,
      reason,
      totalRequests: summary.totalRequests,
      completedActions: summary.completedActions,
      duration: summary.duration,
      filesModified: summary.filesModified.length,
      errors: summary.errors.length
    }, sessionId);
  }
  
  /**
   * Log session reset
   */
  logSessionReset(oldSessionId: string, newSessionId: string, userId: string): void {
    this.info('Session reset for new user prompt', {
      oldSessionId,
      newSessionId,
      userId,
      reason: 'New user prompt received'
    });
  }
  
  /**
   * Log request increment
   */
  logRequestIncrement(sessionId: string, requestCount: number, action: string): void {
    this.debug('Request count incremented', {
      sessionId,
      requestCount,
      maxRequests: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION,
      action,
      remaining: PROTOCOL_CONFIG.MAX_REQUESTS_PER_SESSION - requestCount
    }, sessionId);
  }
  
  /**
   * Log session cleanup
   */
  logSessionCleanup(cleanedCount: number, totalSessions: number): void {
    this.info('Session cleanup completed', {
      cleanedSessions: cleanedCount,
      remainingSessions: totalSessions - cleanedCount,
      timeoutMs: PROTOCOL_CONFIG.SESSION_TIMEOUT_MS
    });
  }
  
  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, sessionId?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      sessionId
    };
    
    this.logs.push(entry);
    
    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Skip console output when using stdio MCP (e.g. Claude Desktop) to avoid corrupting protocol
    const silent = process.env.QUIKIM_MCP_SILENT === "1" || process.env.QUIKIM_MCP_SILENT === "true";
    if (!silent && process.env.NODE_ENV !== "production") {
      this.outputToConsole(entry);
    }
  }
  
  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }
  
  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const sessionInfo = entry.sessionId ? ` [${entry.sessionId.substring(0, 8)}]` : '';
    const contextInfo = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    
    const logMessage = `${timestamp} [${entry.level.toUpperCase()}]${sessionInfo} ${entry.message}${contextInfo}`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }
  
  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 50, sessionId?: string): LogEntry[] {
    let logs = this.logs;
    
    if (sessionId) {
      logs = logs.filter(log => log.sessionId === sessionId);
    }
    
    return logs.slice(-count);
  }
  
  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, sessionId?: string): LogEntry[] {
    let logs = this.logs.filter(log => log.level === level);
    
    if (sessionId) {
      logs = logs.filter(log => log.sessionId === sessionId);
    }
    
    return logs;
  }
  
  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Get log statistics
   */
  getLogStats(): Record<LogLevel, number> {
    const stats: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };
    
    for (const log of this.logs) {
      stats[log.level]++;
    }
    
    return stats;
  }
}

// Singleton logger instance
export const logger = new Logger();