/**
 * Quikim - Workflow State Agent
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Deterministic agent: computes current node, next candidates, blocked state from snapshot and intent.
 */

import { resolveWorkflowNode } from "../state/workflow-node-resolver.js";
import type { ArtifactGraphSnapshot, WorkflowIntent } from "../types/workflow-types.js";
import type { ResolvedWorkflowState } from "../types/workflow-types.js";

export interface WorkflowStateAgentInput {
  snapshot: ArtifactGraphSnapshot;
  intent: WorkflowIntent | null;
  lastKnownState?: string | null;
}

/**
 * Runs workflow state resolution; returns resolved state (currentNode, nextCandidates, etc.).
 */
export function runWorkflowStateAgent(input: WorkflowStateAgentInput): ResolvedWorkflowState {
  const { snapshot, lastKnownState } = input;
  return resolveWorkflowNode(snapshot.artifacts, lastKnownState ?? undefined);
}
