/**
 * Protocol constants and configuration
 * 
 * This file defines all 22 artifact specs aligned with the Quikim workflow.
 * Each artifact type has specific boundaries - do not mix content between types.
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

// =============================================================================
// ARTIFACT SPEC TYPES - All 22 specs aligned with workflow nodes
// =============================================================================

/**
 * Requirement spec types (1.1–1.7) - WHAT to build
 * These define project scope, user needs, and acceptance criteria.
 * DO NOT include: implementation details, code structure, UI layouts
 */
export const REQUIREMENT_SPEC_TYPES = [
  { value: "overview", label: "Overview", nodeId: "1.1", description: "Project scope, purpose, stakeholders, success criteria, constraints" },
  { value: "business-functional", label: "Business & Functional Requirements", nodeId: "1.2", description: "Business rules, user stories, functional requirements" },
  { value: "acceptance-criteria-screens", label: "Acceptance criteria - Screens", nodeId: "1.3", description: "One file PER SCREEN with acceptance criteria" },
  { value: "acceptance-criteria-apis", label: "Acceptance criteria - APIs", nodeId: "1.4", description: "One file PER API with acceptance criteria" },
  { value: "component-requirements", label: "Component requirements", nodeId: "1.5", description: "One file PER COMPONENT with requirements" },
  { value: "acceptance-criteria-code-files", label: "Acceptance criteria - Code files", nodeId: "1.6", description: "One file PER CODE MODULE with acceptance criteria" },
  { value: "phase-milestone-breakdown", label: "Phase & milestone breakdown", nodeId: "1.7", description: "Delivery phases, milestones, timeline" },
] as const;

/**
 * HLD spec types (2.1–2.2) - HOW it's structured (high-level)
 * Defines system architecture and delivery planning.
 * DO NOT include: API details, file structure, UI layouts, code
 */
export const HLD_SPEC_TYPES = [
  { value: "project-architecture", label: "Project architecture", nodeId: "2.1", description: "System components, tech stack, deployment topology, design decisions" },
  { value: "milestones-specs", label: "Milestones / Specs", nodeId: "2.2", description: "Delivery schedule, spec boundaries per milestone" },
] as const;

/**
 * LLD spec types (3.1–3.6) - HOW it's built (detailed)
 * Defines detailed technical specifications for implementation.
 * DO NOT include: wireframes, business requirements, architecture decisions
 */
export const LLD_SPEC_TYPES = [
  { value: "list-screens", label: "List of all screens", nodeId: "3.1", description: "Screen inventory with IDs, entry/exit points" },
  { value: "list-apis", label: "List of all APIs", nodeId: "3.2", description: "API inventory with methods, paths, request/response shapes" },
  { value: "file-tree", label: "File tree (all code files)", nodeId: "3.3", description: "Directory structure, file paths, naming conventions" },
  { value: "technical-details-code", label: "Technical details per code file", nodeId: "3.4", description: "Per-file specs: exports, dependencies, behavior" },
  { value: "technical-detail-screen", label: "Technical detail per screen", nodeId: "3.5", description: "Screen-API-Code traceability matrix" },
  { value: "technical-detail-api", label: "Technical detail per API", nodeId: "3.6", description: "API-handler-service mapping, request pipeline" },
] as const;

/**
 * Flow diagram spec types (4.1–4.2) - HOW users navigate
 * Defines navigation paths and business process flows.
 * DO NOT include: implementation details, API specs, wireframes
 */
export const FLOW_SPEC_TYPES = [
  { value: "navigation-tree", label: "Navigation tree for all screens", nodeId: "4.1", description: "Screen-to-screen paths, navigation graph" },
  { value: "business-logic-flow", label: "Business logic flow charts", nodeId: "4.2", description: "Mermaid flowcharts for business processes" },
] as const;

/**
 * Wireframe spec types (5.1–5.2) - WHAT it looks like
 * Defines visual layouts and UI structure.
 * DO NOT include: API details, business logic, code structure
 */
