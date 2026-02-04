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

/** Shared project_context schema for MCP tools so the client can pass custom spec name */
export const PROJECT_CONTEXT_SCHEMA = {
  type: "object" as const,
  description:
    "Optional. Pass specName to use a custom spec; artifacts live under .quikim/artifacts/<specName>/.",
  properties: {
    specName: {
      type: "string" as const,
      description:
        "Custom spec name (e.g. my-feature). Artifacts are stored under .quikim/artifacts/<specName>/.",
    },
  },
};

/**
 * Requirement spec types (1.1–1.7) aligned with organization dashboard.
 * Same values as quikim-opensource requirement-spec-types; custom spec names are also allowed.
 */
export const REQUIREMENT_SPEC_TYPES = [
  { value: "overview", label: "Overview" },
  { value: "business-functional", label: "Business & Functional Requirements" },
  { value: "acceptance-criteria-screens", label: "Acceptance criteria - Screens" },
  { value: "acceptance-criteria-apis", label: "Acceptance criteria - APIs" },
  { value: "component-requirements", label: "Component requirements" },
  { value: "acceptance-criteria-code-files", label: "Acceptance criteria - Code files" },
  { value: "phase-milestone-breakdown", label: "Phase & milestone breakdown" },
] as const;

/** Comma-separated spec_name values for tool descriptions (same as dashboard dropdown). */
export const REQUIREMENT_SPEC_NAMES_DESCRIPTION =
  REQUIREMENT_SPEC_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");

/** HLD spec types (2.1–2.2) aligned with org dashboard. Different from LLD; use only for generate_hld/pull_hld. */
export const HLD_SPEC_TYPES = [
  { value: "project-architecture", label: "Project architecture" },
  { value: "milestones-specs", label: "Milestones / Specs" },
] as const;

/** LLD spec types (3.1–3.6) aligned with org dashboard. Different from HLD; use only for generate_lld/pull_lld. */
export const LLD_SPEC_TYPES = [
  { value: "list-screens", label: "List of all screens" },
  { value: "list-apis", label: "List of all APIs" },
  { value: "file-tree", label: "File tree (all code files)" },
  { value: "technical-details-code", label: "Technical details per code file" },
  { value: "technical-detail-screen", label: "Technical detail per screen" },
  { value: "technical-detail-api", label: "Technical detail per API" },
] as const;

/** Flow diagram spec types (4.1–4.2) aligned with organization dashboard. */
export const FLOW_SPEC_TYPES = [
  { value: "navigation-tree", label: "Navigation tree for all screens" },
  { value: "business-logic-flow", label: "Business logic flow charts" },
] as const;

/** Wireframe spec types (5.1–5.2) aligned with organization dashboard. */
export const WIREFRAME_SPEC_TYPES = [
  { value: "wireframes-screens", label: "Wireframes for each screen" },
  { value: "component-wireframes", label: "Component wireframes" },
] as const;

export const HLD_SPEC_NAMES_DESCRIPTION = HLD_SPEC_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");
export const LLD_SPEC_NAMES_DESCRIPTION = LLD_SPEC_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");
export const FLOW_SPEC_NAMES_DESCRIPTION = FLOW_SPEC_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");
export const WIREFRAME_SPEC_NAMES_DESCRIPTION = WIREFRAME_SPEC_TYPES.map((t) => `${t.value} (${t.label})`).join(", ");

/** Optional name/title for artifacts; LLM can set these separately from content */
export const ARTIFACT_NAME_TITLE_SCHEMA = {
  name: {
    type: "string" as const,
    description:
      "Artifact id used for the file name (e.g. business-functional). Use a descriptive name so the file is requirement_<name>.md; avoid generic names like \"Requirement\".",
  },
  title: {
    type: "string" as const,
    description:
      "Optional title (used for context, code_guideline, requirements). If name is omitted, title is slugified for the file name.",
  },
};