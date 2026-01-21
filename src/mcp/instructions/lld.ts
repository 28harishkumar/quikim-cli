/**
 * Quikim - LLD (Low-Level Design) Instructions
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

export type LLDComponentType = "service" | "module" | "feature" | "api" | "ui" | "database" | "other";

export interface LLDContext {
  projectName: string;
  componentName: string;
  componentType: LLDComponentType;
  hldContent: string;
  requirements: string;
  existingLLDs?: Array<{
    name: string;
    type: LLDComponentType;
  }>;
}

export interface LLDPullContext {
  projectName: string;
  existingLLDs: Array<{
    name: string;
    type: LLDComponentType;
    version: number;
  }>;
  hldSections?: string[];
}

export function generateLLDInstructions(context: LLDContext): string {
  const { projectName, componentName, componentType, hldContent } = context;

  const componentTypeGuide = getComponentTypeGuide(componentType);

  return `Generate a Low-Level Design (LLD) document for the **${componentName}** ${componentType} in the ${projectName} project.

**Reference HLD Section:**
${hldContent ? `Based on the HLD, focus on the following architecture decisions and integration points.` : "No HLD section provided - create based on requirements."}

**Required Sections:**

### 1. Component Overview
- **Purpose**: Clear description of what this ${componentType} does
- **Scope**: What's included and excluded
- **Dependencies**: List internal and external dependencies
- **Linked HLD Section**: Reference the relevant HLD architecture section

### 2. Detailed Specifications
${componentTypeGuide}

### 3. Interface Definitions
Define all public interfaces/APIs:
\`\`\`typescript
interface I${toPascalCase(componentName)} {
  // Define all public methods with full signatures
  methodName(param: ParamType): ReturnType;
}
\`\`\`

### 4. Data Models
Define all data structures:
\`\`\`typescript
interface ${toPascalCase(componentName)}Model {
  // Define all fields with types
  id: string;
  // ... other fields
}
\`\`\`

### 5. Method Specifications
For each public method, provide:
- **Method Signature**: Full TypeScript signature
- **Description**: What the method does
- **Input Parameters**: Detailed parameter descriptions
- **Return Value**: What is returned and when
- **Pseudocode**: Step-by-step logic (optional but recommended)
- **Error Handling**: Expected errors and how they're handled
- **Complexity**: Time/space complexity if relevant

### 6. Sequence Diagrams
Include Mermaid sequence diagrams for key flows:
\`\`\`mermaid
sequenceDiagram
    participant Client
    participant ${toPascalCase(componentName)}
    participant Database
    
    Client->>+${toPascalCase(componentName)}: request()
    ${toPascalCase(componentName)}->>+Database: query()
    Database-->>-${toPascalCase(componentName)}: result
    ${toPascalCase(componentName)}-->>-Client: response
\`\`\`

### 7. Class/Module Diagram
Include Mermaid class diagram showing structure:
\`\`\`mermaid
classDiagram
    class ${toPascalCase(componentName)} {
        +methodName() ReturnType
        -privateMethod() void
    }
\`\`\`

### 8. Error Handling Strategy
- List all possible errors
- Define error codes and messages
- Specify recovery strategies

### 9. Testing Considerations
- Unit test scenarios
- Integration test requirements
- Edge cases to cover

**File Naming Convention:**
Save as: \`.quikim/v{version}/lld/${toKebabCase(componentName)}.md\`

**IMPORTANT:**
- LLD should be detailed enough for direct implementation
- Include actual TypeScript types that will be used
- Sequence diagrams help visualize component interactions
- Reference the HLD architecture decisions

**Next Steps:** After creating LLD, proceed to implementation or create LLDs for other components.`;
}

export function generateLLDPullInstructions(context: LLDPullContext): string {
  const { projectName, existingLLDs, hldSections } = context;

  const existingList = existingLLDs.length > 0
    ? existingLLDs.map(lld => `- **${lld.name}** (${lld.type}) - v${lld.version}`).join("\n")
    : "No LLDs found";

  const hldSectionsList = hldSections && hldSections.length > 0
    ? hldSections.map(s => `- ${s}`).join("\n")
    : "No HLD sections identified";

  return `**Low-Level Designs for ${projectName}**

**Existing LLDs:**
${existingList}

**HLD Sections that may need LLDs:**
${hldSectionsList}

**LLD File Structure:**
\`\`\`
.quikim/v{version}/lld/
├── auth-service.md
├── user-management.md
├── payment-gateway.md
└── notification-service.md
\`\`\`

**Actions:**
1. Review existing LLDs for completeness
2. Identify components that need detailed LLDs
3. Create new LLDs for components that are:
   - Complex enough to warrant detailed specification
   - Critical for system functionality
   - Interface points between services
   - Components that multiple team members will work on

**Next Steps:**
- Use \`pull_lld\` with a specific component name to generate LLD
- Use \`push_lld\` to sync completed LLDs to server`;
}

export function generateLLDPushInstructions(componentName: string): string {
  return `**LLD Synced Successfully**

The Low-Level Design for **${componentName}** has been synchronized to the Quikim platform.

**What's synced:**
- Interface definitions
- Data models
- Method specifications
- Sequence diagrams
- Class diagrams

**Platform Benefits:**
- Team members can view the LLD in the Quikim dashboard
- Changes are tracked with version history
- LLD is linked to related HLD sections
- Code generation can reference this LLD

**Next Steps:**
- Create LLDs for other components
- Begin implementation based on this LLD
- Update LLD if requirements change`;
}

export function generateLLDNotFoundInstructions(projectName: string): string {
  return `**No LLDs Found for ${projectName}**

Low-Level Designs provide detailed specifications for individual components.

**When to Create LLDs:**
- Complex services with multiple methods
- API endpoints with specific business logic
- Database-heavy modules
- Integration points with external services
- UI components with complex state management

**How to Create:**
1. Identify a component from your HLD
2. Use \`pull_lld\` with the component name
3. Follow the generated template
4. Include interface definitions, data models, and sequence diagrams

**Example:**
"Create LLD for authentication service"
"Generate low-level design for payment processing module"`;
}

export function generateLLDMissingHLDInstructions(): string {
  return `**HLD Required Before Creating LLD**

Low-Level Designs should reference High-Level Design sections.

**Why HLD First:**
- LLD details specific components defined in HLD
- Architecture decisions in HLD guide LLD structure
- Technology choices in HLD determine LLD implementation patterns

**Action Required:**
1. Create HLD using \`pull_hld\` tool
2. Define component architecture in HLD
3. Then create LLDs for individual components

**Alternative:**
If you need a standalone component LLD, specify "standalone" in your request.`;
}

function getComponentTypeGuide(componentType: LLDComponentType): string {
  const guides: Record<LLDComponentType, string> = {
    service: `
**Service-Specific Sections:**
- Service initialization and lifecycle
- Dependency injection configuration
- Service-to-service communication patterns
- Rate limiting and throttling
- Health check endpoints
- Graceful shutdown handling`,
    
    module: `
**Module-Specific Sections:**
- Module exports and public API
- Internal implementation structure
- State management (if stateful)
- Configuration options
- Extension points/hooks`,
    
    feature: `
**Feature-Specific Sections:**
- Feature flag integration
- User-facing functionality
- A/B testing considerations
- Analytics events
- Rollback strategy`,
    
    api: `
**API-Specific Sections:**
- Endpoint definitions (paths, methods)
- Request/Response schemas
- Authentication/Authorization requirements
- Rate limits per endpoint
- Versioning strategy
- OpenAPI/Swagger documentation`,
    
    ui: `
**UI Component-Specific Sections:**
- Component props interface
- State management approach
- Event handlers
- Accessibility requirements (ARIA)
- Responsive design breakpoints
- Animation specifications`,
    
    database: `
**Database-Specific Sections:**
- Table/collection schemas
- Indexes and their purposes
- Query patterns and optimization
- Migration strategy
- Backup and recovery
- Data retention policies`,
    
    other: `
**General Specifications:**
- Input/output definitions
- Processing logic
- Error states
- Performance requirements
- Security considerations`
  };

  return guides[componentType];
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
