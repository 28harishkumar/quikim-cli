/**
 * Quikim - Workflow Definition (Canonical Nodes)
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Canonical workflow nodes and dependencies from interlinking.md.
 * Agile flow order: 1.1 -> 1.2 -> 4.2 -> 2.1 -> ... -> 1.7 -> 1.3 -> 2.2 -> ... -> 6.2
 *
 * Optional nodes: 1.2, 4.2, 5.1, 5.2 can be skipped, added later, or completed normally.
 */

export interface WorkflowNodeDef {
  nodeId: string;
  artifactType: string;
  specName: string;
  artifactName: string;
  dependencies: string[];
  usedBy: string[];
  label: string;
  category: string;
  /** If true, this node is optional and can be skipped */
  isOptional?: boolean;
  /** If true, match any artifact in this spec (name may be UUID) */
  anyInSpec?: boolean;
  /** If true, multiple files per spec (e.g. acceptance criteria) */
  multiFile?: boolean;
  /** If true, suggest creating another only when user asks */
  createOnlyIfUserAsks?: boolean;
}

/** Ordered list of node ids in agile flow (deterministic next) */
export const WORKFLOW_NODE_ORDER: string[] = [
  "1.1",  // Project Overview
  "1.2",  // Business & Functional Requirements (OPTIONAL)
  "4.2",  // Business logic flow charts (OPTIONAL)
  "2.1",  // HLD - (high level design)
  "3.1",  // LLD - (low level design)
  "4.1",  // Navigation tree for all screens
  "1.7",  // Phase & milestone breakdown
  "1.3",  // Acceptance criteria – Screens (moved: after 1.7, before 2.2)
  "2.2",  // Milestones/Specs
  "5.1",  // Wireframes for each screen (OPTIONAL)
  "5.2",  // Component wireframes (OPTIONAL)
  "3.2",  // Code Architecture
  "1.4",  // User stories
  "3.3",  // LLD - (code plan)
  "1.5",  // Acceptance criteria
  "1.6",  // Test scenarios
  "3.5",  // LLD - (code file listing - header/interface only)
  "3.6",  // LLD - (code file listing - implementation)
  "3.4",  // Technical details per code file (moved: after 3.6 for better implementation flow)
  "7.1",  // Test artifact
  "6.1",  // Tasks per milestone
  "6.2",  // Subtasks
];

/**
 * Node definitions aligned with workflow-service (workflow_definition.py).
 * Spec names must match so artifacts are recognized when resolving completed nodes.
 */
