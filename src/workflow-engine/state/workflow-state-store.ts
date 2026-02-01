/**
 * Quikim - Workflow State Store
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * File-based persistence for workflow state and intent per project.
 * Max 2 queries (read + write) per request when updating.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { WorkflowState, WorkflowIntent, WorkflowSource } from "../types/workflow-types.js";

const WORKFLOW_STATE_FILE = "workflow-state.json";
const WORKFLOW_INTENT_FILE = "workflow-intent.json";

function getQuikimDir(projectRoot: string): string {
  return join(projectRoot, ".quikim");
}

function getStatePath(projectRoot: string, projectId: string): string {
  return join(getQuikimDir(projectRoot), projectId, WORKFLOW_STATE_FILE);
}

function getIntentPath(projectRoot: string, projectId: string): string {
  return join(getQuikimDir(projectRoot), projectId, WORKFLOW_INTENT_FILE);
}

function defaultState(projectId: string, source: WorkflowSource): WorkflowState {
  return {
    projectId,
    currentNode: null,
    completedNodes: [],
    blockedNodes: [],
    skippedNodes: [],
    inferredNodes: [],
    source,
    updatedAt: new Date().toISOString(),
  };
}

function defaultIntent(projectId: string, rootIntent: string, activeIntent: string): WorkflowIntent {
  return {
    projectId,
    rootIntent,
    activeIntent,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Loads workflow state for a project from .quikim/{projectId}/workflow-state.json.
 */
export async function loadWorkflowState(
  projectRoot: string,
  projectId: string
): Promise<WorkflowState | null> {
  const path = getStatePath(projectRoot, projectId);
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as WorkflowState;
    return data;
  } catch {
    return null;
  }
}

/**
 * Saves workflow state; ensures directory exists.
 */
export async function saveWorkflowState(
  projectRoot: string,
  state: WorkflowState
): Promise<void> {
  const dir = join(getQuikimDir(projectRoot), state.projectId);
  await mkdir(dir, { recursive: true });
  const path = getStatePath(projectRoot, state.projectId);
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Loads workflow intent for a project from .quikim/{projectId}/workflow-intent.json.
 */
export async function loadWorkflowIntent(
  projectRoot: string,
  projectId: string
): Promise<WorkflowIntent | null> {
  const path = getIntentPath(projectRoot, projectId);
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as WorkflowIntent;
    return data;
  } catch {
    return null;
  }
}

/**
 * Saves workflow intent; ensures directory exists.
 */
export async function saveWorkflowIntent(
  projectRoot: string,
  intent: WorkflowIntent
): Promise<void> {
  const dir = join(getQuikimDir(projectRoot), intent.projectId);
  await mkdir(dir, { recursive: true });
  const path = getIntentPath(projectRoot, intent.projectId);
  await writeFile(path, JSON.stringify(intent, null, 2), "utf-8");
}

/**
 * Gets or creates workflow state for a project.
 */
export async function getOrCreateWorkflowState(
  projectRoot: string,
  projectId: string,
  source: WorkflowSource
): Promise<WorkflowState> {
  const existing = await loadWorkflowState(projectRoot, projectId);
  if (existing) return existing;
  const state = defaultState(projectId, source);
  await saveWorkflowState(projectRoot, state);
  return state;
}

/**
 * Gets or creates workflow intent; updates activeIntent if provided.
 */
export async function getOrCreateWorkflowIntent(
  projectRoot: string,
  projectId: string,
  rootIntent: string,
  activeIntent: string
): Promise<WorkflowIntent> {
  const existing = await loadWorkflowIntent(projectRoot, projectId);
  const intent = existing
    ? { ...existing, activeIntent, updatedAt: new Date().toISOString() }
    : defaultIntent(projectId, rootIntent, activeIntent);
  if (!existing || existing.activeIntent !== activeIntent) {
    await saveWorkflowIntent(projectRoot, intent);
  }
  return intent;
}