export const WIREFRAME_SPEC_TYPES = [
  { value: "wireframes-screens", label: "Wireframes for each screen", nodeId: "5.1", description: "Visual layouts per screen" },
  { value: "component-wireframes", label: "Component wireframes", nodeId: "5.2", description: "Reusable UI component designs" },
] as const;

/**
 * Task spec types (6.1–6.2) - WHO does WHAT
 * Defines work breakdown and assignments.
 * DO NOT include: detailed implementation, code, wireframes
 */
export const TASK_SPEC_TYPES = [
  { value: "tasks-milestone", label: "Tasks (grouped by milestone)", nodeId: "6.1", description: "Task breakdown per milestone" },
  { value: "subtasks", label: "Subtasks", nodeId: "6.2", description: "Detailed work items per task" },
] as const;

/**
 * Test spec types (7.x) - HOW to verify
 * Defines test cases and verification criteria.
 * DO NOT include: implementation details, wireframes
 */
export const TEST_SPEC_TYPES = [
  { value: "test-json-api", label: "Test JSON per API", nodeId: "7.1", description: "Input/output test cases per API endpoint" },
] as const;

// =============================================================================
// DESCRIPTION STRINGS FOR TOOL DESCRIPTIONS
// =============================================================================

/** Comma-separated spec_name values for tool descriptions (same as dashboard dropdown). */
export const REQUIREMENT_SPEC_NAMES_DESCRIPTION =
  REQUIREMENT_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

export const HLD_SPEC_NAMES_DESCRIPTION = 
  HLD_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

export const LLD_SPEC_NAMES_DESCRIPTION = 
  LLD_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

export const FLOW_SPEC_NAMES_DESCRIPTION = 
  FLOW_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

export const WIREFRAME_SPEC_NAMES_DESCRIPTION = 
  WIREFRAME_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

export const TASK_SPEC_NAMES_DESCRIPTION = 
  TASK_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

export const TEST_SPEC_NAMES_DESCRIPTION = 
  TEST_SPEC_TYPES.map((t) => `${t.value} (${t.nodeId}: ${t.label})`).join(", ");

// =============================================================================
// COMPREHENSIVE DESCRIPTIONS FOR EACH TOOL TYPE
// =============================================================================

export const GENERATE_REQUIREMENTS_DESCRIPTION = `Save requirements locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first for context and dependencies.

📂 Requirement Specs (1.x) - WHAT to build:
${REQUIREMENT_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

⚠️ IMPORTANT:
• For 1.3, 1.4, 1.5, 1.6: Create MULTIPLE files (one per entity)
• Use descriptive names (e.g., login-screen, get-orders-api)
• Do not use 'default' as spec_name

✅ INCLUDE: Business needs, user stories, acceptance criteria, success metrics
❌ DO NOT INCLUDE: Implementation details, code structure, UI layouts, API specs

📦 Path: .quikim/artifacts/<spec>/requirement_<name>.md`;

export const GENERATE_HLD_DESCRIPTION = `Save High-Level Design locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first to get skill instructions.

📂 HLD Specs (2.x) - HOW it's structured:
${HLD_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

✅ INCLUDE:
• System components and boundaries
• Technology stack with justifications
• Module/service decomposition (high-level)
• Deployment topology
• Integration points
• Key architectural decisions

❌ DO NOT INCLUDE (belongs elsewhere):
• API endpoints with request/response → LLD 3.2, 3.6
• Screen layouts or wireframes → Wireframes 5.x
• File-level code structure → LLD 3.3, 3.4
• Database schemas → ER Diagram
• Implementation code → Source files

📦 Dependencies: Requires requirement artifacts (1.x) first
📤 Path: .quikim/artifacts/<spec>/hld_<id>.md`;

export const GENERATE_LLD_DESCRIPTION = `Save Low-Level Design locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first for skill content.

📂 LLD Specs (3.x) - Each has DIFFERENT content:
${LLD_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

✅ INCLUDE (varies by spec):
• 3.1: Screen ID, name, purpose, entry/exit points
• 3.2: API ID, method, path, request/response shapes
• 3.3: Directory tree with file purposes
• 3.4: Per-file exports, dependencies, behavior (AST-like)
• 3.5: Screen → API → Code mapping
• 3.6: API → Handler → Service → Data mapping

❌ DO NOT INCLUDE:
• Full wireframes → 5.x Wireframes
• Full source code → Actual files
• Business requirements → 1.x Requirements
• Architecture decisions → 2.x HLD

📦 Dependencies: Requires HLD (2.x) first
📤 Path: .quikim/artifacts/<spec>/lld_<id>.md`;

