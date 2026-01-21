/**
 * Requirements Instructions
 * Instructions for creating/updating requirements documents
 */

export interface RequirementsContext {
  projectName: string;
  isNewProject: boolean;
  existingRequirements?: string;
}

export function generateRequirementsInstructions(context: RequirementsContext): string {
  const { projectName, isNewProject } = context;
  
  if (isNewProject) {
    return `Create a comprehensive requirements document for the ${projectName} project.

**Document Structure:**

### 1. Project Overview
- Project name and description
- Project goals and objectives
- Target audience
- Success criteria

### 2. Functional Requirements
Use EARS (Easy Approach to Requirements Syntax) pattern:
- **WHEN** [trigger condition] **THE** [system name] **SHALL** [expected behavior]
- Include rationale for each requirement
- Add acceptance criteria for each requirement

### 3. User Stories
Format: As a [user type], I want [action] so that [benefit]
- Include acceptance criteria for each user story
- Link user stories to functional requirements

### 4. Non-Functional Requirements
- Performance requirements
- Security requirements
- Scalability requirements
- Usability requirements

### 5. Technical Constraints
- Technology stack preferences (if any)
- Integration requirements
- Compliance requirements

**Save to:** .quikim/v1/requirements.md

**Next Steps:** After creating requirements, proceed to HLD generation using pull_hld tool.`;
  } else {
    return `Update the existing requirements document for the ${projectName} project.

**Update Process:**
1. Review existing requirements
2. Identify new requirements from user prompt
3. Update or add functional requirements using EARS pattern
4. Add new user stories if needed
5. Update non-functional requirements if applicable
6. Maintain version history in document

**Save to:** Create new version directory (e.g., .quikim/v2/requirements.md) to preserve previous version.

**Next Steps:** After updating requirements, review if HLD needs updates using pull_hld tool.`;
  }
}
