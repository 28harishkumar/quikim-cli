/**
 * Session summary generation utilities
 * Handles creation of detailed summaries for completed actions
 */

import { WorkflowSession, SessionSummary, ActionHistory } from './types.js';
import { logger } from '../utils/logger.js';

export interface DetailedSummary extends SessionSummary {
  actionBreakdown: ActionBreakdown;
  performanceMetrics: PerformanceMetrics;
  errorAnalysis: ErrorAnalysis;
  recommendations: string[];
}

export interface ActionBreakdown {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  actionTypes: Record<string, number>;
  averageExecutionTime: number;
  longestAction: {
    action: string;
    duration: number;
  };
}

export interface PerformanceMetrics {
  totalDuration: number;
  averageRequestTime: number;
  requestsPerMinute: number;
  efficiency: number; // successful actions / total requests
}

export interface ErrorAnalysis {
  errorCount: number;
  errorTypes: Record<string, number>;
  criticalErrors: string[];
  recoverableErrors: string[];
}

export class SummaryGenerator {
  
  /**
   * Generate basic session summary
   */
  generateBasicSummary(session: WorkflowSession): SessionSummary {
    const completedActions = session.actions.filter(a => a.executionResult.success).length;
    const errors = session.actions
      .filter(a => !a.executionResult.success)
      .map(a => a.executionResult.error || 'Unknown error');
    
    const filesModified = Array.from(new Set(
      session.actions.flatMap(a => a.executionResult.filesModified)
    ));
    
    const summary: SessionSummary = {
      sessionId: session.sessionId,
      userPrompt: session.userPrompt,
      totalRequests: session.requestCount,
      completedActions,
      status: session.status,
      startTime: session.startTime,
      endTime: session.lastActivity,
      duration: session.lastActivity.getTime() - session.startTime.getTime(),
      filesModified,
      errors
    };
    
    // Log summary generation
    if (session.status !== 'active') {
      logger.logSessionCompletion(session.sessionId, session.status, summary);
    }
    
    return summary;
  }
  
  /**
   * Generate detailed session summary with analytics
   */
  generateDetailedSummary(session: WorkflowSession): DetailedSummary {
    const basicSummary = this.generateBasicSummary(session);
    
    const actionBreakdown = this.analyzeActions(session.actions);
    const performanceMetrics = this.calculatePerformanceMetrics(session);
    const errorAnalysis = this.analyzeErrors(session.actions);
    const recommendations = this.generateRecommendations(session, actionBreakdown, errorAnalysis);
    
    return {
      ...basicSummary,
      actionBreakdown,
      performanceMetrics,
      errorAnalysis,
      recommendations
    };
  }
  
  /**
   * Analyze action breakdown
   */
  private analyzeActions(actions: ActionHistory[]): ActionBreakdown {
    const successfulActions = actions.filter(a => a.executionResult.success);
    const failedActions = actions.filter(a => !a.executionResult.success);
    
    // Count action types
    const actionTypes: Record<string, number> = {};
    for (const action of actions) {
      actionTypes[action.action] = (actionTypes[action.action] || 0) + 1;
    }
    
    // Calculate average execution time
    const totalExecutionTime = actions.reduce((sum, a) => sum + a.executionResult.duration, 0);
    const averageExecutionTime = actions.length > 0 ? totalExecutionTime / actions.length : 0;
    
    // Find longest action
    const longestAction = actions.reduce((longest, current) => {
      return current.executionResult.duration > longest.duration 
        ? { action: current.action, duration: current.executionResult.duration }
        : longest;
    }, { action: '', duration: 0 });
    
    return {
      totalActions: actions.length,
      successfulActions: successfulActions.length,
      failedActions: failedActions.length,
      actionTypes,
      averageExecutionTime,
      longestAction
    };
  }
  
  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(session: WorkflowSession): PerformanceMetrics {
    const totalDuration = session.lastActivity.getTime() - session.startTime.getTime();
    const averageRequestTime = session.requestCount > 0 ? totalDuration / session.requestCount : 0;
    const requestsPerMinute = totalDuration > 0 ? (session.requestCount * 60000) / totalDuration : 0;
    
    const successfulActions = session.actions.filter(a => a.executionResult.success).length;
    const efficiency = session.requestCount > 0 ? successfulActions / session.requestCount : 0;
    
    return {
      totalDuration,
      averageRequestTime,
      requestsPerMinute,
      efficiency
    };
  }
  
