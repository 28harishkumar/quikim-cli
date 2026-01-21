/**
 * Comprehensive Error Handler
 * Implements error recovery for all failure scenarios, proper error reporting and logging,
 * and fallback mechanisms for critical errors
 * Requirements: 8.2, 8.3, 8.4, 8.5
 */

import { logger } from './logger.js';
import { ERROR_CODES, ERROR_RECOVERY_STRATEGIES, ERROR_SEVERITY } from './constants.js';

export interface ErrorContext {
  operation: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorRecoveryResult {
  success: boolean;
  recoveryStrategy: string;
  fallbackData?: any;
  error?: Error;
  retryCount?: number;
}

export interface ErrorReport {
  errorCode: string;
  severity: string;
  message: string;
  context: ErrorContext;
  timestamp: Date;
  stackTrace?: string;
  recoveryAttempted: boolean;
  recoveryResult?: ErrorRecoveryResult;
}

export class ComprehensiveErrorHandler {
  private errorReports: ErrorReport[] = [];
  private maxErrorReports = 1000;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  /**
   * Handle error with comprehensive recovery and reporting
   */
  async handleError(
    error: Error | unknown,
    context: ErrorContext,
    recoveryStrategy?: string
  ): Promise<ErrorRecoveryResult> {
    const errorCode = this.classifyError(error);
    const severity = this.determineSeverity(errorCode);
    const timestamp = new Date();

    // Create error report
    const errorReport: ErrorReport = {
      errorCode,
      severity,
      message: error instanceof Error ? error.message : String(error),
      context,
      timestamp,
      stackTrace: error instanceof Error ? error.stack : undefined,
      recoveryAttempted: false
    };

    // Log the error
    logger.logError(
      `Error in ${context.operation}`,
      error,
      context.sessionId
    );

    // Attempt recovery based on error type and severity
    const recoveryResult = await this.attemptRecovery(
      error,
      errorCode,
      severity,
      context,
      recoveryStrategy
    );

    errorReport.recoveryAttempted = true;
    errorReport.recoveryResult = recoveryResult;

    // Store error report
    this.storeErrorReport(errorReport);

    // Log recovery result
    if (recoveryResult.success) {
      logger.info('Error recovery successful', {
        errorCode,
        strategy: recoveryResult.recoveryStrategy,
        operation: context.operation,
        sessionId: context.sessionId
      });
    } else {
      logger.error('Error recovery failed', {
        errorCode,
        strategy: recoveryResult.recoveryStrategy,
        operation: context.operation,
        sessionId: context.sessionId,
        retryCount: recoveryResult.retryCount
      });
    }

    return recoveryResult;
  }

  /**
   * Classify error into appropriate error code
   */
  private classifyError(error: Error | unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const name = error.name.toLowerCase();

      // XML-related errors
      if (message.includes('xml') || message.includes('parse')) {
        if (message.includes('validation')) {
          return ERROR_CODES.XML_VALIDATION_ERROR;
        }
        if (message.includes('format')) {
          return ERROR_CODES.XML_FORMAT_ERROR;
        }
        return ERROR_CODES.XML_PARSE_ERROR;
      }

      // Session-related errors
      if (message.includes('session') || message.includes('limit')) {
        if (message.includes('not found')) {
          return ERROR_CODES.SESSION_NOT_FOUND;
        }
        if (message.includes('limit') || message.includes('exceeded')) {
          return ERROR_CODES.SESSION_LIMIT_EXCEEDED;
        }
      }

      // Network and server errors
      if (message.includes('network') || message.includes('connection') || 
          message.includes('timeout') || name.includes('timeout')) {
        if (message.includes('timeout')) {
          return ERROR_CODES.TIMEOUT_ERROR;
        }
        return ERROR_CODES.NETWORK_ERROR;
      }

      // Memory errors
      if (message.includes('memory') || message.includes('heap') || 
          name.includes('rangeerror') || name.includes('outofmemory')) {
        return ERROR_CODES.MEMORY_ERROR;
      }

      // Decision engine errors
      if (message.includes('decision') || message.includes('analysis')) {
        if (message.includes('context')) {
          return ERROR_CODES.CONTEXT_ANALYSIS_ERROR;
        }
        return ERROR_CODES.DECISION_ENGINE_ERROR;
      }

      // Workflow errors
      if (message.includes('workflow') || message.includes('execution')) {
        if (message.includes('execution')) {
          return ERROR_CODES.EXECUTION_FAILED;
        }
        return ERROR_CODES.WORKFLOW_ERROR;
      }

      // Server availability
      if (message.includes('unavailable') || message.includes('unreachable')) {
        return ERROR_CODES.SERVER_UNAVAILABLE;
      }

      // Critical system errors
      if (name.includes('error') && (
          message.includes('critical') || 
          message.includes('fatal') || 
          message.includes('system')
      )) {
        return ERROR_CODES.CRITICAL_ERROR;
      }
    }

