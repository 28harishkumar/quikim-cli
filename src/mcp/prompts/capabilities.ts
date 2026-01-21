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
    outputs: [".quikim/v*/requirements.md"],
  },
  {
    name: "Push Requirements",
    description: "Sync local requirements to the Quikim platform",
    category: "requirements",
    toolName: "push_requirements",
    usage: "Use after creating or updating requirements locally",
    examples: ["Save requirements to server", "Sync my requirements"],
    prerequisites: ["requirements.md must exist"],
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
    prerequisites: ["requirements.md must exist"],
    outputs: [".quikim/v*/hld.md"],
  },
  {
    name: "Push HLD",
    description: "Sync local HLD to the Quikim platform",
    category: "design",
    toolName: "push_hld",
    usage: "Use after creating or updating HLD locally",
    examples: ["Save HLD to server"],
    prerequisites: ["hld.md must exist"],
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
    prerequisites: ["requirements.md must exist", "hld.md recommended"],
    outputs: [".quikim/v*/lld/{component-name}.md"],
  },
  {
    name: "Push LLD",
    description: "Sync local LLD files to the Quikim platform",
    category: "design",
    toolName: "push_lld",
    usage: "Use after creating or updating LLD locally",
    examples: ["Save LLD to server", "Push auth service LLD"],
    prerequisites: ["lld/*.md files must exist"],
  },

  // Design - Wireframes
  {
    name: "Pull Wireframe",
    description: "Fetch or generate wireframes for UI components",
    category: "design",
    toolName: "pull_wireframe",
    usage: "Use to create UI wireframes based on requirements and HLD",
    examples: ["Create wireframes", "Generate UI mockups"],
    prerequisites: ["requirements.md must exist"],
    outputs: [".quikim/v*/wireframes.md"],
  },
  {
    name: "Push Wireframes",
    description: "Sync wireframes to server and Penpot",
    category: "design",
    toolName: "push_wireframes",
    usage: "Use after creating wireframes locally",
    examples: ["Save wireframes to Penpot"],
    prerequisites: ["wireframes.md must exist"],
  },

  // Design - ER Diagram
  {
    name: "Pull ER Diagram",
    description: "Fetch or generate Entity-Relationship diagram for database design",
    category: "design",
    toolName: "er_diagram_pull",
    usage: "Use to create database schema visualization",
    examples: ["Create ER diagram", "Generate database schema"],
    prerequisites: ["requirements.md must exist", "hld.md recommended"],
    outputs: [".quikim/v*/er-diagram.md"],
  },
  {
    name: "Push ER Diagram",
    description: "Sync ER diagram to server",
    category: "design",
    toolName: "er_diagram_push",
    usage: "Use after creating ER diagram locally",
    examples: ["Save ER diagram to server"],
    prerequisites: ["er-diagram.md must exist"],
  },

  // Design - Mermaid
  {
    name: "Pull Mermaid",
    description: "Fetch mermaid diagrams (flowchart, sequence, class, state, gantt, etc.)",
    category: "design",
    toolName: "pull_mermaid",
    usage: "Use to sync or create architectural diagrams",
    examples: ["Pull mermaid diagrams", "Get flowcharts from server"],
    outputs: [".quikim/v*/diagrams/*.md"],
  },
  {
    name: "Push Mermaid",
    description: "Sync local mermaid diagrams to server",
    category: "design",
    toolName: "push_mermaid",
    usage: "Use after creating diagrams locally",
    examples: ["Save diagrams to server"],
    prerequisites: ["diagrams/*.md or mermaid blocks in HLD/ER files"],
  },

  // Tasks
  {
    name: "Pull Tasks",
    description: "Fetch or generate project tasks and milestones",
    category: "tasks",
    toolName: "pull_tasks",
    usage: "Use to create or sync task breakdown",
    examples: ["Create tasks", "Generate milestones", "Sync tasks from Jira"],
    prerequisites: ["requirements.md and hld.md recommended"],
    outputs: [".quikim/v*/tasks.md"],
  },
  {
    name: "Push Tasks",
    description: "Sync tasks to server (and optionally to Jira/Linear)",
    category: "tasks",
    toolName: "push_tasks",
    usage: "Use after creating or updating tasks locally",
    examples: ["Save tasks to server"],
    prerequisites: ["tasks.md must exist"],
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
    prerequisites: ["requirements.md, hld.md, tasks.md should exist"],
    outputs: ["Source code files", "Updated tasks.md"],
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

All artifacts are stored in \`.quikim/v{version}/\` directories with versioning support.
`;

  return content;
}

function generateDesignToolsContent(): string {
  // Design tools are defined inline for better readability
  const content = `# Quikim Design Tools

## High-Level Design (HLD)
- Defines overall architecture, technology stack, and system structure
- Tool: \`pull_hld\` / \`push_hld\`
- File: \`.quikim/v*/hld.md\`

## Low-Level Design (LLD)
- Detailed specifications for individual components
- Includes: interfaces, data models, method specifications, sequence diagrams
- Tool: \`pull_lld\` / \`push_lld\`
- Files: \`.quikim/v*/lld/{component-name}.md\`
- Component Types: service, module, feature, api, ui, database

### LLD Usage Examples
- "Create LLD for authentication service"
- "Generate low-level design for payment module"
- "Pull LLD for user management API"

## Wireframes
- UI mockups and component layouts
- Tool: \`pull_wireframe\` / \`push_wireframes\`
- Integrates with Penpot for visual editing

## ER Diagrams
- Database entity relationships
- Tool: \`er_diagram_pull\` / \`er_diagram_push\`
- Supports Mermaid ER diagram syntax

## Mermaid Diagrams
- Various diagram types: flowchart, sequence, class, state, gantt
- Tool: \`pull_mermaid\` / \`push_mermaid\`
- Can be embedded in HLD or standalone files

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

## Version Management
- All artifacts stored in \`.quikim/v{version}/\`
- New version created when artifacts are updated
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
Use \`push_lld\` to sync to Quikim platform.

## Component Types

- **service**: Backend services with lifecycle management
- **module**: Reusable code modules
- **feature**: User-facing features
- **api**: REST/GraphQL endpoints
- **ui**: React/UI components
- **database**: Data layer and repositories

## File Location
\`.quikim/v{version}/lld/${toKebabCase(name)}.md\`
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
