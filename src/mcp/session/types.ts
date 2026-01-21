/**
 * Session management types and interfaces
 */

export interface WorkflowSession {
  sessionId: string;
  userPrompt: string;
  requestCount: number;
  maxRequests: number;
  startTime: Date;
  actions: ActionHistory[];
  currentContext: CodebaseContext;
  status: SessionStatus;
  lastActivity: Date;
}

export interface CodebaseContext {
  files: FileInfo[];
  detectedTechnology: string[];
  projectStructure: ProjectStructure;
  lastAnalysis: Date;
}

export interface FileInfo {
  path: string;
  content: string;
  size: number;
  lastModified: Date;
  type: string;
}

export interface ProjectStructure {
  rootPath: string;
  directories: string[];
  fileTypes: Record<string, number>;
  packageFiles: string[];
  configFiles: string[];
}

export interface ActionHistory {
  action: string;
  instructions: string;
  executionResult: ExecutionResult;
  timestamp: Date;
  reasoning: string;
  requestId: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  filesModified: string[];
  duration: number;
}

export type SessionStatus = 'active' | 'completed' | 'error' | 'limit_reached';

export interface SessionSummary {
  sessionId: string;
  userPrompt: string;
  totalRequests: number;
  completedActions: number;
  status: SessionStatus;
  startTime: Date;
  endTime: Date;
  duration: number;
  filesModified: string[];
  errors: string[];
}