/**
 * Quikim - MCP Prompts for Capability Exposure
 * 
 * This module exposes MCP server capabilities through the MCP prompts protocol.
 * LLMs can discover available tools and their usage without needing cursor rules.
 * 
 * IMPORTANT: This file defines ALL 22 artifact specs and their boundaries.
 * Each artifact type has specific content that should/should NOT be included.
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * Licensed under the AGPL-3.0 License.
 */

import { Prompt } from "@modelcontextprotocol/sdk/types.js";
import { ALL_ARTIFACT_SPECS } from "../utils/constants.js";

export interface QuikimCapability {
  name: string;
  description: string;
  category: "requirements" | "design" | "tasks" | "code" | "sync";
  toolName: string;
  usage: string;
  examples: string[];
  prerequisites?: string[];
  outputs?: string[];
  include?: string[];
  exclude?: string[];
}

export const QUIKIM_CAPABILITIES: QuikimCapability[] = [
  // Requirements (1.x)
  {
    name: "Generate Requirements",
    description: "Create requirement artifacts (1.1-1.7) for project scope, business rules, and acceptance criteria",
    category: "requirements",
    toolName: "generate_requirements",
    usage: "Use to create requirement artifacts. For 1.3-1.6, create ONE FILE PER ENTITY.",
    examples: [
      "Create project overview (1.1)",
      "Generate business requirements (1.2)",
      "Create acceptance criteria for login screen (1.3)",
    ],
    outputs: [".quikim/artifacts/<spec>/requirement_<name>.md"],
    include: [
      "Project scope, purpose, stakeholders (1.1)",
      "Business rules, user stories (1.2)",
      "Screen acceptance criteria (1.3)",
      "API acceptance criteria (1.4)",
      "Component requirements (1.5)",
      "Code file acceptance criteria (1.6)",
      "Milestones and phases (1.7)",
    ],
    exclude: [
      "Implementation details → LLD 3.x",
      "UI layouts → Wireframes 5.x",
      "Code structure → LLD 3.3, 3.4",
      "Architecture decisions → HLD 2.x",
    ],
  },
  {
    name: "Pull Requirements",
    description: "Read requirements from local files or fetch from server",
    category: "requirements",
    toolName: "pull_requirements",
    usage: "Read from .quikim/artifacts/<spec>/requirement_*.md",
    examples: ["Sync requirements from server"],
    outputs: [".quikim/artifacts/<spec>/requirement_<id>.md"],
  },

  // HLD (2.x)
  {
    name: "Generate HLD",
    description: "Create High-Level Design artifacts (2.1-2.2) for system architecture and delivery planning",
    category: "design",
    toolName: "generate_hld",
    usage: "Use to define system architecture. DO NOT include API details or code structure.",
    examples: [
      "Create project architecture (2.1)",
      "Generate milestone specs (2.2)",
    ],
    prerequisites: ["Requirements (1.x) should exist first"],
    outputs: [".quikim/artifacts/<spec>/hld_<id>.md"],
    include: [
      "System components and boundaries",
      "Technology stack with justifications",
      "Module/service decomposition (high-level)",
      "Deployment topology",
      "Integration points",
      "Key architectural decisions",
    ],
    exclude: [
      "API endpoints with request/response → LLD 3.2, 3.6",
      "Screen layouts → Wireframes 5.x",
      "File-level code structure → LLD 3.3, 3.4",
      "Database schemas → ER Diagram",
      "Implementation code",
    ],
  },
  {
    name: "Pull HLD",
    description: "Read HLD from local files or fetch from server",
    category: "design",
    toolName: "pull_hld",
    usage: "Read from .quikim/artifacts/<spec>/hld_*.md",
    examples: ["Sync HLD from server"],
    outputs: [".quikim/artifacts/<spec>/hld_<id>.md"],
  },

  // LLD (3.x)
  {
    name: "Generate LLD",
    description: "Create Low-Level Design artifacts (3.1-3.6) for detailed technical specifications",
    category: "design",
    toolName: "generate_lld",
    usage: "Use for detailed specs. Each LLD spec has DIFFERENT content - see boundaries below.",
    examples: [
      "Create list of screens (3.1)",
      "Generate API inventory (3.2)",
      "Create file tree (3.3)",
      "Generate technical details per file (3.4)",
    ],
    prerequisites: ["HLD (2.x) should exist first"],
    outputs: [".quikim/artifacts/<spec>/lld_<id>.md"],
    include: [
      "3.1 list-screens: Screen inventory with IDs, entry/exit points",
      "3.2 list-apis: API inventory with methods, paths, shapes",
      "3.3 file-tree: Directory structure, file paths",
      "3.4 technical-details-code: Per-file exports, dependencies, behavior",
      "3.5 technical-detail-screen: Screen-API-Code traceability",
      "3.6 technical-detail-api: API-handler-service mapping",
    ],
    exclude: [
      "Full wireframes → 5.x Wireframes",
      "Full source code → Actual files",
      "Business requirements → 1.x Requirements",
      "Architecture decisions → 2.x HLD",
    ],
  },
  {
    name: "Pull LLD",
    description: "Read LLD from local files or fetch from server",
    category: "design",
    toolName: "pull_lld",
    usage: "Read from .quikim/artifacts/<spec>/lld_*.md",
    examples: ["Sync LLD from server"],
    outputs: [".quikim/artifacts/<spec>/lld_<id>.md"],
  },

  // Flow Diagrams (4.x)
  {
    name: "Generate Mermaid/Flow",
    description: "Create flow diagrams (4.1-4.2) for navigation and business logic",
    category: "design",
    toolName: "generate_mermaid",
    usage: "Content must be RAW mermaid syntax only (no code fences)",
    examples: [
      "Create navigation tree (4.1)",
      "Generate business logic flow (4.2)",
    ],
    prerequisites: ["LLD list-screens (3.1) should exist first"],
    outputs: [".quikim/artifacts/<spec>/flow_diagram_<id>.md"],
    include: [
      "4.1 navigation-tree: Screen-to-screen paths, navigation graph",
      "4.2 business-logic-flow: Process flowcharts, decision trees",
    ],
    exclude: [
      "Implementation details → LLD 3.x",
      "API specs → LLD 3.2, 3.6",
      "Wireframe layouts → 5.x",
    ],
  },
  {
    name: "Pull Mermaid",
    description: "Read flow diagrams from local files or fetch from server",
    category: "design",
    toolName: "pull_mermaid",
    usage: "Read from .quikim/artifacts/<spec>/flow_diagram_*.md",
    examples: ["Sync flow diagrams from server"],
    outputs: [".quikim/artifacts/<spec>/flow_diagram_<id>.md"],
  },

  // Wireframes (5.x)
  {
    name: "Generate Wireframes",
    description: "Create wireframe artifacts (5.1-5.2) for visual layouts",
    category: "design",
    toolName: "generate_wireframes",
    usage: "Content: JSON { name, viewport, elements } or empty",
    examples: [
      "Create wireframes for login screen (5.1)",
      "Generate component wireframes (5.2)",
    ],
    prerequisites: ["LLD list-screens (3.1) should exist first"],
    outputs: [".quikim/artifacts/<spec>/wireframe_files_<id>.md"],
    include: [
      "5.1 wireframes-screens: Visual layouts per screen",
      "5.2 component-wireframes: Reusable UI component designs",
    ],
    exclude: [
      "API details → LLD 3.2, 3.6",
      "Business logic → 4.x Flows",
      "Code structure → LLD 3.x",
    ],
  },
  {
    name: "Pull Wireframe",
    description: "Read wireframes from local files or fetch from server",
    category: "design",
    toolName: "pull_wireframe",
    usage: "Read from .quikim/artifacts/<spec>/wireframe_files_*.md",
    examples: ["Sync wireframes from server"],
    outputs: [".quikim/artifacts/<spec>/wireframe_files_<id>.md"],
  },

  // Tasks (6.x)
  {
    name: "Generate Tasks",
    description: "Create task artifacts (6.1-6.2) for work breakdown",
    category: "tasks",
    toolName: "generate_tasks",
    usage: "Content: Markdown with YAML frontmatter, ## sections for Description, Subtasks, etc.",
    examples: [
      "Create tasks for milestone 1 (6.1)",
      "Generate subtasks for auth feature (6.2)",
    ],
    prerequisites: ["LLD (3.x) should exist for accurate task scoping"],
    outputs: [".quikim/artifacts/<spec>/tasks_<id>.md"],
    include: [
      "6.1 tasks-milestone: Tasks grouped by milestone with priorities",
      "6.2 subtasks: Detailed work items with acceptance criteria",
    ],
    exclude: [
      "Detailed implementation → Source files",
      "Wireframes → 5.x",
      "Architecture → 2.x HLD",
    ],
  },
  {
    name: "Pull Tasks",
    description: "Read tasks from local files or fetch from server",
    category: "tasks",
    toolName: "pull_tasks",
    usage: "Read from .quikim/artifacts/<spec>/tasks_*.md",
    examples: ["Sync tasks from server"],
    outputs: [".quikim/artifacts/<spec>/tasks_<id>.md"],
  },

  // Tests (7.x)
  {
    name: "Generate Tests",
    description: "Create test artifacts (7.1) for API test cases",
    category: "code",
    toolName: "generate_tests",
    usage: "JSON with description, sampleInputOutput, inputDescription, outputDescription",
    examples: [
      "Create test cases for auth API (7.1)",
    ],
    prerequisites: ["LLD list-apis (3.2) should exist first"],
    outputs: [".quikim/artifacts/<spec>/tests_<id>.md"],
    include: [
      "7.1 test-json-api: Input/output test cases per API endpoint",
    ],
    exclude: [
      "Implementation code → Source files",
      "Wireframes → 5.x",
    ],
  },
  {
    name: "Pull Tests",
    description: "Read tests from local files or fetch from server",
    category: "code",
    toolName: "pull_tests",
    usage: "Read from .quikim/artifacts/<spec>/tests_*.md",
    examples: ["Sync tests from server"],
    outputs: [".quikim/artifacts/<spec>/tests_<id>.md"],
  },

  // ER Diagrams
  {
    name: "Push ER Diagram",
    description: "Create ER diagram for database schema",
    category: "design",
    toolName: "er_diagram_push",
    usage: "Content: RAW mermaid erDiagram syntax only (no code fences)",
    examples: ["Create database ER diagram"],
    prerequisites: ["HLD (2.x) and LLD (3.x) recommended"],
    outputs: [".quikim/artifacts/<spec>/er_diagram_<id>.md"],
  },
  {
    name: "Pull ER Diagram",
    description: "Read ER diagram from local files or fetch from server",
    category: "design",
    toolName: "er_diagram_pull",
    usage: "Read from .quikim/artifacts/<spec>/er_diagram_*.md",
    examples: ["Sync ER diagram from server"],
    outputs: [".quikim/artifacts/<spec>/er_diagram_<id>.md"],
  },

  // Code & Sync
  {
    name: "Update Code",
    description: "Get code guidelines and implementation instructions from RAG pipeline",
    category: "code",
    toolName: "update_code",
    usage: "Use when implementing features based on requirements and design",
    examples: ["Implement authentication feature"],
    prerequisites: ["Requirements, HLD, LLD, and Tasks should exist"],
    outputs: ["Source code files"],
  },
  {
    name: "Parse Codebase AST",
    description: "Parse existing code into AST summaries for technical documentation",
    category: "code",
    toolName: "parse_codebase_ast",
    usage: "Use to analyze existing codebase structure for LLD 3.4 generation",
    examples: [
      "Parse src/**/*.ts for technical details",
      "Generate AST summary for auth service",
    ],
  },
  {
    name: "Pull Rules",
    description: "Update local Quikim cursor rules files",
    category: "sync",
    toolName: "pull_rules",
    usage: "Sync cursor rules from server",
    examples: ["Update cursor rules"],
    outputs: [".cursor/rules/quikim.md"],
  },
];

