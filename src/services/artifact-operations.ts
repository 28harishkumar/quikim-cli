/**
 * Quikim - Shared Artifact Push/Pull Operations
 *
 * Copyright (c) 2026 Quikim Inc.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { ArtifactFileManager } from "./artifact-file-manager.js";
import {
  ArtifactType as CLIArtifactType,
  ArtifactFilters,
  LocalArtifact,
  isVersionedArtifactType,
} from "../types/artifacts.js";

/** MCP/tool artifact type names (requirements, wireframes, mermaid, context, code_guideline) */
export type MCPArtifactType =
  | "requirements"
  | "hld"
  | "lld"
  | "tasks"
  | "wireframes"
  | "er_diagram"
  | "mermaid"
  | "context"
  | "code_guideline";

const MCP_TO_CLI_TYPE: Record<MCPArtifactType, CLIArtifactType> = {
  requirements: "requirement",
  hld: "hld",
  lld: "lld",
  tasks: "tasks",
  wireframes: "wireframe_files",
  er_diagram: "er_diagram",
  mermaid: "flow_diagram",
  context: "context",
  code_guideline: "code_guideline",
};

export function mcpToCLIArtifactType(mcpType: MCPArtifactType): CLIArtifactType {
  return MCP_TO_CLI_TYPE[mcpType];
}

/**
 * Get content for push from local filesystem.
 * Tries spec dir for first matching artifact type; or specific artifactName if provided.
 */
export async function getPushContentFromLocal(
  fileManager: ArtifactFileManager,
  specName: string,
  mcpType: MCPArtifactType,
  artifactName?: string
): Promise<string | null> {
  const result = await getPushContentAndNameFromLocal(fileManager, specName, mcpType, artifactName);
  return result?.content ?? null;
}

/**
 * Get content and artifact name from local filesystem for push.
 * Returns first matching artifact so MCP can write local-first then sync in background.
 */
export async function getPushContentAndNameFromLocal(
  fileManager: ArtifactFileManager,
  specName: string,
  mcpType: MCPArtifactType,
  artifactName?: string
): Promise<{ content: string; artifactName: string } | null> {
  const cliType = mcpToCLIArtifactType(mcpType);
  if (artifactName) {
    const content = await fileManager.readArtifactFile(specName, cliType, artifactName);
    return content != null ? { content, artifactName } : null;
  }
  const filters: ArtifactFilters = { specName, artifactType: cliType };
  const local = await fileManager.scanLocalArtifacts(filters);
  if (local.length === 0) return null;
  const first = local[0];
  return { content: first.content, artifactName: first.artifactName };
}

/**
 * Ensure local artifact file exists after push (create if missing).
 * Use artifactId/rootId from server response when available.
 */
export async function ensureLocalArtifactAfterPush(
  fileManager: ArtifactFileManager,
  specName: string,
  mcpType: MCPArtifactType,
  artifactNameOrId: string,
  content: string,
  rootId?: string
): Promise<void> {
  const cliType = mcpToCLIArtifactType(mcpType);
  const name =
    isVersionedArtifactType(cliType) && rootId ? rootId : artifactNameOrId;
  await fileManager.writeArtifactFile({
    specName,
    artifactType: cliType,
    artifactName: name,
    content,
    ...(rootId && { rootId }),
    ...(artifactNameOrId && { artifactId: artifactNameOrId }),
  });
}

/**
 * Read local artifacts for pull (no API). Used by CLI and MCP.
 */
export async function readLocalArtifactsForPull(
  fileManager: ArtifactFileManager,
  filters: ArtifactFilters
): Promise<LocalArtifact[]> {
  return fileManager.scanLocalArtifacts(filters);
}

/**
 * Build ArtifactFilters for a single spec and optional CLI type/name.
 */
export function pullFilters(
  specName: string,
  cliArtifactType?: CLIArtifactType,
  artifactName?: string
): ArtifactFilters {
  return {
    specName,
    artifactType: cliArtifactType,
    artifactName,
  };
}
