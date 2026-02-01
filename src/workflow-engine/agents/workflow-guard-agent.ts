/**
 * Quikim - Workflow Guard Agent
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Validates invariants before returning instruction: duplicate artifact?, deps satisfied?, idempotent?
 * Prevents duplicate artifacts, circular generation, and retry damage.
 */

import { getNodeDef } from "../config/workflow-definition.js";
import type {
  ArtifactGraphSnapshot,
  GuardResult,
  NextInstruction,
} from "../types/workflow-types.js";

export interface WorkflowGuardInput {
  instruction: NextInstruction;
  snapshot: ArtifactGraphSnapshot;
}

function artifactMatches(
  snapshot: ArtifactGraphSnapshot,
  artifactType: string,
  specName: string,
  artifactName: string
): boolean {
  const spec = specName || "default";
  return snapshot.artifacts.some(
    (a) =>
      a.artifactType === artifactType &&
      (a.specName || "default") === spec &&
      (a.artifactName === artifactName ||
        a.artifactName.toLowerCase().replace(/\s+/g, "-") ===
          artifactName.toLowerCase().replace(/\s+/g, "-"))
  );
}

/**
 * Runs guard checks; returns pass or fail with reason and suggested action.
 */
export function runWorkflowGuardAgent(input: WorkflowGuardInput): GuardResult {
  const { instruction, snapshot } = input;
  if (instruction.action === "NO_OP" || instruction.action === "WAIT_FOR_INPUT") {
    return { pass: true };
  }
  if (
    instruction.artifactType &&
    instruction.specName &&
    instruction.artifactName &&
    (instruction.action === "GENERATE" || instruction.action === "UPDATE")
  ) {
    if (
      artifactMatches(
        snapshot,
        instruction.artifactType,
        instruction.specName,
        instruction.artifactName
      ) &&
      instruction.action === "GENERATE"
    ) {
      return {
        pass: false,
        reason: "Artifact already exists; use UPDATE or skip.",
        suggestedAction: "NO_OP",
      };
    }
  }
  const nodeId = instruction.currentState ?? undefined;
  if (nodeId && instruction.nextCandidates.length > 0) {
    const nextId = instruction.nextCandidates[0];
    const nextDef = getNodeDef(nextId);
    if (nextDef) {
      const depsSatisfied = nextDef.dependencies.every((dep) =>
        snapshot.artifacts.some((a) => {
          const def = getNodeDef(dep);
          if (!def) return false;
          return (
            a.artifactType === def.artifactType &&
            (a.specName || "default") === (def.specName || "default") &&
            (a.artifactName === def.artifactName ||
              a.artifactName.toLowerCase().replace(/\s+/g, "-") ===
                def.artifactName.toLowerCase().replace(/\s+/g, "-"))
          );
        })
      );
      if (!depsSatisfied) {
        return {
          pass: false,
          reason: "Dependencies for next node not satisfied.",
          suggestedAction: "WAIT_FOR_INPUT",
        };
      }
    }
  }
  return { pass: true };
}