/**
 * Generate MCP prompts from capabilities
 */
export function generateMCPPrompts(): Prompt[] {
  const prompts: Prompt[] = [
    {
      name: "quikim-capabilities",
      description: "Discover all available Quikim MCP tools and how to use them",
      arguments: [],
    },
    {
      name: "quikim-all-specs",
      description: "Get the complete list of all 22 artifact specs with boundaries",
      arguments: [],
    },
    {
      name: "quikim-workflow",
      description: "Understand the recommended Quikim artifact creation workflow",
      arguments: [],
    },
    {
      name: "quikim-artifact-boundaries",
      description: "Understand what content belongs in each artifact type",
      arguments: [
        {
          name: "artifact_type",
          description: "Artifact type (requirement, hld, lld, wireframe, task, test, flow)",
          required: false,
        },
      ],
    },
  ];

  return prompts;
}

/**
 * Get prompt content by name
 */
export function getPromptContent(
  promptName: string,
  args?: Record<string, string>
): string {
  switch (promptName) {
    case "quikim-capabilities":
      return generateCapabilitiesContent();
    case "quikim-all-specs":
      return generateAllSpecsContent();
    case "quikim-workflow":
      return generateWorkflowContent();
    case "quikim-artifact-boundaries":
      return generateBoundariesContent(args?.artifact_type);
    default:
      return `Unknown prompt: ${promptName}`;
  }
}

