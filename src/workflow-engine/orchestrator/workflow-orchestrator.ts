/**
 * Quikim - Workflow Orchestrator
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Coordinates agents in strict order: load intent → build snapshot → resolve node →
 * context assembly → instruction compiler → guard → return.
 */

import { buildArtifactGraph } from "../state/artifact-graph-builder.js";
import {
  getOrCreateWorkflowState,
  getOrCreateWorkflowIntent,
  loadWorkflowState,
  saveWorkflowState,
} from "../state/workflow-state-store.js";
import { runWorkflowStateAgent } from "../agents/workflow-state-agent.js";
import { runContextAssemblyAgent } from "../agents/context-assembly-agent.js";
import { runInstructionCompilerAgent } from "../agents/instruction-compiler-agent.js";
import { runWorkflowGuardAgent } from "../agents/workflow-guard-agent.js";
import { getNextNodeId, getNodeDef, getNodeIdByArtifact } from "../config/workflow-definition.js";
import type {
  NextInstruction,
  WorkflowState,
  WorkflowSource,
  WorkflowAction,
} from "../types/workflow-types.js";
import type { ServiceAwareAPIClient } from "../../mcp/api/service-client.js";
import { randomUUID } from "crypto";

export interface OrchestratorConfig {
  projectRoot: string;
  apiClient: ServiceAwareAPIClient;
  source?: WorkflowSource;
}

export interface GetNextInput {
  projectId: string;
  userIntent: string;
  lastKnownState?: string | null;
}

/**
 * Runs the orchestrator: returns next instruction (action, prompt, decisionTrace, etc.).
 * Enforces step order; max 2 logical reads (state + snapshot).
 */
export async function getNextInstruction(
  config: OrchestratorConfig,
  input: GetNextInput
): Promise<NextInstruction> {
  const { projectRoot, apiClient, source = "claude" } = config;
  const { projectId, userIntent, lastKnownState } = input;

  const state = await getOrCreateWorkflowState(projectRoot, projectId, source);
  const intent = await getOrCreateWorkflowIntent(
    projectRoot,
    projectId,
    userIntent,
    userIntent
  );
  const snapshot = await buildArtifactGraph(projectId, apiClient);
  const resolved = runWorkflowStateAgent({
    snapshot,
    intent,
    lastKnownState: lastKnownState ?? state.currentNode,
  });

  const nextId =
    resolved.nextCandidates.length > 0 ? resolved.nextCandidates[0] : null;
  const nodeDef = nextId ? getNodeDef(nextId) : null;
  const action: WorkflowAction =
    nextId && nodeDef ? resolved.recommendedAction : "NO_OP";

  const contextOut = runContextAssemblyAgent({
    currentState: resolved.currentNode,
    nextCandidates: resolved.nextCandidates,
    snapshot,
  });
  const compilerOut = runInstructionCompilerAgent({
    action,
    nodeId: nextId,
    artifactType: nodeDef?.artifactType ?? "",
    specName: nodeDef?.specName ?? "default",
    artifactName: nodeDef?.artifactName ?? "",
    contextArtifacts: contextOut.llmContext,
    rules: contextOut.rules,
  });

  const pendingInstructionId = randomUUID();
  const draftInstruction: NextInstruction = {
    action,
    artifactType: nodeDef?.artifactType,
    specName: nodeDef?.specName,
    artifactName: nodeDef?.artifactName,
    currentState: resolved.currentNode,
    nextCandidates: resolved.nextCandidates,
    contextArtifacts: contextOut.llmContext,
    prompt: compilerOut.prompt,
    rules: contextOut.rules,
    expectedOutcome: compilerOut.expectedOutcome,
    decisionTrace: {
      detectedState: resolved.currentNode ?? "none",
      reasoning: resolved.reasoning,
      rulesApplied: ["resolveWorkflowNode", "contextAssembly", "instructionCompiler"],
      llmUsed: false,
    },
    pendingInstructionId,
  };

  const guardResult = runWorkflowGuardAgent({
    instruction: draftInstruction,
    snapshot,
  });
  if (!guardResult.pass) {
    const noOpInstruction: NextInstruction = {
      ...draftInstruction,
      action: (guardResult.suggestedAction as WorkflowAction) ?? "NO_OP",
      prompt: "",
      decisionTrace: {
        ...draftInstruction.decisionTrace,
        reasoning: [...draftInstruction.decisionTrace.reasoning, guardResult.reason ?? "Guard failed"],
      },
    };
    const newState: WorkflowState = {
      ...state,
      lastDecisionReason: guardResult.reason,
      lastUserIntent: userIntent,
      updatedAt: new Date().toISOString(),
    };
    await saveWorkflowState(projectRoot, newState);
    return noOpInstruction;
  }

  const newState: WorkflowState = {
    ...state,
    currentNode: resolved.currentNode,
    completedNodes: resolved.completedNodes,
    blockedNodes: resolved.blockedNodes,
    lastUserIntent: userIntent,
    pendingInstructionId,
    updatedAt: new Date().toISOString(),
  };
  await saveWorkflowState(projectRoot, newState);
  return draftInstruction;
}

export interface RecordProgressInput {
  projectId: string;
  artifactType: string;
  specName: string;
  artifactName?: string;
  artifactId?: string;
  pendingInstructionId?: string;
}

/**
 * Records progress after createArtifact; advances workflow state (idempotent when pendingInstructionId matches).
 */
export async function recordProgress(
  config: OrchestratorConfig,
  input: RecordProgressInput
): Promise<{ success: boolean; currentNode?: string | null; completedNodes?: string[] }> {
  const { projectRoot } = config;
  const state = await loadWorkflowState(projectRoot, input.projectId);
  if (!state) {
    return { success: false };
  }
  if (
    input.pendingInstructionId &&
    state.pendingInstructionId !== input.pendingInstructionId
  ) {
    return { success: true, currentNode: state.currentNode, completedNodes: state.completedNodes };
  }
  const completedNode = getNodeIdByArtifact(
    input.artifactType,
    input.specName || "default",
    input.artifactName ?? ""
  );
  const nextId = completedNode ? getNextNodeId(completedNode) : null;
  const completedNodes = completedNode
    ? [...new Set([...state.completedNodes, completedNode])]
    : state.completedNodes;
  const newState: WorkflowState = {
    ...state,
    currentNode: nextId ?? completedNode ?? state.currentNode,
    completedNodes,
    pendingInstructionId: undefined,
    updatedAt: new Date().toISOString(),
  };
  await saveWorkflowState(projectRoot, newState);
  return {
    success: true,
    currentNode: newState.currentNode,
    completedNodes: newState.completedNodes,
  };
}
