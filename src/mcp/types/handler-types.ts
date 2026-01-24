/**
 * Quikim - MCP Handler Types
 * 
 * Copyright (c) 2026 Quikim Inc.
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
  | "mermaid";

export type ToolName = 
  | "push_requirements"
  | "pull_requirements"
  | "push_hld"
  | "pull_hld"
  | "push_lld"
  | "pull_lld"
  | "push_tasks"
  | "pull_tasks"
  | "push_wireframes"
  | "pull_wireframe"
  | "sync_wireframe_from_penpot"
  | "generate_code_from_wireframe"
  | "list_penpot_syncs"
  | "er_diagram_push"
  | "er_diagram_pull"
  | "push_mermaid"
  | "pull_mermaid"
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
}