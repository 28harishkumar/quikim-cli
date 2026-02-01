/**
 * Quikim - Workflow Engine Types
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Workflow engine type definitions for state, instructions, and artifact graph.
 * Production-grade: expanded state, non-actions, decision trace, expected outcome.
 */

/** Source of workflow update: claude, cli, or api */
export type WorkflowSource = "claude" | "cli" | "api";

/** Action returned to MCP: explicit non-actions prevent Claude from hallucinating work */
export type WorkflowAction =
  | "GENERATE"
  | "UPDATE"
  | "LINK_ONLY"
  | "WAIT_FOR_INPUT"
  | "NO_OP";

/** Workflow state persisted per project; supports session drops, retries, user jumps */
export interface WorkflowState {
  projectId: string;
  currentNode: string | null;
  completedNodes: string[];
  blockedNodes: string[];
  skippedNodes: string[];
  inferredNodes: string[];
  pendingInstructionId?: string;
  lastDecisionReason?: string;
  lastUserIntent?: string;
  source: WorkflowSource;
  lastUpdatedBy?: string;
  updatedAt: string;
}

/** Intent anchoring for session continuity */
export interface WorkflowIntent {
  projectId: string;
  rootIntent: string;
  activeIntent: string;
  updatedAt: string;
}

/** Artifact identity by rootId; versions do not influence workflow decisions */
export interface ArtifactIdentity {
  rootId: string;
  artifactType: string;
  specName: string;
  artifactName?: string;
}

/** Single artifact entry in graph snapshot */
export interface ArtifactSummary {
  id: string;
  rootId?: string;
  artifactType: string;
  specName: string;
  artifactName: string;
  version?: number;
  isLatest?: boolean;
  isLLMContext?: boolean;
}

/** Link between two artifacts (from API or derived) */
export interface ArtifactLinkRecord {
  fromId: string;
  toId: string;
  type?: string;
}

/** Read model built once per /workflow/next; normalized by type/spec */
export interface ArtifactGraphSnapshot {
  artifacts: ArtifactSummary[];
  links: ArtifactLinkRecord[];
}

/** Output of resolveWorkflowNode: deterministic current and next state */
export interface ResolvedWorkflowState {
  currentNode: string | null;
  nextCandidates: string[];
  blockedNodes: string[];
  completedNodes: string[];
  recommendedAction: WorkflowAction;
  reasoning: string[];
}

/** Context policy: hard limits for Context Assembly to prevent Claude context explosion */
export type ContextPriorityKey =
  | "currentNodeDependencies"
  | "directParents"
  | "LLMContextArtifacts"
  | "recentArtifacts";

export interface ContextPolicy {
  maxArtifacts: number;
  maxTokens: number;
  priorityOrder: ContextPriorityKey[];
  fallback: "summarize";
}

/** Post-condition contract for validation after MCP execution */
export interface ArtifactRef {
  artifactType: string;
  specName: string;
  artifactName: string;
}

export interface ExpectedOutcome {
  mustCreate?: ArtifactRef[];
  mayCreate?: ArtifactRef[];
  mustLink: Array<{ from: ArtifactRef; to: ArtifactRef; type?: string }>;
  forbiddenActions?: string[];
}

/** Decision trace on every /workflow/next response; for debugging/support */
export interface DecisionTrace {
  detectedState: string;
  reasoning: string[];
  rulesApplied: string[];
  llmUsed: boolean;
}

/** Full instruction returned to MCP */
export interface NextInstruction {
  action: WorkflowAction;
  artifactType?: string;
  specName?: string;
  artifactName?: string;
  currentState: string | null;
  nextCandidates: string[];
  contextArtifacts: ArtifactRef[];
  prompt: string;
  rules: string[];
  expectedOutcome?: ExpectedOutcome;
  decisionTrace: DecisionTrace;
  pendingInstructionId?: string;
}

/** Payload for reporting progress after createArtifact */
export interface ProgressPayload {
  projectId: string;
  artifactType: string;
  specName: string;
  artifactName?: string;
  artifactId?: string;
  pendingInstructionId?: string;
}

/** Guard agent result: pass or fail with reason */
export interface GuardResult {
  pass: boolean;
  reason?: string;
  suggestedAction?: WorkflowAction;
}
