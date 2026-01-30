/**
 * Quikim - MCP Prompts for Capability Exposure
 * 
 * This module exposes MCP server capabilities through the MCP prompts protocol.
 * LLMs can discover available tools and their usage without needing cursor rules.
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Prompt } from "@modelcontextprotocol/sdk/types.js";

export interface QuikimCapability {
  name: string;
  description: string;
  category: "requirements" | "design" | "tasks" | "code" | "sync";
  toolName: string;
  usage: string;
  examples: string[];
  prerequisites?: string[];
  outputs?: string[];
}

export const QUIKIM_CAPABILITIES: QuikimCapability[] = [
  // Requirements
  {
    name: "Pull Requirements",
    description: "Fetch project requirements from server or generate new ones",
    category: "requirements",
    toolName: "pull_requirements",
    usage: "Use when starting a new project or syncing requirements from the Quikim platform",
    examples: [
      "Create requirements for my project",
      "Sync requirements from server",
      "Update project requirements",
    ],
    outputs: [".quikim/artifacts/<spec>/requirement_<id>.md"],
  },
  {
    name: "Generate Requirements",
    description: "Sync local requirements to the Quikim platform",
    category: "requirements",
    toolName: "generate_requirements",
    usage: "Use after creating or updating requirements locally",
    examples: ["Save requirements to server", "Sync my requirements"],
    prerequisites: ["requirement_<id>.md must exist under .quikim/artifacts/<spec>/"],
  },

  // Design - HLD
  {
    name: "Pull HLD",
    description: "Fetch or generate High-Level Design document",
    category: "design",
    toolName: "pull_hld",
    usage: "Use after requirements are complete to define architecture",
    examples: [
      "Create high-level design",
      "Generate HLD for my project",
      "Sync HLD from server",
    ],
    prerequisites: ["requirement_*.md under .quikim/artifacts/<spec>/"],
    outputs: [".quikim/artifacts/<spec>/hld_<id>.md"],
  },
  {
    name: "Generate HLD",
    description: "Sync local HLD to the Quikim platform",
    category: "design",
    toolName: "generate_hld",
    usage: "Use after creating or updating HLD locally",
    examples: ["Save HLD to server"],
    prerequisites: ["hld_<id>.md must exist under .quikim/artifacts/<spec>/"],
  },

  // Design - LLD
  {
    name: "Pull LLD",
    description: "Fetch or generate Low-Level Design for a specific component with detailed specifications",
    category: "design",
    toolName: "pull_lld",
    usage: "Use to create detailed design for services, modules, APIs, or UI components",
    examples: [
      "Create LLD for auth service",
      "Generate low-level design for payment module",
      "Pull LLD for user management API",
      "Create detailed design for notification service",
    ],
    prerequisites: ["requirement_*.md under .quikim/artifacts/<spec>/", "hld_*.md recommended"],
    outputs: [".quikim/artifacts/<spec>/lld_<id>.md"],
  },
  {
    name: "Generate LLD",
    description: "Sync local LLD files to the Quikim platform",
    category: "design",
    toolName: "generate_lld",
    usage: "Use after creating or updating LLD locally",
    examples: ["Save LLD to server", "Push auth service LLD"],
    prerequisites: ["lld_<id>.md files must exist under .quikim/artifacts/<spec>/"],
  },

  // Design - Wireframes (artifact type is wireframe_files, not wireframe)
  {
    name: "Pull Wireframe",
    description: "Fetch or generate wireframes for UI components. File type: wireframe_files.",
    category: "design",
    toolName: "pull_wireframe",
    usage: "Use to create UI wireframes. Files are wireframe_files_<id>.md",
    examples: ["Create wireframes", "Generate UI mockups"],
    prerequisites: ["requirement_*.md under .quikim/artifacts/<spec>/"],
    outputs: [".quikim/artifacts/<spec>/wireframe_files_<id>.md"],
  },
  {
    name: "Generate Wireframes",
    description: "Create wireframe on server. Server expects canvas JSON (name, viewport, elements) or creates empty. Path: wireframe_files_<id>.md.",
    category: "design",
    toolName: "generate_wireframes",
    usage: "Path: .quikim/artifacts/<spec>/wireframe_files_<id>.md. Optional: pass name. Content: JSON { name, viewport, elements } or leave empty.",
    examples: ["Save wireframes to server"],
    prerequisites: ["wireframe_files_<id>.md under .quikim/artifacts/<spec>/ (content optional)"],
  },

  // Design - ER Diagram
  {
    name: "Pull ER Diagram",
    description: "Fetch or generate Entity-Relationship diagram for database design",
    category: "design",
    toolName: "er_diagram_pull",
    usage: "Use to create database schema visualization",
    examples: ["Create ER diagram", "Generate database schema"],
    prerequisites: ["requirement_*.md under .quikim/artifacts/<spec>/", "hld_*.md recommended"],
    outputs: [".quikim/artifacts/<spec>/er_diagram_<id>.md"],
  },
  {
    name: "Push ER Diagram",
    description: "Push ER diagram to server. Content must be RAW mermaid erDiagram syntax only (no ```mermaid wrapper, no JSON).",
    category: "design",
    toolName: "er_diagram_push",
    usage: "Path: .quikim/artifacts/<spec>/er_diagram_<id>.md. Put only raw mermaid diagram code in content.",
    examples: ["Save ER diagram to server"],
    prerequisites: ["er_diagram_<id>.md under .quikim/artifacts/<spec>/"],
  },

  // Design - Flow/Mermaid (artifact type is flow_diagram, not mermaid)
  {
    name: "Pull Mermaid",
    description: "Fetch flow/mermaid diagrams (flowchart, sequence, class, state, gantt). File type: flow_diagram.",
    category: "design",
    toolName: "pull_mermaid",
    usage: "Use to sync or create architectural diagrams. Files are flow_diagram_<id>.md",
    examples: ["Pull mermaid diagrams", "Get flowcharts from server"],
    outputs: [".quikim/artifacts/<spec>/flow_diagram_<id>.md"],
  },
  {
    name: "Generate Mermaid",
    description: "Push mermaid/flow diagram to server. Content must be RAW mermaid syntax only (no ```mermaid wrapper, no JSON).",
    category: "design",
    toolName: "generate_mermaid",
    usage: "Path: .quikim/artifacts/<spec>/flow_diagram_<id>.md. Put only raw diagram code (flowchart, sequenceDiagram, etc.) in content.",
    examples: ["Save diagrams to server"],
    prerequisites: ["flow_diagram_<id>.md under .quikim/artifacts/<spec>/"],
  },

  // Tasks
  {
    name: "Pull Tasks",
    description: "Fetch or generate project tasks and milestones",
    category: "tasks",
    toolName: "pull_tasks",
    usage: "Use to create or sync task breakdown",
    examples: ["Create tasks", "Generate milestones", "Sync tasks from Jira"],
    prerequisites: ["requirement_*.md and hld_*.md under .quikim/artifacts/<spec>/ recommended"],
    outputs: [".quikim/artifacts/<spec>/tasks_<id>.md"],
  },
  {
    name: "Generate Tasks",
    description: "Sync tasks to server. Task file format: YAML frontmatter (--- id, specName, status, ... ---) then # Title, ## Description, ## Subtasks (- [ ] or [x] text), ## Checklist, ## Comments, ## Attachments.",
    category: "tasks",
    toolName: "generate_tasks",
    usage: "Path: .quikim/artifacts/<spec>/tasks_<id>.md. File must have valid YAML frontmatter and ## sections. Put only task content in file.",
    examples: ["Save tasks to server"],
    prerequisites: ["tasks_<id>.md under .quikim/artifacts/<spec>/ with correct format"],
  },

  // Code
  {
    name: "Update Code",
    description: "Get code guidelines, snippets, and implementation instructions from RAG pipeline",
    category: "code",
    toolName: "update_code",
    usage: "Use when implementing features based on requirements and design",
    examples: [
      "Implement authentication feature",
      "Write the payment processing code",
      "Create user registration API",
    ],
    prerequisites: ["requirement_*.md, hld_*.md, tasks_*.md under .quikim/artifacts/<spec>/ should exist"],
    outputs: ["Source code files", "Updated tasks_<id>.md under .quikim/artifacts/<spec>/"],
  },

  // Context
  {
    name: "Generate Context",
    description: "Push project context artifact to server",
    category: "sync",
    toolName: "generate_context",
    usage: "File at .quikim/artifacts/<spec>/context_<id>.md",
    examples: ["Save context to server"],
    prerequisites: ["context_<id>.md under .quikim/artifacts/<spec>/"],
  },
  {
    name: "Pull Context",
    description: "Read context from local files or fetch from API (data.force=true)",
    category: "sync",
    toolName: "pull_context",
    usage: "Read from .quikim/artifacts/<spec>/context_*.md or fetch from API",
    examples: ["Sync context from server"],
    outputs: [".quikim/artifacts/<spec>/context_<id>.md"],
  },

  // Code Guidelines
  {
    name: "Generate Code Guideline",
    description: "Push code guideline to server",
    category: "sync",
    toolName: "generate_code_guideline",
    usage: "File at .quikim/artifacts/<spec>/code_guideline_<id>.md",
    examples: ["Save code guideline to server"],
    prerequisites: ["code_guideline_<id>.md under .quikim/artifacts/<spec>/"],
  },
  {
    name: "Pull Code Guideline",
    description: "Read code guidelines from local files or fetch from API (data.force=true)",
    category: "sync",
    toolName: "pull_code_guideline",
    usage: "Read from .quikim/artifacts/<spec>/code_guideline_*.md or fetch from API",
    examples: ["Sync code guidelines from server"],
    outputs: [".quikim/artifacts/<spec>/code_guideline_<id>.md"],
  },

  // Sync
  {
    name: "Pull Rules",
    description: "Update local Quikim cursor rules files",
    category: "sync",
    toolName: "pull_rules",
    usage: "Use to get latest Quikim integration rules",
    examples: ["Update cursor rules", "Sync Quikim rules"],
    outputs: [".cursor/rules/quikim.md"],
  },
];

/**
 * Generate MCP prompts from capabilities
 */
