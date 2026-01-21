/**
 * Core TypeScript interfaces for MCP Cursor Protocol
 * These interfaces define the data models used throughout the system
 */

// FIXED ENUMS - No keyword searching allowed
export type WorkflowType =
  | "requirement_create" // Create new requirements file
  | "requirement_update" // Update existing requirements
  | "wireframe_create" // Create new wireframes
  | "wireframe_update" // Update existing wireframes
  | "er_diagram_create" // Create new ER diagram
  | "er_diagram_update" // Update existing ER diagram
  | "prisma_schema_create" // Create new Prisma schema
  | "prisma_schema_update" // Update existing Prisma schema
  | "hld_create" // Create new HLD
  | "hld_update" // Update existing HLD
  | "tasks_create" // Create new tasks file
  | "tasks_update" // Update existing tasks
  | "code_implementation" // Implement code
  | "bug_fix" // Fix a bug
  | "question"; // User question

export type ArtifactType =
  | "requirements"
  | "wireframes"
  | "er-diagram"
  | "prisma-schema"
  | "hld"
  | "tasks"
  | "code";

export interface ArtifactVersion {
  type: ArtifactType;
  version: number; // 1, 2, 3, etc.
  file_path: string; // e.g., ".quikim/v1/requirements.md"
  exists: boolean;
}

export interface PromptAnalysis {
  workflow_type: WorkflowType;
  requested_artifact: ArtifactType | null;
  is_create: boolean; // true for create, false for update
  is_new_project: boolean;
  has_quikim_directory: boolean;
  existing_artifact_versions: ArtifactVersion[]; // All artifacts across all versions
  latest_version: number | null; // Latest version directory (1, 2, 3, etc.)
  artifacts_in_latest_version: ArtifactType[]; // Which artifacts exist in latest version
}

export interface XMLRequest {
  type: "user_request" | "workflow_response";
  requestId: string;
  userPrompt?: string;
  analysis?: PromptAnalysis; // NEW - structured analysis from Cursor
  codebase?: CodebaseContext;
  executionResult?: ExecutionResult;
}

export interface QuikimFile {
  path: string;
  content: string;
}

export interface CodeSnippet {
  file_path: string;
  content: string;
  description?: string;
}

export interface XMLResponse {
  requestId: string;
  action: ActionType;
  instructions: string;
  parameters: ActionParameters;
  reasoning: string;
  finalResponse?: string;
  // Extended fields for Quikim tools
  quikimFiles?: QuikimFile[]; // For Pull tools and Update code
  codeGuidelines?: string[]; // For Update code tool
  sampleSnippets?: CodeSnippet[]; // For Update code tool (RAG pipeline results)
}

export interface ActionParameters {
  files?: string[];
  command?: string;
  content?: string;
  filePath?: string;
}

export interface DecisionContext {
  codebase: CodebaseContext;
  userPrompt: string;
  analysis: PromptAnalysis; // NEW - required analysis from Cursor
  actionHistory: ActionHistory[];
  requestCount: number;
  maxRequests: number;
}

// DEPRECATED - Remove old analysis interface
export interface AnalysisResult {
  detectedTechnologies: string[];
  techStack?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    mobile?: string[];
  };
  projectType: string;
  suggestedActions: ActionType[];
  confidence: number;
  requiresMoreInfo: boolean;
  missingInfo?: string[];
}

// Re-export session types for convenience
export * from './session/types.js';

export type ActionType =
  | "read_files"
  | "create_file"
  | "modify_file"
  | "run_command"
  | "complete"
  | "request_info";

// Import session types to use in other interfaces
import {
  CodebaseContext,
  ActionHistory,
  ExecutionResult,
} from './session/types.js';
