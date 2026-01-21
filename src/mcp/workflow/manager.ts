/**
 * Workflow Loop Manager
 * Implements main workflow processing function and loop termination conditions
 * Requirements: 1.5, 7.2, 7.3, 7.4
 */

import { XMLRequest, XMLResponse, DecisionContext, ActionType } from '../types.js';
import { WorkflowSession, ActionHistory } from '../session/types.js';
import { DecisionEngine } from '../decision/engine.js';
import { SessionManager } from '../session/manager.js';
import { XMLProtocolParser } from '../xml/parser.js';
import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { PROTOCOL_CONFIG } from '../utils/constants.js';

export interface WorkflowLoopResult {
  success: boolean;
  response: XMLResponse;
  terminationReason: 'completion' | 'limit_reached' | 'error' | 'user_request';
  summary?: string;
}

export interface LoopTerminationCondition {
  type: 'completion' | 'limit_reached' | 'error' | 'timeout';
  message: string;
  shouldTerminate: boolean;
}

export class WorkflowLoopManager {
  private decisionEngine: DecisionEngine;
  private sessionManager: SessionManager;

  constructor(
    decisionEngine: DecisionEngine,
    sessionManager: SessionManager,
    _xmlParser: XMLProtocolParser
  ) {
    this.decisionEngine = decisionEngine;
    this.sessionManager = sessionManager;
  }