    // Default to validation error for unknown errors
    return ERROR_CODES.VALIDATION_ERROR;
  }

  /**
   * Determine error severity based on error code
   */
  private determineSeverity(errorCode: string): string {
    switch (errorCode) {
      case ERROR_CODES.CRITICAL_ERROR:
      case ERROR_CODES.MEMORY_ERROR:
      case ERROR_CODES.SERVER_UNAVAILABLE:
        return ERROR_SEVERITY.CRITICAL;

      case ERROR_CODES.WORKFLOW_ERROR:
      case ERROR_CODES.DECISION_ENGINE_ERROR:
      case ERROR_CODES.SESSION_LIMIT_EXCEEDED:
      case ERROR_CODES.TIMEOUT_ERROR:
        return ERROR_SEVERITY.HIGH;

      case ERROR_CODES.EXECUTION_FAILED:
      case ERROR_CODES.NETWORK_ERROR:
      case ERROR_CODES.SESSION_NOT_FOUND:
      case ERROR_CODES.CONTEXT_ANALYSIS_ERROR:
        return ERROR_SEVERITY.MEDIUM;

      case ERROR_CODES.XML_PARSE_ERROR:
      case ERROR_CODES.XML_FORMAT_ERROR:
      case ERROR_CODES.XML_VALIDATION_ERROR:
      case ERROR_CODES.VALIDATION_ERROR:
        return ERROR_SEVERITY.LOW;

      default:
        return ERROR_SEVERITY.MEDIUM;
    }
  }

  /**
   * Attempt error recovery based on error type and context
   */
  private async attemptRecovery(
    error: Error | unknown,
    errorCode: string,
    severity: string,
    context: ErrorContext,
    preferredStrategy?: string
  ): Promise<ErrorRecoveryResult> {
    const retryKey = `${context.operation}-${errorCode}`;
    const currentRetries = this.retryAttempts.get(retryKey) || 0;

    // Determine recovery strategy
    const strategy = preferredStrategy || this.selectRecoveryStrategy(errorCode, severity, currentRetries);

    switch (strategy) {
      case ERROR_RECOVERY_STRATEGIES.RETRY:
        return await this.attemptRetry(error, errorCode, context, retryKey, currentRetries);

      case ERROR_RECOVERY_STRATEGIES.FALLBACK:
        return await this.attemptFallback(error, errorCode, context);

      case ERROR_RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION:
        return await this.attemptGracefulDegradation(error, errorCode, context);

      case ERROR_RECOVERY_STRATEGIES.TERMINATE:
        return this.terminateGracefully(error, errorCode, context);

      case ERROR_RECOVERY_STRATEGIES.IGNORE:
        return this.ignoreError(error, errorCode, context);

      default:
        return {
          success: false,
          recoveryStrategy: strategy,
          error: error instanceof Error ? error : new Error(String(error))
        };
    }
  }