function generateCapabilitiesContent(): string {
  let content = `# Quikim MCP Server - All 22 Artifact Specs

## 📋 IMPORTANT: Call get_workflow_instruction BEFORE generating any artifact!

This ensures you have the correct skill content and context artifacts.

## Quick Reference - All 22 Specs

| Category | Node | Spec Name | Purpose |
|----------|------|-----------|---------|
`;

  for (const spec of ALL_ARTIFACT_SPECS) {
    content += `| ${spec.category} | ${spec.nodeId} | \`${spec.value}\` | ${spec.description} |\n`;
  }

  content += `
## Tool to Spec Mapping

| Tool | Artifact Types | Spec Names |
|------|---------------|------------|
| generate_requirements | requirement | overview, business-functional, acceptance-criteria-screens, acceptance-criteria-apis, component-requirements, acceptance-criteria-code-files, phase-milestone-breakdown |
| generate_hld | hld | project-architecture, milestones-specs |
| generate_lld | lld | list-screens, list-apis, file-tree, technical-details-code, technical-detail-screen, technical-detail-api |
| generate_mermaid | flow_diagram | navigation-tree, business-logic-flow |
| generate_wireframes | wireframe_files | wireframes-screens, component-wireframes |
| generate_tasks | tasks | tasks-milestone, subtasks |
| generate_tests | tests | test-json-api |

## Workflow Order

\`\`\`
1.x Requirements → 2.x HLD → 3.x LLD → 4.x Flows → 5.x Wireframes → 6.x Tasks → 7.x Tests
\`\`\`

## Critical Rules

1. **Always call get_workflow_instruction first** to get skill content
2. **Never mix content between artifact types** - each has explicit boundaries
3. **For 1.3-1.6, create ONE FILE PER ENTITY** (per screen, per API, etc.)
4. **HLD ≠ LLD**: HLD is high-level architecture, LLD is detailed specs
5. **3.1 ≠ 5.1**: 3.1 is screen LIST (LLD), 5.1 is screen WIREFRAMES
`;

  return content;
}

