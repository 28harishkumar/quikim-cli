/**
 * Quikim - Workflow Engine (Local)
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Workflow engine entry: getNextInstruction and recordProgress for MCP.
 * Runs in-process; state persisted under .quikim/{projectId}/.
 */

import {
  getNextInstruction as getNextInstructionImpl,
  recordProgress as recordProgressImpl,
} from "./orchestrator/workflow-orchestrator.js";
import type {
  OrchestratorConfig,
  GetNextInput,
  RecordProgressInput,
} from "./orchestrator/workflow-orchestrator.js";
import type { NextInstruction } from "./types/workflow-types.js";

export type { NextInstruction, ProgressPayload } from "./types/workflow-types.js";

/**
 * Returns the next workflow instruction for the project (action, prompt, decisionTrace, etc.).
 */
export async function getNextInstruction(
  config: OrchestratorConfig,
  input: GetNextInput
): Promise<NextInstruction> {
  return getNextInstructionImpl(config, input);
}

/**
 * Records progress after createArtifact; advances workflow state (idempotent with pendingInstructionId).
 */
export async function recordProgress(
  config: OrchestratorConfig,
  input: RecordProgressInput
): Promise<{ success: boolean; currentNode?: string | null; completedNodes?: string[] }> {
  return recordProgressImpl(config, input);
}

export type { OrchestratorConfig, GetNextInput, RecordProgressInput };
