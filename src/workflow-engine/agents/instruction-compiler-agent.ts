/**
 * Quikim - Instruction Compiler Agent
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Builds Claude prompt and ExpectedOutcome for one artifact from action and context refs.
 */

import type {
  ArtifactRef,
  ExpectedOutcome,
  WorkflowAction,
} from "../types/workflow-types.js";

export interface InstructionCompilerInput {
  action: WorkflowAction;
  nodeId: string | null;
  artifactType: string;
  specName: string;
  artifactName: string;
  contextArtifacts: ArtifactRef[];
  rules: string[];
}

export interface InstructionCompilerOutput {
  prompt: string;
  expectedOutcome: ExpectedOutcome;
}

function refToMention(r: ArtifactRef): string {
  return `@${r.artifactType}.${r.specName}.${r.artifactName}`;
}

/**
 * Compiles the prompt and expected outcome for the LLM.
 */
export function runInstructionCompilerAgent(
  input: InstructionCompilerInput
): InstructionCompilerOutput {
  const { action, nodeId, artifactType, specName, artifactName, contextArtifacts, rules } = input;
  const mentions = contextArtifacts.map(refToMention).join(", ");
  const prompt = [
    `You are generating artifact: ${artifactType} → ${artifactName}${nodeId ? ` (workflow node ${nodeId})` : ""}.`,
    contextArtifacts.length > 0
      ? `Context artifacts to reference: ${mentions}.`
      : "",
    ...rules,
  ]
    .filter(Boolean)
    .join("\n\n");

  const mustCreate: ArtifactRef[] = [];
  if (action === "GENERATE" || action === "UPDATE") {
    mustCreate.push({ artifactType, specName, artifactName });
  }
  const mustLink = contextArtifacts.map((to) => ({
    from: { artifactType, specName, artifactName } as ArtifactRef,
    to,
    type: "depends_on" as const,
  }));
  const expectedOutcome: ExpectedOutcome = {
    mustCreate: mustCreate.length > 0 ? mustCreate : undefined,
    mustLink,
    forbiddenActions: ["create_duplicate", "skip_mentions"],
  };
  return { prompt, expectedOutcome };
}