function generateAllSpecsContent(): string {
  let content = `# All 22 Quikim Artifact Specs

## Requirements (1.x) - WHAT to build

| Node | Spec | Description |
|------|------|-------------|
| 1.1 | overview | Project scope, purpose, stakeholders, success criteria |
| 1.2 | business-functional | Business rules, user stories, functional requirements |
| 1.3 | acceptance-criteria-screens | One file PER SCREEN with acceptance criteria |
| 1.4 | acceptance-criteria-apis | One file PER API with acceptance criteria |
| 1.5 | component-requirements | One file PER COMPONENT with requirements |
| 1.6 | acceptance-criteria-code-files | One file PER CODE MODULE |
| 1.7 | phase-milestone-breakdown | Delivery phases, milestones, timeline |

## HLD (2.x) - HOW it's structured (high-level)

| Node | Spec | Description |
|------|------|-------------|
| 2.1 | project-architecture | System components, tech stack, deployment topology |
| 2.2 | milestones-specs | Delivery schedule, spec boundaries per milestone |

## LLD (3.x) - HOW it's built (detailed)

| Node | Spec | Description |
|------|------|-------------|
| 3.1 | list-screens | Screen inventory with IDs, entry/exit points |
| 3.2 | list-apis | API inventory with methods, paths, request/response |
| 3.3 | file-tree | Directory structure, file paths, naming |
| 3.4 | technical-details-code | Per-file exports, dependencies, behavior |
| 3.5 | technical-detail-screen | Screen-API-Code traceability matrix |
| 3.6 | technical-detail-api | API-handler-service mapping |

## Flows (4.x) - HOW users navigate

| Node | Spec | Description |
|------|------|-------------|
| 4.1 | navigation-tree | Screen-to-screen paths, navigation graph |
| 4.2 | business-logic-flow | Mermaid flowcharts for business processes |

## Wireframes (5.x) - WHAT it looks like

| Node | Spec | Description |
|------|------|-------------|
| 5.1 | wireframes-screens | Visual layouts per screen |
| 5.2 | component-wireframes | Reusable UI component designs |

## Tasks (6.x) - WHO does WHAT

| Node | Spec | Description |
|------|------|-------------|
| 6.1 | tasks-milestone | Tasks grouped by milestone |
| 6.2 | subtasks | Detailed work items per task |

## Tests (7.x) - HOW to verify

| Node | Spec | Description |
|------|------|-------------|
| 7.1 | test-json-api | Input/output test cases per API |
`;

  return content;
}