export const GENERATE_MERMAID_DESCRIPTION = `Save flow/mermaid diagram locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first for context.

📂 Flow Specs (4.x) - HOW users navigate:
${FLOW_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

✅ INCLUDE:
• 4.1: Screen-to-screen navigation paths (Mermaid graph)
• 4.2: Business process flows (Mermaid flowchart)

❌ DO NOT INCLUDE:
• Implementation details → LLD 3.x
• API specs → LLD 3.2, 3.6
• Wireframe layouts → 5.x

⚠️ Content must be RAW mermaid syntax only (no code fences, no JSON)
📤 Path: .quikim/artifacts/<spec>/flow_diagram_<id>.md`;

export const GENERATE_WIREFRAMES_DESCRIPTION = `Save wireframe locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first.

📂 Wireframe Specs (5.x) - WHAT it looks like:
${WIREFRAME_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

✅ INCLUDE:
• 5.1: Visual layouts for each screen
• 5.2: Reusable UI component designs

❌ DO NOT INCLUDE:
• API details → LLD 3.2, 3.6
• Business logic → 4.x Flows
• Code structure → LLD 3.x

📦 Dependencies: Requires LLD list-screens (3.1) first
📤 Path: .quikim/artifacts/<spec>/wireframe_files_<id>.md`;

export const GENERATE_TASKS_DESCRIPTION = `Save tasks locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first.

📂 Task Specs (6.x) - WHO does WHAT:
${TASK_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

✅ INCLUDE:
• 6.1: Tasks grouped by milestone with priorities
• 6.2: Detailed subtasks with acceptance criteria

❌ DO NOT INCLUDE:
• Detailed implementation → Source files
• Wireframes → 5.x
• Architecture → 2.x HLD

📦 Format: YAML frontmatter (---) then # Title, ## sections
📤 Path: .quikim/artifacts/<spec>/tasks_<id>.md`;

export const GENERATE_TESTS_DESCRIPTION = `Save tests locally, then sync to server in background.

📋 RECOMMENDED: Call get_workflow_instruction first.

📂 Test Specs (7.x) - HOW to verify:
${TEST_SPEC_TYPES.map(t => `• ${t.value} (${t.nodeId}): ${t.description}`).join('\n')}

✅ INCLUDE:
• 7.1: Test cases with input/output for each API

❌ DO NOT INCLUDE:
• Implementation code → Source files
• Wireframes → 5.x

📦 Dependencies: Requires LLD list-apis (3.2) first
📤 Path: .quikim/artifacts/<spec>/tests_<id>.md`;

// =============================================================================
// ALL 22 SPECS QUICK REFERENCE
// =============================================================================

export const ALL_ARTIFACT_SPECS = [
  ...REQUIREMENT_SPEC_TYPES.map(s => ({ ...s, category: 'requirement' as const, tool: 'generate_requirements' })),
  ...HLD_SPEC_TYPES.map(s => ({ ...s, category: 'hld' as const, tool: 'generate_hld' })),
  ...LLD_SPEC_TYPES.map(s => ({ ...s, category: 'lld' as const, tool: 'generate_lld' })),
  ...FLOW_SPEC_TYPES.map(s => ({ ...s, category: 'flow_diagram' as const, tool: 'generate_mermaid' })),
  ...WIREFRAME_SPEC_TYPES.map(s => ({ ...s, category: 'wireframe_files' as const, tool: 'generate_wireframes' })),
  ...TASK_SPEC_TYPES.map(s => ({ ...s, category: 'tasks' as const, tool: 'generate_tasks' })),
  ...TEST_SPEC_TYPES.map(s => ({ ...s, category: 'tests' as const, tool: 'generate_tests' })),
] as const;

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