  /**
   * Select appropriate recovery strategy based on error characteristics
   */
  private selectRecoveryStrategy(errorCode: string, severity: string, retryCount: number): string {
    // Critical errors should terminate gracefully
    if (severity === ERROR_SEVERITY.CRITICAL) {
      return ERROR_RECOVERY_STRATEGIES.TERMINATE;
    }

    // High severity errors with retries available
    if (severity === ERROR_SEVERITY.HIGH && retryCount < this.maxRetries) {
      switch (errorCode) {
        case ERROR_CODES.WORKFLOW_ERROR:
        case ERROR_CODES.DECISION_ENGINE_ERROR:
          return ERROR_RECOVERY_STRATEGIES.FALLBACK;
        case ERROR_CODES.TIMEOUT_ERROR:
          return ERROR_RECOVERY_STRATEGIES.RETRY;
        default:
          return ERROR_RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION;
      }
    }

    // Medium severity errors
    if (severity === ERROR_SEVERITY.MEDIUM) {
      switch (errorCode) {
        case ERROR_CODES.EXECUTION_FAILED:
        case ERROR_CODES.NETWORK_ERROR:
          return retryCount < this.maxRetries ? ERROR_RECOVERY_STRATEGIES.RETRY : ERROR_RECOVERY_STRATEGIES.FALLBACK;
        case ERROR_CODES.SESSION_NOT_FOUND:
          return ERROR_RECOVERY_STRATEGIES.FALLBACK;
        default:
          return ERROR_RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION;
      }
    }

    // Low severity errors
    if (severity === ERROR_SEVERITY.LOW) {
      switch (errorCode) {
        case ERROR_CODES.XML_PARSE_ERROR:
        case ERROR_CODES.XML_VALIDATION_ERROR:
          return ERROR_RECOVERY_STRATEGIES.FALLBACK;
        default:
          return ERROR_RECOVERY_STRATEGIES.IGNORE;
      }
    }

    return ERROR_RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION;
  }

