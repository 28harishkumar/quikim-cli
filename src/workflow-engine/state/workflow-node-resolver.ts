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
 *
 * Optional nodes handling:
 * - Optional nodes (isOptional=True) can be skipped, added later, or completed normally
 * - When checking dependencies, optional nodes that are not completed are treated as satisfied
 * - This allows downstream nodes to proceed even if optional dependencies are skipped
 */

import {
  WORKFLOW_NODE_ORDER,
  WORKFLOW_NODES,
  getNextNodeId,
  getNodeDef,
  isNodeOptional,
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
  if (!typeMatch) return false;
  
  // For multiFile or anyInSpec nodes, match by type and spec only
  if (specMatch && (def.multiFile || def.anyInSpec)) {
    return true;
  }
  
  const nameNorm = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const nameMatch =
    nameNorm(a.artifactName) === nameNorm(def.artifactName) ||
    a.artifactName === def.artifactName;
  return specMatch && nameMatch;
}

/**
 * Check if a dependency is satisfied.
 * A dependency is satisfied if:
 * 1. The node is completed (has artifact), OR
 * 2. The node is optional (can be skipped)
 */
function isDependencySatisfied(
  depId: string,
  completedNodes: string[]
): boolean {
  if (completedNodes.includes(depId)) {
    return true;
  }
  // Optional nodes are treated as satisfied even if not completed
  if (isNodeOptional(depId)) {
    return true;
  }
  return false;
}

/**
 * Resolves current workflow node from existing artifacts and optional last known state.
 * Deterministic: project empty -> 1.1; otherwise first incomplete node in order, or last known.
 *
 * Optional nodes handling:
 * - Optional nodes can be skipped (dependencies on them are treated as satisfied)
 * - Optional nodes can be completed at any time
 * - When suggesting next candidates, includes both the next required and optional nodes
 */
export function resolveWorkflowNode(
  artifacts: ArtifactSummary[],
  lastKnownState?: string | null
): ResolvedWorkflowState {
  const reasoning: string[] = [];
  const completedNodes: string[] = [];
  const blockedNodes: string[] = [];
  const skippedOptionalNodes: string[] = [];

  for (const nodeId of WORKFLOW_NODE_ORDER) {
    const def = WORKFLOW_NODES[nodeId];
    if (!def) continue;
    const hasArtifact = artifacts.some((a) => artifactMatchesNode(a, nodeId));
    if (hasArtifact) {
      completedNodes.push(nodeId);
    } else {
      const depsSatisfied = def.dependencies.every((dep) =>
        isDependencySatisfied(dep, completedNodes)
      );
      if (!depsSatisfied) {
        blockedNodes.push(nodeId);
      } else if (def.isOptional) {
        // Track optional nodes that could be skipped
        skippedOptionalNodes.push(nodeId);
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
    let nextId = getNextNodeId(lastCompleted);
    
    // Skip already completed nodes and createOnlyIfUserAsks nodes that are done
    while (nextId) {
      const nextDef = getNodeDef(nextId);
      if (nextDef?.createOnlyIfUserAsks && completedNodes.includes(nextId)) {
        nextId = getNextNodeId(nextId);
        continue;
      }
      if (completedNodes.includes(nextId)) {
        nextId = getNextNodeId(nextId);
        continue;
      }
      break;
    }
    
    if (nextId) {
      const nextDef = getNodeDef(nextId);
      const nextDeps = nextDef?.dependencies ?? [];
      const nextBlocked = nextDeps.some((d) => !isDependencySatisfied(d, completedNodes));
      
      if (nextBlocked) {
        currentNode = lastCompleted;
        nextCandidates = nextDef ? [nextId] : [];
        blockedNodes.push(nextId);
        recommendedAction = "WAIT_FOR_INPUT";
        reasoning.push("Next node blocked by dependencies");
      } else {
        currentNode = lastCompleted;
        nextCandidates = [nextId];
        
        // If next is optional, also include the following non-optional as alternative
        if (nextDef?.isOptional) {
          let altId = getNextNodeId(nextId);
          while (altId) {
            const altDef = getNodeDef(altId);
            if (!altDef) break;
            if (completedNodes.includes(altId)) {
              altId = getNextNodeId(altId);
              continue;
            }
            const altDeps = altDef.dependencies ?? [];
            const altOk = altDeps.every((d) => isDependencySatisfied(d, completedNodes));
            if (altOk && !altDef.isOptional) {
              nextCandidates.push(altId);
              reasoning.push(`Optional node ${nextId} can be skipped; ${altId} also available`);
              break;
            } else if (altOk && altDef.isOptional) {
              // Skip optional nodes until we find a required one
              altId = getNextNodeId(altId);
            } else {
              break;
            }
          }
          if (nextCandidates.length === 1) {
            reasoning.push(`Next node: ${nextId} (optional)`);
          }
        } else {
          reasoning.push("Next node: " + nextId);
        }
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