export const WORKFLOW_NODES: Record<string, WorkflowNodeDef> = {
  "1.1": {
    nodeId: "1.1",
    artifactType: "requirement",
    specName: "overview",
    artifactName: "overview",
    dependencies: [],
    usedBy: ["1.2", "1.6", "2.1", "1.7"],
    label: "Overview",
    category: "requirements",
    anyInSpec: true,
  },
  "1.2": {
    nodeId: "1.2",
    artifactType: "requirement",
    specName: "business-functional",
    artifactName: "business-functional",
    dependencies: ["1.1"],
    usedBy: ["1.3", "1.4", "1.5", "2.1", "4.2"],
    label: "Business & Functional Requirements",
    category: "requirements",
    anyInSpec: true,
    createOnlyIfUserAsks: true,
    isOptional: true,
  },
  "4.2": {
    nodeId: "4.2",
    artifactType: "flow_diagram",
    specName: "business-logic-flow",
    artifactName: "business-logic-flow",
    dependencies: ["1.2", "2.1"],
    usedBy: ["3.4", "6.1", "7.1"],
    label: "Business logic flow charts",
    category: "flow_diagram",
    anyInSpec: true,
    isOptional: true,
  },
  "2.1": {
    nodeId: "2.1",
    artifactType: "hld",
    specName: "project-architecture",
    artifactName: "project-architecture",
    dependencies: ["1.1", "1.2"],
    usedBy: ["3.3", "3.4", "4.2"],
    label: "Project architecture",
    category: "hld",
    anyInSpec: true,
  },
  "2.2": {
    nodeId: "2.2",
    artifactType: "hld",
    specName: "milestones-specs",
    artifactName: "milestones-specs",
    dependencies: ["1.7", "1.3"],
    usedBy: ["6.1"],
    label: "Milestones / Specs",
    category: "hld",
    anyInSpec: true,
  },
  "3.1": {
    nodeId: "3.1",
    artifactType: "lld",
    specName: "list-screens",
    artifactName: "list-screens",
    dependencies: ["1.3"],
    usedBy: ["3.5", "4.1", "5.1"],
    label: "List of all screens",
    category: "lld",
    anyInSpec: true,
  },
  "4.1": {
    nodeId: "4.1",
    artifactType: "flow_diagram",
    specName: "navigation-tree",
    artifactName: "navigation-tree",
    dependencies: ["3.1"],
    usedBy: ["5.1", "6.1"],
    label: "Navigation tree for all screens",
    category: "flow_diagram",
    anyInSpec: true,
  },
  "5.1": {
    nodeId: "5.1",
    artifactType: "wireframe_files",
    specName: "wireframes-screens",
    artifactName: "wireframes-screens",
    dependencies: ["1.3", "3.5", "4.1"],
    usedBy: ["6.1", "7.1"],
    label: "Wireframes for each screen",
    category: "wireframe",
    anyInSpec: true,
    isOptional: true,
  },
  "5.2": {
    nodeId: "5.2",
    artifactType: "wireframe_files",
    specName: "component-wireframes",
    artifactName: "component-wireframes",
    dependencies: ["1.5", "3.3"],
    usedBy: ["5.1", "6.1"],
    label: "Component wireframes",
    category: "wireframe",
    anyInSpec: true,
    isOptional: true,
  },
  "1.3": {
    nodeId: "1.3",
    artifactType: "requirement",
    specName: "acceptance-criteria-screens",
    artifactName: "acceptance-screens",
    dependencies: ["1.7"],
    usedBy: ["3.1", "3.5", "4.1", "5.1", "1.6", "2.2"],
    label: "Acceptance criteria – Screens",
    category: "requirements",
    multiFile: true,
  },
  "3.2": {
    nodeId: "3.2",
    artifactType: "lld",
    specName: "list-apis",
    artifactName: "list-apis",
    dependencies: ["1.4"],
    usedBy: ["3.6", "7.1", "3.5"],
    label: "List of all APIs",
    category: "lld",
    anyInSpec: true,
  },
  "1.4": {
    nodeId: "1.4",
    artifactType: "requirement",
    specName: "acceptance-criteria-apis",
    artifactName: "acceptance-apis",
    dependencies: ["1.2"],
    usedBy: ["3.2", "3.6", "7.1", "1.6"],
    label: "Acceptance criteria – APIs",
    category: "requirements",
    multiFile: true,
  },
  "3.3": {
    nodeId: "3.3",
    artifactType: "lld",
    specName: "file-tree",
    artifactName: "file-tree",
    dependencies: ["2.1", "1.5"],
    usedBy: ["3.4", "3.5", "3.6", "5.2"],
    label: "File tree (all code files)",
    category: "lld",
    anyInSpec: true,
  },
  "1.5": {
    nodeId: "1.5",
    artifactType: "requirement",
    specName: "component-requirements",
    artifactName: "component-requirements",
    dependencies: ["1.2"],
    usedBy: ["3.3", "5.2", "1.6"],
    label: "Component requirements",
    category: "requirements",
    multiFile: true,
  },
  "1.6": {
    nodeId: "1.6",
    artifactType: "requirement",
    specName: "acceptance-criteria-code-files",
    artifactName: "acceptance-code-files",
    dependencies: ["1.3", "1.4", "1.5"],
    usedBy: ["3.4"],
    label: "Acceptance criteria – Code files",
    category: "requirements",
    multiFile: true,
  },
  "3.4": {
    nodeId: "3.4",
    artifactType: "lld",
    specName: "technical-details-code",
    artifactName: "technical-details-code",
    dependencies: ["1.6", "3.3", "3.4", "3.5"],
    usedBy: ["6.1", "7.1"],
    label: "Technical details per code file",
    category: "lld",
    anyInSpec: true,
  },
  "3.5": {
    nodeId: "3.5",
    artifactType: "lld",
    specName: "technical-detail-screen",
    artifactName: "technical-detail-screen",
    dependencies: ["3.1", "3.2", "3.3"],
    usedBy: ["5.1", "6.1", "3.4"],
    label: "Technical detail per screen",
    category: "lld",
    anyInSpec: true,
  },
  "3.6": {
    nodeId: "3.6",
    artifactType: "lld",
    specName: "technical-detail-api",
    artifactName: "technical-detail-api",
    dependencies: ["3.2", "3.3"],
    usedBy: ["3.4", "7.1"],
    label: "Technical detail per API",
    category: "lld",
    anyInSpec: true,
  },
  "1.7": {
    nodeId: "1.7",
    artifactType: "requirement",
    specName: "phase-milestone-breakdown",
    artifactName: "phase-milestone",
    dependencies: ["1.1"],
    usedBy: ["2.2", "6.1", "1.3"],
    label: "Phase & milestone breakdown",
    category: "requirements",
    anyInSpec: true,
  },
  "7.1": {
    nodeId: "7.1",
    artifactType: "tests",
    specName: "test-json-api",
    artifactName: "test-json-api",
    dependencies: ["1.4", "3.2", "3.4", "4.2"],
    usedBy: [],
    label: "Test json for each API",
    category: "tests",
  },
  "6.1": {
    nodeId: "6.1",
    artifactType: "tasks",
    specName: "tasks-milestone",
    artifactName: "tasks-milestone",
    dependencies: ["2.2", "3.4", "3.5", "5.1", "5.2", "6.1"],
    usedBy: ["6.2"],
    label: "Tasks (grouped by milestone)",
    category: "tasks",
  },
  "6.2": {
    nodeId: "6.2",
    artifactType: "tasks",
    specName: "subtasks",
    artifactName: "subtasks",
    dependencies: ["6.1", "6.2"],
    usedBy: [],
    label: "Subtasks",
    category: "tasks",
  },
};

