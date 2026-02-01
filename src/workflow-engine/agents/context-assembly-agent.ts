/**
 * Quikim - Context Assembly Agent
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Policy-driven agent: selects which artifacts to pass to Claude (llmContext) and rules.
 * Enforces maxArtifacts and priorityOrder to prevent context explosion.
 */

import { getNodeDef } from "../config/workflow-definition.js";
import type {
  ArtifactGraphSnapshot,
  ArtifactRef,
  ContextPolicy,
} from "../types/workflow-types.js";

const DEFAULT_POLICY: ContextPolicy = {
  maxArtifacts: 8,
  maxTokens: 32000,
  priorityOrder: [
    "currentNodeDependencies",
    "directParents",
    "LLMContextArtifacts",
    "recentArtifacts",
  ],
  fallback: "summarize",
};

export interface ContextAssemblyInput {
  currentState: string | null;
  nextCandidates: string[];
  snapshot: ArtifactGraphSnapshot;
  policy?: Partial<ContextPolicy>;
}

export interface ContextAssemblyOutput {
  llmContext: ArtifactRef[];
  rules: string[];
}

function toRef(a: { artifactType: string; specName: string; artifactName: string }): ArtifactRef {
  return {
    artifactType: a.artifactType,
    specName: a.specName || "default",
    artifactName: a.artifactName,
  };
}

/**
 * Assembles context artifacts for Claude using policy (maxArtifacts, priorityOrder).
 */
export function runContextAssemblyAgent(input: ContextAssemblyInput): ContextAssemblyOutput {
  const policy = { ...DEFAULT_POLICY, ...input.policy };
  const { snapshot, currentState, nextCandidates } = input;
  const refs: ArtifactRef[] = [];
  const seen = new Set<string>();

  const addFromNode = (nodeId: string) => {
    const def = getNodeDef(nodeId);
    if (!def) return;
    const key = `${def.artifactType}.${def.specName}.${def.artifactName}`;
    if (seen.has(key)) return;
    const match = snapshot.artifacts.find(
      (a) =>
        a.artifactType === def.artifactType &&
        (a.specName || "default") === (def.specName || "default") &&
        (a.artifactName === def.artifactName ||
          a.artifactName.toLowerCase().replace(/\s+/g, "-") ===
            def.artifactName.toLowerCase().replace(/\s+/g, "-"))
    );
    if (match) {
      seen.add(key);
      refs.push(toRef(match));
    }
  };

  if (nextCandidates.length > 0) {
    const nextId = nextCandidates[0];
    const nextDef = getNodeDef(nextId);
    if (nextDef) {
      for (const depId of nextDef.dependencies) {
        addFromNode(depId);
      }
    }
  }
  if (currentState) {
    addFromNode(currentState);
  }
  for (const a of snapshot.artifacts) {
    if (refs.length >= policy.maxArtifacts) break;
    if (a.isLLMContext) {
      const r = toRef(a);
      const key = `${r.artifactType}.${r.specName}.${r.artifactName}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(r);
      }
    }
  }
  for (const a of snapshot.artifacts) {
    if (refs.length >= policy.maxArtifacts) break;
    const r = toRef(a);
    const key = `${r.artifactType}.${r.specName}.${r.artifactName}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push(r);
    }
  }

  const rules = [
    "Embed dependencies using @ mentions in format @artifact_type.specName.artifactName.",
    "Output ONLY the artifact content; do not add meta-commentary.",
  ];
  return { llmContext: refs.slice(0, policy.maxArtifacts), rules };
}
