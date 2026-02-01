/**
 * Quikim - Workflow Node Resolver
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Canonical, deterministic resolution of current workflow node from artifacts and last known state.
 * Reused by orchestrator and Sync & Recovery; unit-testable.
 */

import {
  WORKFLOW_NODE_ORDER,
  WORKFLOW_NODES,
  getNextNodeId,
  getNodeDef,
} from "../config/workflow-definition.js";
import type { ArtifactSummary } from "../types/workflow-types.js";
import type { ResolvedWorkflowState, WorkflowAction } from "../types/workflow-types.js";

function artifactMatchesNode(
  a: ArtifactSummary,
  nodeId: string
): boolean {
  const def = getNodeDef(nodeId);
  if (!def) return false;
  const specMatch = (a.specName || "default") === (def.specName || "default");
  const typeMatch = a.artifactType === def.artifactType;
  const nameNorm = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const nameMatch =
    nameNorm(a.artifactName) === nameNorm(def.artifactName) ||
    a.artifactName === def.artifactName;
  return specMatch && typeMatch && nameMatch;
}

/**
 * Resolves current workflow node from existing artifacts and optional last known state.
 * Deterministic: project empty -> 1.1; otherwise first incomplete node in order, or last known.
 */
export function resolveWorkflowNode(
  artifacts: ArtifactSummary[],
  lastKnownState?: string | null
): ResolvedWorkflowState {
  const reasoning: string[] = [];
  const completedNodes: string[] = [];
  const blockedNodes: string[] = [];

  for (const nodeId of WORKFLOW_NODE_ORDER) {
    const def = WORKFLOW_NODES[nodeId];
    if (!def) continue;
    const hasArtifact = artifacts.some((a) => artifactMatchesNode(a, nodeId));
    if (hasArtifact) {
      completedNodes.push(nodeId);
    } else {
      const depsSatisfied = def.dependencies.every((dep) =>
        completedNodes.includes(dep)
      );
      if (!depsSatisfied) {
        blockedNodes.push(nodeId);
      }
    }
  }

  let currentNode: string | null = null;
  let nextCandidates: string[] = [];
  let recommendedAction: WorkflowAction = "GENERATE";

  if (completedNodes.length === 0) {
    currentNode = null;
    nextCandidates = [WORKFLOW_NODE_ORDER[0]].filter(Boolean);
    reasoning.push("No artifacts; start at 1.1");
  } else {
    const lastCompleted = completedNodes[completedNodes.length - 1];
    const nextId = getNextNodeId(lastCompleted);
    if (nextId) {
      const nextDef = getNodeDef(nextId);
      const nextBlocked = nextDef && nextDef.dependencies.some((d) => !completedNodes.includes(d));
      if (nextBlocked) {
        currentNode = lastCompleted;
        nextCandidates = nextDef ? [nextId] : [];
        blockedNodes.push(nextId);
        recommendedAction = "WAIT_FOR_INPUT";
        reasoning.push("Next node blocked by dependencies");
      } else {
        currentNode = lastCompleted;
        nextCandidates = nextId ? [nextId] : [];
        reasoning.push("Next node: " + nextId);
      }
    } else {
      currentNode = lastCompleted;
      reasoning.push("Workflow complete");
      recommendedAction = "NO_OP";
    }
  }

  if (lastKnownState && WORKFLOW_NODE_ORDER.includes(lastKnownState)) {
    const knownIdx = WORKFLOW_NODE_ORDER.indexOf(lastKnownState);
    const currIdx = currentNode ? WORKFLOW_NODE_ORDER.indexOf(currentNode) : -1;
    if (knownIdx > currIdx && !completedNodes.includes(lastKnownState)) {
      nextCandidates = [lastKnownState];
      reasoning.push("Using lastKnownState as next candidate");
    }
  }

  return {
    currentNode,
    nextCandidates,
    blockedNodes,
    completedNodes,
    recommendedAction,
    reasoning,
  };
}
