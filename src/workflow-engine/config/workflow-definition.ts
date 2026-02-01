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
 * Agile flow order: 1.1 -> 1.2 -> 4.2 -> 2.1 -> 3.1 -> 4.1 -> 5.1 -> 5.2 -> 1.3 -> 3.2 -> 1.4 -> 3.3 -> 1.5 -> 1.6 -> 3.4 -> 3.5 -> 3.6 -> 1.7 -> 7.1 -> 6.1 -> 6.2
 */

export interface WorkflowNodeDef {
  nodeId: string;
  artifactType: string;
  specName: string;
  artifactName: string;
  dependencies: string[];
}

/** Ordered list of node ids in agile flow (deterministic next) */
export const WORKFLOW_NODE_ORDER: string[] = [
  "1.1",
  "1.2",
  "4.2",
  "2.1",
  "3.1",
  "4.1",
  "5.1",
  "5.2",
  "1.3",
  "3.2",
  "1.4",
  "3.3",
  "1.5",
  "1.6",
  "3.4",
  "3.5",
  "3.6",
  "1.7",
  "7.1",
  "6.1",
  "6.2",
];

/** Node definitions: nodeId -> artifact type/spec/name and dependencies */
export const WORKFLOW_NODES: Record<string, WorkflowNodeDef> = {
  "1.1": {
    nodeId: "1.1",
    artifactType: "requirement",
    specName: "default",
    artifactName: "overview",
    dependencies: [],
  },
  "1.2": {
    nodeId: "1.2",
    artifactType: "requirement",
    specName: "default",
    artifactName: "business-functional",
    dependencies: ["1.1"],
  },
  "4.2": {
    nodeId: "4.2",
    artifactType: "flow_diagram",
    specName: "default",
    artifactName: "business-logic-flow",
    dependencies: ["1.2", "2.1"],
  },
  "2.1": {
    nodeId: "2.1",
    artifactType: "hld",
    specName: "default",
    artifactName: "project-architecture",
    dependencies: ["1.1", "1.2"],
  },
  "3.1": {
    nodeId: "3.1",
    artifactType: "lld",
    specName: "default",
    artifactName: "list-screens",
    dependencies: ["1.3"],
  },
  "4.1": {
    nodeId: "4.1",
    artifactType: "flow_diagram",
    specName: "default",
    artifactName: "navigation-tree",
    dependencies: ["3.1"],
  },
  "5.1": {
    nodeId: "5.1",
    artifactType: "wireframe_files",
    specName: "default",
    artifactName: "wireframes-screens",
    dependencies: ["1.3", "3.5", "4.1"],
  },
  "5.2": {
    nodeId: "5.2",
    artifactType: "wireframe_files",
    specName: "default",
    artifactName: "component-wireframes",
    dependencies: ["1.5", "3.3"],
  },
  "1.3": {
    nodeId: "1.3",
    artifactType: "requirement",
    specName: "default",
    artifactName: "acceptance-screens",
    dependencies: ["1.2"],
  },
  "3.2": {
    nodeId: "3.2",
    artifactType: "lld",
    specName: "default",
    artifactName: "list-apis",
    dependencies: ["1.4"],
  },
  "1.4": {
    nodeId: "1.4",
    artifactType: "requirement",
    specName: "default",
    artifactName: "acceptance-apis",
    dependencies: ["1.2"],
  },
  "3.3": {
    nodeId: "3.3",
    artifactType: "lld",
    specName: "default",
    artifactName: "file-tree",
    dependencies: ["2.1", "1.5"],
  },
  "1.5": {
    nodeId: "1.5",
    artifactType: "requirement",
    specName: "default",
    artifactName: "component-requirements",
    dependencies: ["1.2"],
  },
  "1.6": {
    nodeId: "1.6",
    artifactType: "requirement",
    specName: "default",
    artifactName: "acceptance-code-files",
    dependencies: ["1.3", "1.4", "1.5"],
  },
  "3.4": {
    nodeId: "3.4",
    artifactType: "lld",
    specName: "default",
    artifactName: "technical-details-code",
    dependencies: ["1.6", "3.3", "3.4", "3.5"],
  },
  "3.5": {
    nodeId: "3.5",
    artifactType: "lld",
    specName: "default",
    artifactName: "technical-detail-screen",
    dependencies: ["3.1", "3.2", "3.3"],
  },
  "3.6": {
    nodeId: "3.6",
    artifactType: "lld",
    specName: "default",
    artifactName: "technical-detail-api",
    dependencies: ["3.2", "3.3"],
  },
  "1.7": {
    nodeId: "1.7",
    artifactType: "requirement",
    specName: "default",
    artifactName: "phase-milestone",
    dependencies: ["1.1"],
  },
  "7.1": {
    nodeId: "7.1",
    artifactType: "tests",
    specName: "default",
    artifactName: "test-json-api",
    dependencies: ["1.4", "3.2", "3.4", "4.2"],
  },
  "6.1": {
    nodeId: "6.1",
    artifactType: "tasks",
    specName: "default",
    artifactName: "tasks-milestone",
    dependencies: ["2.2", "3.4", "3.5", "5.1", "5.2", "6.1"],
  },
  "6.2": {
    nodeId: "6.2",
    artifactType: "tasks",
    specName: "default",
    artifactName: "subtasks",
    dependencies: ["6.1", "6.2"],
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
 * Returns node id that matches artifact type/spec/name, or undefined.
 */
export function getNodeIdByArtifact(
  artifactType: string,
  specName: string,
  artifactName: string
): string | undefined {
  const spec = specName || "default";
  const nameNorm = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const target = nameNorm(artifactName);
  for (const [nodeId, def] of Object.entries(WORKFLOW_NODES)) {
    if (
      def.artifactType === artifactType &&
      (def.specName || "default") === spec &&
      (def.artifactName === artifactName || nameNorm(def.artifactName) === target)
    ) {
      return nodeId;
    }
  }
  return undefined;
}
