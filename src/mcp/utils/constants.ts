/**
 * Protocol constants and configuration
 */

export const PROTOCOL_CONFIG = {
  MAX_REQUESTS_PER_SESSION: 5,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  XML_VALIDATION_ENABLED: true,
  LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',
} as const;

export const XML_NAMESPACES = {
  MCP_REQUEST: 'mcp_request',
  MCP_RESPONSE: 'mcp_response',
} as const;

export const ACTION_TYPES = {
  READ_FILES: 'read_files',
  CREATE_FILE: 'create_file',
  MODIFY_FILE: 'modify_file',
  RUN_COMMAND: 'run_command',
  COMPLETE: 'complete',
  REQUEST_INFO: 'request_info',
} as const;

export const SESSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ERROR: 'error',
  LIMIT_REACHED: 'limit_reached',
} as const;

export const ERROR_CODES = {
  XML_PARSE_ERROR: 'XML_PARSE_ERROR',
  XML_FORMAT_ERROR: 'XML_FORMAT_ERROR',
  XML_VALIDATION_ERROR: 'XML_VALIDATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_LIMIT_EXCEEDED: 'SESSION_LIMIT_EXCEEDED',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  DECISION_ENGINE_ERROR: 'DECISION_ENGINE_ERROR',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',
  CONTEXT_ANALYSIS_ERROR: 'CONTEXT_ANALYSIS_ERROR',
  CRITICAL_ERROR: 'CRITICAL_ERROR',
  RECOVERY_FAILED: 'RECOVERY_FAILED',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export const ERROR_RECOVERY_STRATEGIES = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  GRACEFUL_DEGRADATION: 'graceful_degradation',
  TERMINATE: 'terminate',
  IGNORE: 'ignore',
} as const;

export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;