function generateWorkflowContent(): string {
  return `# Quikim Artifact Workflow

## Recommended Generation Order

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│ 1. Requirements (1.x) - Start here!                        │
│    1.1 Overview → 1.2 Business → 1.3-1.6 Acceptance → 1.7  │
├─────────────────────────────────────────────────────────────┤
│ 2. HLD (2.x) - High-level architecture                     │
│    2.1 Project Architecture → 2.2 Milestones               │
├─────────────────────────────────────────────────────────────┤
│ 3. LLD (3.x) - Detailed technical specs                    │
│    3.1 Screens → 3.2 APIs → 3.3 Files → 3.4-3.6 Details    │
├─────────────────────────────────────────────────────────────┤
│ 4. Flows (4.x) - Navigation and logic                      │
│    4.1 Navigation → 4.2 Business Logic                     │
├─────────────────────────────────────────────────────────────┤
│ 5. Wireframes (5.x) - Visual layouts                       │
│    5.1 Screen Wireframes → 5.2 Component Wireframes        │
├─────────────────────────────────────────────────────────────┤
│ 6. Tasks (6.x) - Work breakdown                            │
│    6.1 Milestone Tasks → 6.2 Subtasks                      │
├─────────────────────────────────────────────────────────────┤
│ 7. Tests (7.x) - Verification                              │
│    7.1 API Tests                                            │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## For Each Artifact:

1. Call \`get_workflow_instruction\` to get:
   - Skill content with instructions
   - Context artifacts to reference
   - What to include/exclude

2. Generate the artifact following skill instructions

3. Call \`report_workflow_progress\` to advance workflow

## Dependencies

- HLD needs Requirements (1.x)
- LLD needs HLD (2.x)
- Flows need LLD list-screens (3.1)
- Wireframes need LLD list-screens (3.1)
- Tasks need LLD (3.x) for accurate scoping
- Tests need LLD list-apis (3.2)
`;
}