  /**
   * Attempt retry recovery
   */
  private async attemptRetry(
    _error: Error | unknown,
    _errorCode: string,
    context: ErrorContext,
    retryKey: string,
    currentRetries: number
  ): Promise<ErrorRecoveryResult> {
    if (currentRetries >= this.maxRetries) {
      return {
        success: false,
        recoveryStrategy: ERROR_RECOVERY_STRATEGIES.RETRY,
        error: new Error(`Max retries (${this.maxRetries}) exceeded for ${context.operation}`),
        retryCount: currentRetries
      };
    }

    // Increment retry count
    this.retryAttempts.set(retryKey, currentRetries + 1);

    // Add exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, currentRetries), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    return {
      success: true,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES.RETRY,
      fallbackData: {
        retryAttempt: currentRetries + 1,
        delay,
        nextRetryIn: delay * 2
      },
      retryCount: currentRetries + 1
    };
  }

  /**
   * Attempt fallback recovery
   */
  private async attemptFallback(
    error: Error | unknown,
    errorCode: string,
    context: ErrorContext
  ): Promise<ErrorRecoveryResult> {
    let fallbackData: any = {};

    switch (errorCode) {
      case ERROR_CODES.XML_PARSE_ERROR:
      case ERROR_CODES.XML_VALIDATION_ERROR:
        fallbackData = this.createFallbackXMLResponse(context);
        break;

      case ERROR_CODES.DECISION_ENGINE_ERROR:
        fallbackData = this.createFallbackDecision(context);
        break;

      case ERROR_CODES.SESSION_NOT_FOUND:
        fallbackData = this.createFallbackSession(context);
        break;

      case ERROR_CODES.EXECUTION_FAILED:
        fallbackData = this.createFallbackExecution(context);
        break;

      default:
        fallbackData = {
          message: 'Fallback response due to error',
          originalError: error instanceof Error ? error.message : String(error)
        };
    }

    return {
      success: true,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES.FALLBACK,
      fallbackData
    };
  }

  /**
   * Attempt graceful degradation
   */
  private async attemptGracefulDegradation(
    _error: Error | unknown,
    errorCode: string,
    context: ErrorContext
  ): Promise<ErrorRecoveryResult> {
    const degradedData = {
      degradedMode: true,
      limitedFunctionality: true,
      originalOperation: context.operation,
      errorCode,
      message: 'Operating in degraded mode due to error'
    };

    return {
      success: true,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES.GRACEFUL_DEGRADATION,
      fallbackData: degradedData
    };
  }

  /**
   * Terminate gracefully
   */
  private terminateGracefully(
    error: Error | unknown,
    errorCode: string,
    context: ErrorContext
  ): ErrorRecoveryResult {
    const terminationData = {
      terminated: true,
      reason: 'Critical error requiring termination',
      errorCode,
      context: context.operation,
      timestamp: new Date()
    };

    return {
      success: false,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES.TERMINATE,
      fallbackData: terminationData,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }

  /**
   * Ignore error (for low-severity errors)
   */
  private ignoreError(
    _error: Error | unknown,
    errorCode: string,
    _context: ErrorContext
  ): ErrorRecoveryResult {
    return {
      success: true,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES.IGNORE,
      fallbackData: {
        ignored: true,
        errorCode,
        message: 'Error ignored due to low severity'
      }
    };
  }

  /**
   * Create fallback XML response
   */
  private createFallbackXMLResponse(context: ErrorContext): any {
    return {
      xmlResponse: `<mcp_response>
        <request_id>${context.requestId || 'unknown'}</request_id>
        <action>complete</action>
        <instructions>Error occurred during XML processing</instructions>
        <reasoning>XML parsing/validation failed, providing fallback response</reasoning>
        <final_response>An error occurred while processing the XML request. Please check your request format and try again.</final_response>
      </mcp_response>`,
      fallbackUsed: true
    };
  }

  /**
   * Create fallback decision
   */
  private createFallbackDecision(_context: ErrorContext): Record<string, unknown> {
    return {
      action: 'complete',
      instructions: 'Unable to make decision due to error',
      reasoning: 'Decision engine encountered an error, providing safe fallback',
      parameters: {},
      fallbackDecision: true
    };
  }

  /**
   * Create fallback session
   */
  private createFallbackSession(context: ErrorContext): Record<string, unknown> {
    return {
      sessionId: context.sessionId || 'fallback-session',
      status: 'error',
      message: 'Session not found, created fallback session',
      fallbackSession: true
    };
  }

  /**
   * Create fallback execution result
   */
  private createFallbackExecution(_context: ErrorContext): Record<string, unknown> {
    return {
      success: false,
      output: 'Execution failed, fallback result provided',
      error: 'Original execution failed',
      fallbackExecution: true
    };
  }

  /**
   * Store error report
   */
  private storeErrorReport(report: ErrorReport): void {
    this.errorReports.push(report);

    // Trim reports if exceeding max
    if (this.errorReports.length > this.maxErrorReports) {
      this.errorReports = this.errorReports.slice(-this.maxErrorReports);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoverySuccessRate: number;
    recentErrors: ErrorReport[];
  } {
    const errorsByCode: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let successfulRecoveries = 0;

    this.errorReports.forEach(report => {
      errorsByCode[report.errorCode] = (errorsByCode[report.errorCode] || 0) + 1;
      errorsBySeverity[report.severity] = (errorsBySeverity[report.severity] || 0) + 1;
      
      if (report.recoveryResult?.success) {
        successfulRecoveries++;
      }
    });

    return {
      totalErrors: this.errorReports.length,
      errorsByCode,
      errorsBySeverity,
      recoverySuccessRate: this.errorReports.length > 0 ? successfulRecoveries / this.errorReports.length : 0,
      recentErrors: this.errorReports.slice(-10)
    };
  }

  /**
   * Clear retry attempts (useful for testing or session resets)
   */
  clearRetryAttempts(): void {
    this.retryAttempts.clear();
  }

  /**
   * Clear error reports (useful for testing)
   */
  clearErrorReports(): void {
    this.errorReports = [];
  }

  /**
   * Get error reports by session
   */
  getErrorReportsBySession(sessionId: string): ErrorReport[] {
    return this.errorReports.filter(report => report.context.sessionId === sessionId);
  }

  /**
   * Check if operation should be blocked due to repeated failures
   */
  shouldBlockOperation(operation: string, errorCode: string): boolean {
    const retryKey = `${operation}-${errorCode}`;
    const retries = this.retryAttempts.get(retryKey) || 0;
    return retries >= this.maxRetries;
  }
}

// Singleton instance
export const errorHandler = new ComprehensiveErrorHandler();