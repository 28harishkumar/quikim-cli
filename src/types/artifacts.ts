/**
 * Quikim - Artifact Sync Type Definitions
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

export type ArtifactType =
  | "requirement"
  | "context"
  | "code_guideline"
  | "lld"
  | "hld"
  | "wireframe_files"
  | "flow_diagram"
  | "er_diagram"
  | "tasks";

/** Versioned artifact types: one file per root (filename uses root_id) */
export const VERSIONED_ARTIFACT_TYPES: readonly ArtifactType[] = [
  "requirement",
  "hld",
  "lld",
  "flow_diagram",
  "er_diagram",
  "wireframe_files",
] as const;

export type VersionedArtifactType = (typeof VERSIONED_ARTIFACT_TYPES)[number];

export function isVersionedArtifactType(t: ArtifactType): t is VersionedArtifactType {
  return (VERSIONED_ARTIFACT_TYPES as readonly string[]).includes(t);
}

export type SyncOperation = "push" | "pull" | "sync";

export interface ArtifactFilters {
  artifactType?: ArtifactType;
  specName?: string;
  artifactName?: string;
}

export interface ArtifactMetadata {
  specName: string;
  artifactType: ArtifactType;
  artifactName: string;
  content: string;
  contentHash?: string;
  lastModified?: Date;
}

export interface LocalArtifact extends ArtifactMetadata {
  filePath: string;
}

export interface ServerArtifact extends ArtifactMetadata {
  artifactId: string;
  /** For versioned artifacts, rootId is the chain id (used in filename) */
  rootId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

export interface PullOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

export interface SyncOptions extends PushOptions, PullOptions {}

export interface PushResult {
  success: boolean;
  pushed: number;
  skipped: number;
  errors: Array<{ artifact: string; error: string; version?: number }>;
  versions?: Array<{ artifact: string; version: number }>;
}

export interface PullResult {
  success: boolean;
  pulled: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ artifact: string; error: string }>;
  versions?: Array<{ artifact: string; version: number }>;
}

export interface SyncResult {
  push: PushResult;
  pull: PullResult;
  success: boolean;
}
