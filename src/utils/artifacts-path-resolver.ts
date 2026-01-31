/**
 * Quikim - Artifacts Path Resolver
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { dirname, join } from "path";
import { existsSync } from "fs";
import { getQuikimProjectRoot } from "../config/project-root.js";

/**
 * Resolve the artifacts root directory
 * Searches from project root (QUIKIM_PROJECT_DIR or cwd) and parents for .quikim/artifacts
 * @returns The path to the artifacts directory
 */
export function resolveArtifactsRoot(): string {
  let currentDir = getQuikimProjectRoot();
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    const artifactsPath = join(currentDir, ".quikim", "artifacts");
    if (existsSync(artifactsPath)) {
      return artifactsPath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
    depth++;
  }

  return join(getQuikimProjectRoot(), ".quikim", "artifacts");
}

/**
 * Get the metadata file path for a spec
 * @param specName - The spec name
 * @returns The full path to the metadata file
 */
export function getMetadataPath(specName: string): string {
  const artifactsRoot = resolveArtifactsRoot();
  return join(artifactsRoot, specName, ".metadata.json");
}
