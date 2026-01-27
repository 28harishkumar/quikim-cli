/**
 * Quikim - Artifact Sync Type Definitions
 * 
 * Copyright (c) 2026 Quikim Inc.
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
  | "tasks";

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
  errors: Array<{ artifact: string; error: string }>;
}

export interface PullResult {
  success: boolean;
  pulled: number;
  created: number;
  updated: number;
  errors: Array<{ artifact: string; error: string }>;
}

export interface SyncResult {
  push: PushResult;
  pull: PullResult;
  success: boolean;
}