  /**
   * Analyze errors
   */
  private analyzeErrors(actions: ActionHistory[]): ErrorAnalysis {
    const failedActions = actions.filter(a => !a.executionResult.success);
    
    const errorTypes: Record<string, number> = {};
    const criticalErrors: string[] = [];
    const recoverableErrors: string[] = [];
    
    for (const action of failedActions) {
      const error = action.executionResult.error || 'Unknown error';
      
      // Categorize error type
      const errorType = this.categorizeError(error);
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      
      // Classify error severity
      if (this.isCriticalError(error)) {
        criticalErrors.push(error);
      } else {
        recoverableErrors.push(error);
      }
    }
    
    return {
      errorCount: failedActions.length,
      errorTypes,
      criticalErrors,
      recoverableErrors
    };
  }
  
  /**
   * Categorize error by type
   */
  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('xml') || errorLower.includes('parse')) {
      return 'XML/Parsing Error';
    }
    if (errorLower.includes('file') || errorLower.includes('path')) {
      return 'File System Error';
    }
    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return 'Network Error';
    }
    if (errorLower.includes('permission') || errorLower.includes('access')) {
      return 'Permission Error';
    }
    if (errorLower.includes('timeout')) {
      return 'Timeout Error';
    }
    
    return 'General Error';
  }
  
  /**
   * Check if error is critical
   */
  private isCriticalError(error: string): boolean {
    const criticalKeywords = [
      'fatal', 'critical', 'system', 'crash', 'corruption', 
      'security', 'permission denied', 'access denied'
    ];
    
    const errorLower = error.toLowerCase();
    return criticalKeywords.some(keyword => errorLower.includes(keyword));
  }
  
  /**
   * Generate recommendations based on session analysis
   */
  private generateRecommendations(
    session: WorkflowSession, 
    actionBreakdown: ActionBreakdown, 
    errorAnalysis: ErrorAnalysis
  ): string[] {
    const recommendations: string[] = [];
    
    // Request limit recommendations
    if (session.status === 'limit_reached') {
      recommendations.push('Consider breaking down complex requests into smaller, more focused prompts');
      recommendations.push('Review the workflow to identify unnecessary steps that could be optimized');
    }
    
    // Error rate recommendations
    const errorRate = actionBreakdown.totalActions > 0 
      ? errorAnalysis.errorCount / actionBreakdown.totalActions 
      : 0;
    
    if (errorRate > 0.3) {
      recommendations.push('High error rate detected - consider reviewing input validation and error handling');
    }
    
    if (errorAnalysis.criticalErrors.length > 0) {
      recommendations.push('Critical errors encountered - immediate attention required for system stability');
    }
    
    // Performance recommendations
    if (actionBreakdown.averageExecutionTime > 5000) {
      recommendations.push('Long execution times detected - consider optimizing slow operations');
    }
    
    // File modification recommendations
    const filesModified = Array.from(new Set(
      session.actions.flatMap(a => a.executionResult.filesModified)
    ));
    
    if (filesModified.length > 10) {
      recommendations.push('Many files modified - ensure proper version control and backup procedures');
    }
    
    // Success rate recommendations
    if (actionBreakdown.successfulActions === 0 && actionBreakdown.totalActions > 0) {
      recommendations.push('No successful actions completed - review request format and system configuration');
    }
    
    return recommendations;
  }
  
  /**
   * Format summary for display
   */
  formatSummaryForDisplay(summary: DetailedSummary): string {
    const lines: string[] = [];
    
    lines.push('=== Session Summary ===');
    lines.push(`Session ID: ${summary.sessionId}`);
    lines.push(`User Prompt: ${summary.userPrompt.substring(0, 100)}${summary.userPrompt.length > 100 ? '...' : ''}`);
    lines.push(`Status: ${summary.status.toUpperCase()}`);
    lines.push(`Duration: ${Math.round(summary.duration / 1000)}s`);
    lines.push('');
    
    lines.push('=== Actions ===');
    lines.push(`Total Requests: ${summary.totalRequests}`);
    lines.push(`Completed Actions: ${summary.completedActions}`);
    lines.push(`Success Rate: ${Math.round((summary.completedActions / Math.max(summary.totalRequests, 1)) * 100)}%`);
    lines.push('');
    
    if (summary.filesModified.length > 0) {
      lines.push('=== Files Modified ===');
      summary.filesModified.slice(0, 10).forEach(file => lines.push(`- ${file}`));
      if (summary.filesModified.length > 10) {
        lines.push(`... and ${summary.filesModified.length - 10} more files`);
      }
      lines.push('');
    }
    
    if (summary.errors.length > 0) {
      lines.push('=== Errors ===');
      summary.errors.slice(0, 5).forEach(error => lines.push(`- ${error}`));
      if (summary.errors.length > 5) {
        lines.push(`... and ${summary.errors.length - 5} more errors`);
      }
      lines.push('');
    }
    
    if (summary.recommendations.length > 0) {
      lines.push('=== Recommendations ===');
      summary.recommendations.forEach(rec => lines.push(`- ${rec}`));
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

// Singleton summary generator
export const summaryGenerator = new SummaryGenerator();