  /**
   * Main workflow processing function
   * Processes a single workflow step and determines next action
   */
  async processWorkflowStep(
    request: XMLRequest,
    userId: string
  ): Promise<WorkflowLoopResult> {
    const context: ErrorContext = {
      operation: 'processWorkflowStep',
      requestId: request.requestId,
      userId,
      additionalData: { requestType: request.type }
    };

    try {
      logger.info('Processing workflow step', {
        requestId: request.requestId,
        requestType: request.type,
        userId
      });

      // Validate request before processing
      const validationResult = await this.validateRequest(request, context);
      if (!validationResult.success) {
        return validationResult.result!;
      }

      // Handle different request types with error recovery
      if (request.type === 'user_request') {
        return await this.handleInitialUserRequestWithRecovery(request, userId, context);
      } else if (request.type === 'workflow_response') {
        return await this.handleWorkflowResponseWithRecovery(request, userId, context);
      } else {
        return this.createErrorResult(
          request.requestId,
          `Invalid request type: ${request.type}`,
          'error'
        );
      }

    } catch (error) {
      // Comprehensive error handling for workflow processing
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Use fallback data to create a response
        return {
          success: false,
          response: {
            requestId: request.requestId,
            action: 'complete',
            instructions: 'Workflow error occurred, using fallback',
            parameters: {},
            reasoning: 'Workflow processing failed, fallback response provided',
            finalResponse: recoveryResult.fallbackData.message || 'Workflow completed with errors'
          },
          terminationReason: 'error',
          summary: 'Workflow terminated due to error with fallback recovery'
        };
      }

      logger.logError('Critical error in workflow step processing', error);
      return this.createErrorResult(
        request.requestId,
        `Workflow processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Validate request before processing
   */
  private async validateRequest(
    request: XMLRequest, 
    context: ErrorContext
  ): Promise<{ success: boolean; result?: WorkflowLoopResult }> {
    try {
      // Basic validation
      if (!request.requestId || typeof request.requestId !== 'string') {
        return {
          success: false,
          result: this.createErrorResult(
            'unknown',
            'Invalid request: missing or invalid requestId',
            'error'
          )
        };
      }

      if (!request.type || !['user_request', 'workflow_response'].includes(request.type)) {
        return {
          success: false,
          result: this.createErrorResult(
            request.requestId,
            `Invalid request type: ${request.type}`,
            'error'
          )
        };
      }

      // Type-specific validation
      if (request.type === 'user_request' && (!request.userPrompt || request.userPrompt.trim().length === 0)) {
        return {
          success: false,
          result: this.createErrorResult(
            request.requestId,
            'User prompt is required and cannot be empty for user_request type',
            'error'
          )
        };
      }

      if (request.type === 'workflow_response' && !request.executionResult) {
        return {
          success: false,
          result: this.createErrorResult(
            request.requestId,
            'Execution result is required for workflow_response type',
            'error'
          )
        };
      }

      return { success: true };
    } catch (error) {
      await errorHandler.handleError(
        error,
        { ...context, operation: 'validateRequest' }
      );
      
      return {
        success: false,
        result: this.createErrorResult(
          request.requestId,
          `Request validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        )
      };
    }
  }

  /**
   * Handle initial user request (start of workflow loop) with error recovery
   */
  private async handleInitialUserRequestWithRecovery(
    request: XMLRequest,
    userId: string,
    context: ErrorContext
  ): Promise<WorkflowLoopResult> {
    try {
      return await this.handleInitialUserRequest(request, userId);
    } catch (error) {
      const recoveryResult = await errorHandler.handleError(
        error,
        { ...context, operation: 'handleInitialUserRequest' }
      );
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Create fallback session and response
        return {
          success: false,
          response: {
            requestId: request.requestId,
            action: 'complete',
            instructions: 'Error occurred during initial request processing',
            parameters: {},
            reasoning: 'Initial request processing failed, providing fallback response',
            finalResponse: 'An error occurred while processing your request. Please try again with a simpler request.'
          },
          terminationReason: 'error',
          summary: 'Initial request processing failed with fallback recovery'
        };
      }
      
      return this.createErrorResult(
        request.requestId,
        `Initial request processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Handle workflow response (continuation of workflow loop) with error recovery
   */
  private async handleWorkflowResponseWithRecovery(
    request: XMLRequest,
    userId: string,
    context: ErrorContext
  ): Promise<WorkflowLoopResult> {
    try {
      return await this.handleWorkflowResponse(request, userId);
    } catch (error) {
      const recoveryResult = await errorHandler.handleError(
        error,
        { ...context, operation: 'handleWorkflowResponse' }
      );
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Try to get session for context
        const session = this.sessionManager.getUserSession(userId);
        
        return {
          success: false,
          response: {
            requestId: request.requestId,
            action: 'complete',
            instructions: 'Error occurred during workflow response processing',
            parameters: {},
            reasoning: 'Workflow response processing failed, providing fallback response',
            finalResponse: 'An error occurred while processing the workflow response. The workflow has been terminated.'
          },
          terminationReason: 'error',
          summary: session ? this.sessionManager.getFormattedSummary(session.sessionId) : 'Workflow terminated due to error'
        };
      }
      
      return this.createErrorResult(
        request.requestId,
        `Workflow response processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Handle initial user request (start of workflow loop)
   */
  private async handleInitialUserRequest(
    request: XMLRequest,
    userId: string
  ): Promise<WorkflowLoopResult> {
    if (!request.userPrompt) {
      return this.createErrorResult(
        request.requestId,
        'User prompt is required for user_request type',
        'error'
      );
    }

    // Create new session for the workflow
    const session = this.sessionManager.createSession(request.userPrompt, userId);
    
    // Update session context if codebase provided
    if (request.codebase) {
      this.sessionManager.updateContext(session.sessionId, request.codebase);
    }

    // Check termination conditions before processing
    const terminationCheck = this.checkTerminationConditions(session);
    if (terminationCheck.shouldTerminate) {
      return this.handleTermination(request.requestId, session, terminationCheck);
    }

    // Increment request count
    const canContinue = this.sessionManager.incrementRequestCount(session.sessionId, 'user_request');
    
    if (!canContinue) {
      const limitTermination: LoopTerminationCondition = {
        type: 'limit_reached',
        message: 'Request limit reached on initial request',
        shouldTerminate: true
      };
      return this.handleTermination(request.requestId, session, limitTermination);
    }

    // Create decision context and make decision
    const decisionContext = this.createDecisionContext(session, request.analysis);
    const response = await this.decisionEngine.makeDecision(decisionContext);
    response.requestId = request.requestId;

    // Check if the decision indicates completion
    if (response.action === 'complete') {
      return {
        success: true,
        response,
        terminationReason: 'completion',
        summary: this.sessionManager.getFormattedSummary(session.sessionId)
      };
    }

    return {
      success: true,
      response,
      terminationReason: 'user_request'
    };
  }

  /**
   * Handle workflow response (continuation of workflow loop)
   */
  private async handleWorkflowResponse(
    request: XMLRequest,
    userId: string
  ): Promise<WorkflowLoopResult> {
    if (!request.executionResult) {
      return this.createErrorResult(
        request.requestId,
        'Execution result is required for workflow_response type',
        'error'
      );
    }

    // Get active session
    const session = this.sessionManager.getUserSession(userId);
    if (!session) {
      return this.createErrorResult(
        request.requestId,
        'No active session found for user',
        'error'
      );
    }

    // Check termination conditions
    const terminationCheck = this.checkTerminationConditions(session);
    if (terminationCheck.shouldTerminate) {
      return this.handleTermination(request.requestId, session, terminationCheck);
    }

    // Add execution result to session history
    const actionHistory: ActionHistory = {
      action: this.inferPreviousAction(session),
      instructions: 'Previous instructions executed',
      executionResult: request.executionResult,
      timestamp: new Date(),
      reasoning: 'Execution result received from Cursor',
      requestId: request.requestId
    };

    this.sessionManager.addAction(session.sessionId, actionHistory);

    // Update session context if codebase provided
    if (request.codebase) {
      this.sessionManager.updateContext(session.sessionId, request.codebase);
    }

    // Check if execution failed and handle appropriately
    if (!request.executionResult.success) {
      logger.warn('Execution failed, adapting workflow', {
        sessionId: session.sessionId,
        error: request.executionResult.error,
        action: actionHistory.action
      });
    }

    // Increment request count
    const canContinue = this.sessionManager.incrementRequestCount(session.sessionId, 'workflow_response');
    
    if (!canContinue) {
      const limitTermination: LoopTerminationCondition = {
        type: 'limit_reached',
        message: 'Request limit reached during workflow',
        shouldTerminate: true
      };
      return this.handleTermination(request.requestId, session, limitTermination);
    }

    // Create decision context and make next decision
    const decisionContext = this.createDecisionContext(session, request.analysis);
    const response = await this.decisionEngine.makeDecision(decisionContext);
    response.requestId = request.requestId;

    // Check if the decision indicates completion
    if (response.action === 'complete') {
      this.sessionManager.completeSession(session.sessionId);
      return {
        success: true,
        response,
        terminationReason: 'completion',
        summary: this.sessionManager.getFormattedSummary(session.sessionId)
      };
    }

    return {
      success: true,
      response,
      terminationReason: 'user_request'
    };
  }

  /**
   * Check all termination conditions for the workflow loop
   */
  private checkTerminationConditions(session: WorkflowSession): LoopTerminationCondition {
    // Check request limit
    if (session.requestCount >= session.maxRequests) {
      return {
        type: 'limit_reached',
        message: `Request limit of ${session.maxRequests} reached`,
        shouldTerminate: true
      };
    }

    // Check session timeout
    const now = new Date();
    const sessionAge = now.getTime() - session.startTime.getTime();
    if (sessionAge > PROTOCOL_CONFIG.SESSION_TIMEOUT_MS) {
      return {
        type: 'timeout',
        message: 'Session timeout exceeded',
        shouldTerminate: true
      };
    }

    // Check for error conditions
    if (session.status === 'error') {
      return {
        type: 'error',
        message: 'Session is in error state',
        shouldTerminate: true
      };
    }

    // Check for completion conditions
    if (session.status === 'completed') {
      return {
        type: 'completion',
        message: 'Session marked as completed',
        shouldTerminate: true
      };
    }

    // Check for repeated failures
    const recentActions = session.actions.slice(-3); // Last 3 actions
    const allFailed = recentActions.length >= 3 && 
                     recentActions.every(action => !action.executionResult.success);
    
    if (allFailed) {
      return {
        type: 'error',
        message: 'Multiple consecutive execution failures detected',
        shouldTerminate: true
      };
    }

    // No termination conditions met
    return {
      type: 'completion',
      message: 'No termination conditions met',
      shouldTerminate: false
    };
  }

  /**
   * Handle workflow termination with graceful completion
   */
  private handleTermination(
    requestId: string,
    session: WorkflowSession,
    termination: LoopTerminationCondition
  ): WorkflowLoopResult {
    // Mark session as completed if not already
    if (session.status === 'active') {
      if (termination.type === 'error') {
        this.sessionManager.errorSession(session.sessionId, termination.message);
      } else {
        this.sessionManager.completeSession(session.sessionId);
      }
    }

    // Generate summary
    const summary = this.sessionManager.getFormattedSummary(session.sessionId);
    
    // Log termination
    logger.info('Workflow terminated', {
      sessionId: session.sessionId,
      terminationType: termination.type,
      reason: termination.message,
      requestCount: session.requestCount,
      actionsCompleted: session.actions.length
    });

    // Create completion response
    const response: XMLResponse = {
      requestId,
      action: 'complete',
      instructions: 'Workflow terminated',
      parameters: {},
      reasoning: `Workflow terminated: ${termination.message}`,
      finalResponse: `Workflow completed. Reason: ${termination.message}. ${summary}`
    };

    return {
      success: termination.type !== 'error',
      response,
      terminationReason: termination.type === 'error' ? 'error' : 
                        termination.type === 'limit_reached' ? 'limit_reached' : 'completion',
      summary
    };
  }

  /**
   * Create decision context from session and request analysis
   */
  private createDecisionContext(session: WorkflowSession, analysis?: any): DecisionContext {
    // Analysis is required for decision making
    if (!analysis) {
      throw new Error('Analysis is required from Cursor but was not provided in request');
    }

    return {
      codebase: session.currentContext,
      userPrompt: session.userPrompt,
      analysis: analysis, // Use analysis from Cursor
      actionHistory: session.actions,
      requestCount: session.requestCount,
      maxRequests: session.maxRequests
    };
  }

  /**
   * Infer the previous action from session history
   */
  private inferPreviousAction(session: WorkflowSession): ActionType {
    if (session.actions.length === 0) {
      return 'read_files'; // Default first action
    }

    const lastAction = session.actions[session.actions.length - 1];
    return lastAction.action as ActionType;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    requestId: string,
    errorMessage: string,
    terminationReason: 'error' | 'completion' | 'limit_reached' | 'user_request'
  ): WorkflowLoopResult {
    const response: XMLResponse = {
      requestId,
      action: 'complete',
      instructions: 'Error occurred during processing',
      parameters: {},
      reasoning: `Error: ${errorMessage}`,
      finalResponse: `An error occurred: ${errorMessage}`
    };

    return {
      success: false,
      response,
      terminationReason
    };
  }

  /**
   * Check if workflow should continue based on current state
   */
  canContinueWorkflow(session: WorkflowSession): boolean {
    const termination = this.checkTerminationConditions(session);
    return !termination.shouldTerminate;
  }

  /**
   * Get workflow status summary
   */
  getWorkflowStatus(session: WorkflowSession): {
    canContinue: boolean;
    requestsRemaining: number;
    actionsCompleted: number;
    status: string;
  } {
    return {
      canContinue: this.canContinueWorkflow(session),
      requestsRemaining: Math.max(0, session.maxRequests - session.requestCount),
      actionsCompleted: session.actions.length,
      status: session.status
    };
  }
}

// Export for use in other modules
export default WorkflowLoopManager;