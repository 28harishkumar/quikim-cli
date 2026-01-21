/**
 * Quikim - Mermaid Diagram Instructions
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { MermaidDiagramType } from "../api/types.js";

export interface MermaidInstructionContext {
  projectName: string;
  diagramType: MermaidDiagramType;
  existingDiagrams?: Array<{
    name: string;
    type: MermaidDiagramType;
  }>;
  requirements?: string;
  hld?: string;
}

/**
 * Get diagram type description for instructions
 */
function getDiagramTypeDescription(type: MermaidDiagramType): string {
  const descriptions: Record<MermaidDiagramType, string> = {
    flowchart: "Flowchart diagrams show process flows, decision trees, and workflows",
    sequence: "Sequence diagrams show interactions between components over time",
    classDiagram: "Class diagrams show object-oriented structure and relationships",
    stateDiagram: "State diagrams show state transitions and lifecycle",
    erDiagram: "ER diagrams show database entity relationships",
    gantt: "Gantt charts show project timelines and task dependencies",
    pie: "Pie charts show data distribution and proportions",
    mindmap: "Mind maps show hierarchical idea organization",
    timeline: "Timeline diagrams show chronological events",
    journey: "User journey diagrams show user experience flows",
    other: "Custom diagram type",
  };
  
  return descriptions[type] || descriptions.other;
}

/**
 * Get mermaid syntax example for diagram type
 */