function generateBoundariesContent(artifactType?: string): string {
  const boundaries: Record<string, { include: string[]; exclude: string[] }> = {
    requirement: {
      include: [
        "Project scope, purpose, stakeholders (1.1)",
        "Business rules, user stories (1.2)",
        "Screen acceptance criteria (1.3)",
        "API acceptance criteria (1.4)",
        "Component requirements (1.5)",
        "Code file criteria (1.6)",
        "Milestones and phases (1.7)",
      ],
      exclude: [
        "Implementation details → LLD 3.x",
        "UI layouts → Wireframes 5.x",
        "Code structure → LLD 3.3, 3.4",
        "Architecture decisions → HLD 2.x",
      ],
    },
    hld: {
      include: [
        "System components and boundaries",
        "Technology stack with justifications",
        "Module/service decomposition (high-level)",
        "Deployment topology",
        "Integration points",
        "Key architectural decisions",
      ],
      exclude: [
        "API endpoints with request/response → LLD 3.2, 3.6",
        "Screen layouts → Wireframes 5.x",
        "File-level code structure → LLD 3.3, 3.4",
        "Database schemas → ER Diagram",
        "Implementation code",
      ],
    },
    lld: {
      include: [
        "3.1: Screen inventory with IDs, entry/exit points",
        "3.2: API inventory with methods, paths, shapes",
        "3.3: Directory tree with file purposes",
        "3.4: Per-file exports, dependencies, behavior",
        "3.5: Screen-API-Code traceability",
        "3.6: API-handler-service mapping",
      ],
      exclude: [
        "Full wireframes → 5.x Wireframes",
        "Full source code → Actual files",
        "Business requirements → 1.x Requirements",
        "Architecture decisions → 2.x HLD",
      ],
    },
    flow: {
      include: [
        "4.1: Screen-to-screen navigation paths",
        "4.2: Business process flowcharts",
      ],
      exclude: [
        "Implementation details → LLD 3.x",
        "API specs → LLD 3.2, 3.6",
        "Wireframe layouts → 5.x",
      ],
    },
    wireframe: {
      include: [
        "5.1: Visual layouts per screen",
        "5.2: Reusable UI component designs",
      ],
      exclude: [
        "API details → LLD 3.2, 3.6",
        "Business logic → 4.x Flows",
        "Code structure → LLD 3.x",
      ],
    },
    task: {
      include: [
        "6.1: Tasks grouped by milestone",
        "6.2: Detailed subtasks with acceptance criteria",
      ],
      exclude: [
        "Detailed implementation → Source files",
        "Wireframes → 5.x",
        "Architecture → 2.x HLD",
      ],
    },
    test: {
      include: [
        "7.1: Input/output test cases per API",
      ],
      exclude: [
        "Implementation code → Source files",
        "Wireframes → 5.x",
      ],
    },
  };

  if (artifactType && boundaries[artifactType]) {
    const b = boundaries[artifactType];
    return `# Artifact Boundaries: ${artifactType.toUpperCase()}

## ✅ INCLUDE in ${artifactType}:
${b.include.map(i => `- ${i}`).join('\n')}

## ❌ DO NOT INCLUDE (belongs elsewhere):
${b.exclude.map(e => `- ${e}`).join('\n')}
`;
  }

  // Return all boundaries
  let content = `# Artifact Boundaries - What Goes Where

`;
  for (const [type, b] of Object.entries(boundaries)) {
    content += `## ${type.toUpperCase()}

✅ INCLUDE:
${b.include.map(i => `- ${i}`).join('\n')}

❌ DO NOT INCLUDE:
${b.exclude.map(e => `- ${e}`).join('\n')}

---

`;
  }

  return content;
}