export function generateMCPPrompts(): Prompt[] {
  const prompts: Prompt[] = [
    // Main capability discovery prompt
    {
      name: "quikim-capabilities",
      description: "Discover all available Quikim MCP tools and how to use them",
      arguments: [],
    },
    // Category-specific prompts
    {
      name: "quikim-design-tools",
      description: "Learn about Quikim design tools (HLD, LLD, wireframes, ER diagrams)",
      arguments: [],
    },
    {
      name: "quikim-workflow",
      description: "Understand the recommended Quikim artifact creation workflow",
      arguments: [],
    },
    // Component-specific prompt for LLD
    {
      name: "quikim-lld-guide",
      description: "Guide for creating Low-Level Designs for specific components",
      arguments: [
        {
          name: "component_name",
          description: "Name of the component (e.g., auth-service, payment-module)",
          required: false,
        },
        {
          name: "component_type",
          description: "Type of component (service, module, feature, api, ui, database)",
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
    case "quikim-design-tools":
      return generateDesignToolsContent();
    case "quikim-workflow":
      return generateWorkflowContent();
    case "quikim-lld-guide":
      return generateLLDGuideContent(args?.component_name, args?.component_type);
    default:
      return `Unknown prompt: ${promptName}`;
  }
}

function generateCapabilitiesContent(): string {
  const categories = ["requirements", "design", "tasks", "code", "sync"] as const;
  let content = `# Quikim MCP Server Capabilities

The Quikim MCP Server provides tools for managing project artifacts throughout the software development lifecycle.

## Available Tools by Category

`;

  for (const category of categories) {
    const tools = QUIKIM_CAPABILITIES.filter((c) => c.category === category);
    content += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    
    for (const tool of tools) {
      content += `**${tool.name}** (\`${tool.toolName}\`)\n`;
      content += `- ${tool.description}\n`;
      content += `- Usage: ${tool.usage}\n`;
      if (tool.prerequisites) {
        content += `- Prerequisites: ${tool.prerequisites.join(", ")}\n`;
      }
      if (tool.outputs) {
        content += `- Outputs: ${tool.outputs.join(", ")}\n`;
      }
      content += `- Examples: "${tool.examples[0]}"\n\n`;
    }
  }

  content += `## Quick Start

1. Start with \`pull_requirements\` to define project requirements
2. Use \`pull_hld\` to create high-level architecture
3. Use \`pull_lld\` for detailed component designs (e.g., "LLD for auth service")
4. Create wireframes with \`pull_wireframe\`
5. Generate ER diagrams with \`er_diagram_pull\`
6. Break down tasks with \`pull_tasks\`
7. Implement with \`update_code\`

## File Structure

All artifacts are stored under \`.quikim/artifacts/<spec name>/<artifact file>\`. Artifact files are named \`<artifact_type>_<artifact_id>.md\` (or \`<artifact_type>_<root_id>.md\` for versioned types: requirement, hld, lld, er_diagram, flow_diagram, wireframe_files).

To use a custom spec name (e.g. \`my-feature\`), pass \`project_context: { specName: "my-feature" }\` in tool calls; otherwise the spec is inferred from artifact file paths or defaults to \`"default"\`.

## Push behavior (all generate_* tools)

- **Local-first, non-blocking**: Content is saved to local files first (e.g. \`.quikim/artifacts/<spec>/<type>_<id>.md\`). Server sync runs in the background; the LLM gets an immediate success and can move on.
- **Requirements and tasks**: Provide **markdown** in the content field (e.g. Kiro task format for tasks). We save and send markdown to server.

## Content Types (what goes in the content field)

- **Requirements**: Markdown. We save and send markdown to server as-is.
- **Tasks**: Markdown (Kiro/task file format). We save and send markdown to server as-is.
- **Mermaid / ER diagrams**: Raw mermaid syntax only (no \`\`\`mermaid wrapper, no JSON).
- **Context, code_guideline, HLD, LLD**: Plain text or markdown in the content field.
- **Wireframes**: Canvas JSON (\`name\`, \`viewport\`, \`elements\`) or empty; path \`wireframe_files_<id>.md\`.

You can pass optional \`name\` and \`title\` in tool arguments for display names.

## Task file format (generate_tasks)

Task files \`.quikim/artifacts/<spec>/tasks_<id>.md\` must use:
1. **YAML frontmatter** between \`---\` lines: \`id\`, \`specName\`, \`milestoneId\` (optional), \`status\`, \`priority\` (optional), \`assignee\`, \`dueDate\`, \`tags\`, \`createdAt\`, \`updatedAt\`
2. **Body**: \`# Title\`, then \`## Description\`, \`## Subtasks\` (lines \`  - [ ] or [x] description\`), \`## Checklist\`, \`## Comments\`, \`## Attachments\`
Put only the task content in the file; do not wrap in JSON.
`;

  return content;
}

function generateDesignToolsContent(): string {
  // Design tools are defined inline for better readability
  const content = `# Quikim Design Tools

## High-Level Design (HLD)
- Defines overall architecture, technology stack, and system structure
- Tool: \`pull_hld\` / \`generate_hld\`
- File: \`.quikim/artifacts/<spec>/hld_<id>.md\`

## Low-Level Design (LLD)
- Detailed specifications for individual components
- Includes: interfaces, data models, method specifications, sequence diagrams
- Tool: \`pull_lld\` / \`generate_lld\`
- Files: \`.quikim/artifacts/<spec>/lld_<id>.md\`
- Component Types: service, module, feature, api, ui, database

### LLD Usage Examples
- "Create LLD for authentication service"
- "Generate low-level design for payment module"
- "Pull LLD for user management API"

## Wireframes
- UI mockups and component layouts
- Tool: \`pull_wireframe\` / \`generate_wireframes\`
- Integrates with Penpot for visual editing

## ER Diagrams
- Database entity relationships
- Tool: \`er_diagram_pull\` / \`er_diagram_push\`
- Supports Mermaid ER diagram syntax

## Mermaid Diagrams
- Various diagram types: flowchart, sequence, class, state, gantt
- Tool: \`pull_mermaid\` / \`generate_mermaid\`
- **Content**: Put only raw mermaid syntax in the content field (no \`\`\`mermaid wrapper, no JSON). Server rejects invalid syntax.

## ER Diagrams
- **Content**: Put only raw mermaid \`erDiagram\` syntax in the content field (no code fences, no JSON).

`;

  return content;
}

function generateWorkflowContent(): string {
  return `# Quikim Artifact Workflow

## Recommended Order

\`\`\`
Requirements → HLD → LLD (optional) → Wireframes → ER Diagram → Tasks → Code
\`\`\`

## Detailed Flow

### 1. Requirements (First)
- Use \`pull_requirements\` to create/fetch requirements
- Define functional and non-functional requirements
- Specify Quikim features to use (auth, payments, multi-tenant, etc.)

### 2. High-Level Design
- Use \`pull_hld\` after requirements exist
- Define technology stack, architecture pattern, project structure
- Include integration points and deployment configuration

### 3. Low-Level Design (Optional but Recommended)
- Use \`pull_lld\` with component name for complex components
- Create detailed specifications before implementation
- Include sequence diagrams and interface definitions

### 4. Wireframes
- Use \`pull_wireframe\` for UI components
- Define page layouts and component structure
- Sync to Penpot for visual editing

### 5. ER Diagram
- Use \`er_diagram_pull\` for database design
- Define entities, relationships, and fields
- Generates Prisma schema foundation

### 6. Tasks
- Use \`pull_tasks\` to create task breakdown
- Organize into milestones and sprints
- Estimate effort and assign priorities

### 7. Code Implementation
- Use \`update_code\` for implementation guidance
- Receives: code guidelines, sample snippets, relevant context
- Updates task status as work progresses

## Directory Structure
- All artifacts stored in \`.quikim/artifacts/<spec name>/<artifact_type>_<id>.md\`
- Versioned artifact types use root id in filename: requirement, hld, lld, er_diagram, flow_diagram, wireframe_files
- Push tools sync to Quikim platform for team collaboration
`;
}

function generateLLDGuideContent(componentName?: string, componentType?: string): string {
  const name = componentName || "{component-name}";
  const type = componentType || "service";

  return `# Low-Level Design Guide${componentName ? ` for ${componentName}` : ""}

## What is LLD?

Low-Level Design (LLD) provides detailed technical specifications for individual components, going beyond the high-level architecture to define:
- Interface definitions with TypeScript types
- Data models and schemas
- Method specifications with pseudocode
- Sequence diagrams for key flows
- Error handling strategies

## Creating LLD for ${name}

### Step 1: Call pull_lld
\`\`\`
"Create LLD for ${name}"
or
"Generate low-level design for ${name} ${type}"
\`\`\`

### Step 2: LLD Sections to Complete

1. **Component Overview**
   - Purpose and scope
   - Dependencies
   - HLD reference

2. **Interface Definitions**
\`\`\`typescript
interface I${toPascalCase(name)} {
  // Define public methods
}
\`\`\`

3. **Data Models**
\`\`\`typescript
interface ${toPascalCase(name)}Model {
  // Define data structure
}
\`\`\`

4. **Method Specifications**
   - Signature, description, inputs, outputs
   - Pseudocode for complex logic
   - Error handling

5. **Sequence Diagrams**
\`\`\`mermaid
sequenceDiagram
    participant Client
    participant ${toPascalCase(name)}
    Client->>+${toPascalCase(name)}: request()
\`\`\`

### Step 3: Push to Server
Use \`generate_lld\` to sync to Quikim platform.

## Component Types

- **service**: Backend services with lifecycle management
- **module**: Reusable code modules
- **feature**: User-facing features
- **api**: REST/GraphQL endpoints
- **ui**: React/UI components
- **database**: Data layer and repositories

## File Location
\`.quikim/artifacts/<spec>/lld_<id>.md\` (e.g. \`lld_${toKebabCase(name)}.md\`)
`;
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