/**
 * Returns the next node id in agile order after the given node, or null if none.
 */
export function getNextNodeId(currentNodeId: string | null): string | null {
  if (!currentNodeId) return WORKFLOW_NODE_ORDER[0] ?? null;
  const idx = WORKFLOW_NODE_ORDER.indexOf(currentNodeId);
  if (idx < 0 || idx >= WORKFLOW_NODE_ORDER.length - 1) return null;
  return WORKFLOW_NODE_ORDER[idx + 1] ?? null;
}

/**
 * Returns the node definition for a node id.
 */
export function getNodeDef(nodeId: string): WorkflowNodeDef | undefined {
  return WORKFLOW_NODES[nodeId];
}

/**
 * Returns true if the node is optional (can be skipped).
 */
export function isNodeOptional(nodeId: string): boolean {
  const def = WORKFLOW_NODES[nodeId];
  return Boolean(def?.isOptional);
}

/**
 * Returns node id that matches artifact type/spec/name, or undefined.
 */
export function getNodeIdByArtifact(
  artifactType: string,
  specName: string,
  artifactName: string,
): string | undefined {
  const spec = specName || "default";
  const nameNorm = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const target = nameNorm(artifactName);
  for (const [nodeId, def] of Object.entries(WORKFLOW_NODES)) {
    if (def.artifactType !== artifactType) continue;
    if ((def.specName || "default") !== spec) continue;
    if (def.multiFile || def.anyInSpec) {
      return nodeId;
    }
    if (def.artifactName === artifactName || nameNorm(def.artifactName) === target) {
      return nodeId;
    }
  }
  return undefined;
}