function getMermaidSyntaxExample(type: MermaidDiagramType): string {
  const examples: Record<MermaidDiagramType, string> = {
    flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D`,
    sequence: `sequenceDiagram
    participant User
    participant API
    participant DB
    User->>API: Request
    API->>DB: Query
    DB-->>API: Result
    API-->>User: Response`,
    classDiagram: `classDiagram
    class User {
        +String id
        +String name
        +login()
    }
    class Order {
        +String id
        +create()
    }
    User "1" --> "*" Order`,
    stateDiagram: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review
    Review --> Approved
    Review --> Rejected
    Approved --> [*]
    Rejected --> Draft`,
    erDiagram: `erDiagram
    USER ||--o{ ORDER : places
    USER {
        string id PK
        string email
        string name
    }
    ORDER {
        string id PK
        string userId FK
        date createdAt
    }`,
    gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1: a1, 2024-01-01, 30d
    Task 2: a2, after a1, 20d`,
    pie: `pie title Distribution
    "Category A": 40
    "Category B": 35
    "Category C": 25`,
    mindmap: `mindmap
    root((Central Idea))
        Branch 1
            Sub-topic 1.1
            Sub-topic 1.2
        Branch 2
            Sub-topic 2.1`,
    timeline: `timeline
    title Project Milestones
    2024-Q1: Planning
    2024-Q2: Development
    2024-Q3: Testing
    2024-Q4: Launch`,
    journey: `journey
    title User Registration Flow
    section Sign Up
        Visit website: 5: User
        Fill form: 3: User
        Submit: 4: User
    section Verification
        Receive email: 5: System
        Click link: 4: User`,
    other: `flowchart TD
    A[Custom Diagram] --> B[Your Content]`,
  };
  
  return examples[type] || examples.other;
}

/**
 * Generate instructions for pulling mermaid diagrams
 */
export function generateMermaidPullInstructions(
  context: MermaidInstructionContext,
): string {
  const { projectName, existingDiagrams } = context;
  
  let instructions = `# Pull Mermaid Diagrams for ${projectName}

## Overview
Fetch and synchronize mermaid diagrams from the Quikim platform.

`;

  if (existingDiagrams && existingDiagrams.length > 0) {
    instructions += `## Existing Diagrams Found
The following diagrams exist on the server:
${existingDiagrams.map((d) => `- **${d.name}** (${d.type})`).join("\n")}

`;
  }

  instructions += `## File Structure
Mermaid diagrams should be stored in:
\`.quikim/v{version}/diagrams/{type}-{name}.md\`

## Diagram Types Supported
- **flowchart**: Process flows and decision trees
- **sequence**: Component interactions over time
- **classDiagram**: Object-oriented structure
- **stateDiagram**: State transitions
- **erDiagram**: Database entity relationships
- **gantt**: Project timelines
- **pie**: Data distribution
- **mindmap**: Hierarchical ideas
- **timeline**: Chronological events
- **journey**: User experience flows

## Next Steps
1. Review the fetched diagrams
2. Update as needed based on project changes
3. Use \`push_mermaid\` to sync changes back to server
`;

  return instructions;
}

/**
 * Generate instructions for pushing mermaid diagrams
 */
export function generateMermaidPushInstructions(
  context: MermaidInstructionContext,
): string {
  const { projectName, diagramType } = context;
  const description = getDiagramTypeDescription(diagramType);
  const example = getMermaidSyntaxExample(diagramType);
  
  return `# Push Mermaid Diagram for ${projectName}

## Diagram Type: ${diagramType}
${description}

## Mermaid Syntax Example
\`\`\`mermaid
${example}
\`\`\`

## Instructions
1. Ensure your diagram is properly formatted in Mermaid syntax
2. The diagram will be synced to the Quikim platform
3. Other team members will be able to view and collaborate on this diagram

## File Format
Diagrams should be stored as markdown files with mermaid code blocks:

\`\`\`markdown
# Diagram Title

\`\`\`mermaid
${diagramType === "erDiagram" ? "erDiagram" : diagramType === "flowchart" ? "flowchart TD" : diagramType}
    // Your diagram content here
\`\`\`
\`\`\`

## Next Steps
After pushing, the diagram will be:
1. Validated for syntax errors
2. Stored with version history
3. Available for collaboration
4. Linked to related artifacts (requirements, HLD, etc.)
`;
}

/**
 * Generate instructions for creating a new mermaid diagram
 */
export function generateMermaidCreateInstructions(
  context: MermaidInstructionContext,
): string {
  const { projectName, diagramType, requirements, hld } = context;
  const description = getDiagramTypeDescription(diagramType);
  const example = getMermaidSyntaxExample(diagramType);
  
  let instructions = `# Create ${diagramType} Diagram for ${projectName}

## Purpose
${description}

`;

  if (requirements) {
    instructions += `## Requirements Context
Use the following requirements to inform your diagram design:
- Identify key entities, processes, or components mentioned
- Map relationships and data flows
- Include all relevant actors and systems

`;
  }

  if (hld) {
    instructions += `## Architecture Context
Reference the HLD for:
- System components and boundaries
- Integration points
- Technical constraints

`;
  }

  instructions += `## Mermaid Syntax
Use the following syntax for ${diagramType} diagrams:

\`\`\`mermaid
${example}
\`\`\`

## Best Practices
1. **Keep it readable**: Use clear, descriptive labels
2. **Limit complexity**: Break large diagrams into smaller ones
3. **Use consistent naming**: Follow project naming conventions
4. **Add comments**: Document complex relationships
5. **Version control**: Save diagrams in .quikim/v{version}/diagrams/

## Output
Save your diagram to:
\`.quikim/v1/diagrams/${diagramType}-{descriptive-name}.md\`

## Next Steps
After creating the diagram:
1. Review for accuracy and completeness
2. Use \`push_mermaid\` to sync to Quikim platform
3. Share with team for feedback
`;

  return instructions;
}

/**
 * Generate instructions for mermaid diagram not found
 */
export function generateMermaidNotFoundInstructions(
  projectName: string,
): string {
  return `# No Mermaid Diagrams Found for ${projectName}

## Current State
No mermaid diagrams were found in the local .quikim directory or on the Quikim platform.

## Getting Started
Create mermaid diagrams to document your project:

1. **System Architecture** (flowchart)
   - Document component interactions
   - Show data flows

2. **Database Schema** (erDiagram)
   - Entity relationships
   - Data model

3. **User Flows** (sequence/journey)
   - User interactions
   - API calls

4. **State Management** (stateDiagram)
   - Application states
   - Transitions

## Create Your First Diagram
Use the \`pull_mermaid\` tool to fetch existing diagrams or create new ones in:
\`.quikim/v1/diagrams/{type}-{name}.md\`

## Next Steps
1. Review requirements and HLD for diagram opportunities
2. Create diagrams using mermaid syntax
3. Push to platform for collaboration
`;
}

/**
 * Generate instructions for successful mermaid sync
 */
export function generateMermaidSyncedInstructions(
  diagramName: string,
  diagramType: MermaidDiagramType,
  version: number,
): string {
  return `# Mermaid Diagram Synced Successfully

## Synced Diagram
- **Name:** ${diagramName}
- **Type:** ${diagramType}
- **Version:** v${version}

## What Happens Next
1. Diagram is now available on Quikim platform
2. Team members can view and collaborate
3. Changes are tracked with version history
4. Diagram is linked to project artifacts

## Actions Available
- Edit and re-sync with \`push_mermaid\`
- Fetch latest version with \`pull_mermaid\`
- View in Quikim dashboard
`;
}
