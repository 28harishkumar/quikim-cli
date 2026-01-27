/**
 * Quikim - Duplicate Detector Service
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { normalizeForComparison, computeContentHash } from "../utils/content-normalizer.js";
import { ServerArtifact, ArtifactType } from "../types/artifacts.js";
import { Task } from "./tasks-converter.js";

/**
 * Duplicate Detector Module
 * 
 * Provides duplicate detection for artifacts and tasks to prevent
 * creating multiple copies of the same content during sync operations.
 * 
 * Detection Strategy:
 * - Artifacts: Match by spec_name + artifact_type + artifact_name, then compare normalized content
 * - Tasks: Match by normalized task description within a milestone
 */

export interface DuplicateDetectorOptions {
  verbose?: boolean;
}

/**
 * Find duplicate artifact from a list of server artifacts
 * 
 * @param specName - The spec name to match
 * @param artifactType - The artifact type to match
 * @param artifactName - The artifact name to match
 * @param content - The content to compare (will be normalized)
 * @param serverArtifacts - List of server artifacts to search
 * @param options - Optional configuration
 * @returns The matching artifact if found, null otherwise
 */
export function findDuplicateArtifact(
  specName: string,
  artifactType: ArtifactType,
  artifactName: string,
  content: string,
  serverArtifacts: ServerArtifact[],
  options: DuplicateDetectorOptions = {}
): ServerArtifact | null {
  if (!specName || !artifactType || !artifactName) {
    return null;
  }

  // Phase 1: Find artifacts matching metadata (spec_name + artifact_type + artifact_name)
  const metadataMatches = serverArtifacts.filter(
    (artifact) =>
      artifact.specName === specName &&
      artifact.artifactType === artifactType &&
      artifact.artifactName === artifactName
  );

  if (metadataMatches.length === 0) {
    if (options.verbose) {
      console.log(`[DuplicateDetector] No metadata match for ${artifactType}/${specName}/${artifactName}`);
    }
    return null;
  }

  // Phase 2: Compare normalized content
  const localContentHash = computeContentHash(content);

  for (const artifact of metadataMatches) {
    const serverContentHash = artifact.contentHash || computeContentHash(artifact.content);

    if (localContentHash === serverContentHash) {
      if (options.verbose) {
        console.log(
          `[DuplicateDetector] Found duplicate artifact: ${artifactType}/${specName}/${artifactName} (ID: ${artifact.artifactId})`
        );
      }
      return artifact;
    }
  }

  // Metadata matches but content differs - return the latest version for update
  const latestVersion = metadataMatches.reduce((latest, current) =>
    current.version > latest.version ? current : latest
  );

  if (options.verbose) {
    console.log(
      `[DuplicateDetector] Found artifact with different content: ${artifactType}/${specName}/${artifactName} (ID: ${latestVersion.artifactId})`
    );
  }

  return latestVersion;
}

/**
 * Find duplicate task from a list of existing tasks
 * 
 * @param taskDescription - The task description to match (will be normalized)
 * @param existingTasks - List of existing tasks to search
 * @param options - Optional configuration
 * @returns The matching task if found, null otherwise
 */
export function findDuplicateTask(
  taskDescription: string,
  existingTasks: Task[],
  options: DuplicateDetectorOptions = {}
): Task | null {
  if (!taskDescription || !existingTasks || existingTasks.length === 0) {
    return null;
  }

  const normalizedLocal = normalizeTaskDescription(taskDescription);

  for (const task of existingTasks) {
    const normalizedExisting = normalizeTaskDescription(task.description);

    if (normalizedLocal === normalizedExisting) {
      if (options.verbose) {
        console.log(
          `[DuplicateDetector] Found duplicate task: "${taskDescription.substring(0, 50)}..."`
        );
      }
      return task;
    }
  }

  return null;
}

/**
 * Normalize task description for comparison
 * 
 * Applies the same normalization as content comparison:
 * - Strip HTML tags
 * - Collapse whitespace
 * - Convert to lowercase
 * 
 * @param description - The task description to normalize
 * @returns Normalized description string
 */
export function normalizeTaskDescription(description: string): string {
  if (!description || typeof description !== "string") {
    return "";
  }

  return normalizeForComparison(description);
}

/**
 * Check if content has changed by comparing normalized hashes
 * 
 * @param localContent - The local content
 * @param serverContent - The server content
 * @returns true if content differs, false if identical
 */
export function hasContentChanged(localContent: string, serverContent: string): boolean {
  const localHash = computeContentHash(localContent);
  const serverHash = computeContentHash(serverContent);

  return localHash !== serverHash;
}

/**
 * Batch find duplicate artifacts for multiple local artifacts
 * 
 * @param localArtifacts - Array of local artifacts to check
 * @param serverArtifacts - Array of server artifacts to compare against
 * @param options - Optional configuration
 * @returns Map of local artifact index to matching server artifact
 */
export function findDuplicateArtifacts(
  localArtifacts: Array<{
    specName: string;
    artifactType: ArtifactType;
    artifactName: string;
    content: string;
  }>,
  serverArtifacts: ServerArtifact[],
  options: DuplicateDetectorOptions = {}
): Map<number, ServerArtifact> {
  const duplicates = new Map<number, ServerArtifact>();

  localArtifacts.forEach((localArtifact, index) => {
    const duplicate = findDuplicateArtifact(
      localArtifact.specName,
      localArtifact.artifactType,
      localArtifact.artifactName,
      localArtifact.content,
      serverArtifacts,
      options
    );

    if (duplicate) {
      duplicates.set(index, duplicate);
    }
  });

  return duplicates;
}

/**
 * Batch find duplicate tasks for multiple task descriptions
 * 
 * @param taskDescriptions - Array of task descriptions to check
 * @param existingTasks - Array of existing tasks to compare against
 * @param options - Optional configuration
 * @returns Map of task description index to matching task
 */
export function findDuplicateTasks(
  taskDescriptions: string[],
  existingTasks: Task[],
  options: DuplicateDetectorOptions = {}
): Map<number, Task> {
  const duplicates = new Map<number, Task>();

  taskDescriptions.forEach((description, index) => {
    const duplicate = findDuplicateTask(description, existingTasks, options);

    if (duplicate) {
      duplicates.set(index, duplicate);
    }
  });

  return duplicates;
}
