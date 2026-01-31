/**
 * Quikim - MCP Handler Types
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

export type ArtifactType =
  | "requirements"
  | "hld"
  | "lld"
  | "tasks"
  | "wireframes"
  | "er_diagram"
  | "mermaid"
  | "context"
  | "code_guideline"
  | "tests";

export type ToolName =
  | "generate_requirements"
  | "pull_requirements"
  | "generate_tests"
  | "pull_tests"
  | "generate_hld"
  | "pull_hld"
  | "generate_lld"
  | "pull_lld"
  | "generate_tasks"
  | "pull_tasks"
  | "generate_wireframes"
  | "pull_wireframe"
  | "sync_wireframe_from_penpot"
  | "generate_code_from_wireframe"
  | "list_penpot_syncs"
  | "er_diagram_push"
  | "er_diagram_pull"
  | "generate_mermaid"
  | "pull_mermaid"
  | "generate_context"
  | "pull_context"
  | "generate_code_guideline"
  | "pull_code_guideline"
  | "update_code"
  | "pull_rules";

export interface HandlerResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface APICallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface FileContent {
  path: string;
  content: string | unknown[] | { text: string };
}

export interface ProjectData {
  projectId: string;
  organizationId?: string;
  userId?: string;
  specName?: string;
}