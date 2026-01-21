/**
 * API Types for Quikim Platform Integration
 * Defines interfaces for communication with Quikim backend services
 */

export interface APIConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Project Artifacts
export interface Requirements {
  id: string;
  projectId: string;
  version: number;
  content: string;
  quikimFeatures: string[];
  customFeatures: string[];
  createdAt: string;
}

export interface HLD {
  id: string;
  projectId: string;
  version: number;
  content: string;
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    mobile: string[];
  };
  architecture: {
    pattern: string;
    structure: Record<string, string>;
  };
  createdAt: string;
}

export interface LLD {
  id: string;
  projectId: string;
  version: number;
  content: string;
  componentName: string;
  componentType: "service" | "module" | "feature" | "api" | "ui" | "database" | "other";
  specifications: {
    interfaces: LLDInterface[];
    dataModels: LLDDataModel[];
    methods: LLDMethod[];
    dependencies: string[];
  };
  sequenceDiagrams?: string[];
  classDiagrams?: string[];
  linkedHldSection?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LLDInterface {
  name: string;
  description: string;
  methods: Array<{
    name: string;
    parameters: Array<{ name: string; type: string }>;
    returnType: string;
    description: string;
  }>;
}

export interface LLDDataModel {
  name: string;
  description: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

export interface LLDMethod {
  name: string;
  signature: string;
  description: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: { type: string; description: string };
  pseudocode?: string;
  complexity?: string;
}

export interface Tasks {
  id: string;
  projectId: string;
  version: number;
  content: string;
  milestones: Milestone[];
  createdAt: string;
}

export interface Milestone {
  id: string;
  name: string;
  deadline: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  description: string;
  estimatedHours: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ERDiagram {
  id: string;
  projectId: string;
  version: number;
  content: string;
  entities: Entity[];
  createdAt: string;
}

export interface Entity {
  name: string;
  source: 'quikim' | 'custom';
  fields: Field[];
}

export interface Field {
  name: string;
  type: string;
  required: boolean;
}

export interface PrismaSchema {
  id: string;
  projectId: string;
  version: number;
  content: string;
  generatedFrom: string;
  createdAt: string;
}

export type MermaidDiagramType = "flowchart" | "sequence" | "classDiagram" | "stateDiagram" | "erDiagram" | "gantt" | "pie" | "mindmap" | "timeline" | "journey" | "other";

export interface MermaidDiagram {
  id: string;
  projectId: string;
  version: number;
  content: string;
  diagramType: MermaidDiagramType;
  name: string;
  description?: string;
  linkedArtifact?: {
    type: "hld" | "requirements" | "wireframes" | "tasks";
    id: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Wireframe {
  id: string;
  projectId: string;
  version: number;
  penpotFileId: string;
  penpotPageIds: string[];
  metadata: {
    componentType: 'website' | 'portal' | 'mobile';
    componentName: string;
  };
  createdAt: string;
}

export interface Theme {
  id: string;
  projectId: string;
  version: number;
  content: string;
  createdAt: string;
}

export interface CodeGuidelines {
  id: string;
  projectId: string;
  version: number;
  content: string;
  createdAt: string;
}

// Request Queue
export interface QueuedRequest {
  id: string;
  projectId: string;
  type: 'wireframe' | 'er_diagram' | 'prisma_schema' | 'hld' | 'tasks' | 'code_generation';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  context: Record<string, any>;
  result?: any;
  createdAt: string;
  updatedAt: string;
}

// LLM Integration
export interface LLMKeyStatus {
  integrated: boolean;
  provider?: 'openai' | 'anthropic';
  hasKeys: boolean;
}

// Sync Operations
export interface SyncRequest {
  projectId: string;
  artifactType: "requirements" | "hld" | "lld" | "tasks" | "er_diagram" | "prisma_schema" | "wireframes" | "theme" | "code_guidelines" | "mermaid";
  content: string;
  version?: number;
  metadata?: Record<string, unknown>;
}

export interface SyncResponse {
  success: boolean;
  artifactId: string;
  version: number;
  message?: string;
  wireframeId?: string;
  erDiagramId?: string;
  taskId?: string;
  mermaidDiagramId?: string;
  lldId?: string;
}
