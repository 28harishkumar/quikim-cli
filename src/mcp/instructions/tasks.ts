/**
 * Tasks Instructions
 * Instructions for creating/updating task documents
 */

export interface TasksContext {
  projectName: string;
  hasWireframes: boolean;
}

export function generateTasksInstructions(context: TasksContext): string {
  const { projectName, hasWireframes } = context;
  
  return `Generate a comprehensive tasks document for the ${projectName} project.

**Task Document Structure:**

### Milestones
Organize tasks into logical milestones (e.g., Setup, Backend, Frontend, Testing, Deployment)

### Task Format
For each task, include:
1. **Task ID**: Unique identifier (e.g., TASK-001)
2. **Task Name**: Clear, descriptive name
3. **Description**: Detailed description of what needs to be done
4. **Acceptance Criteria**: Specific, measurable criteria for completion
5. **Related Requirements**: Link to requirements this task addresses
6. **Estimated Hours**: Time estimate for completion
7. **Dependencies**: Other tasks that must be completed first
8. **Priority**: High, Medium, or Low

### Task Categories
Include tasks for:
- **Infrastructure Setup**: Database, hosting, CI/CD
- **Backend Development**: API endpoints, business logic, database models
- **Frontend Development**: UI components, pages, state management
${hasWireframes ? '- **UI Implementation**: Implement wireframes for all components\n' : ''}- **Integration**: Connect frontend to backend, third-party services
- **Testing**: Unit tests, integration tests, E2E tests
- **Documentation**: API docs, user guides, deployment docs
- **Deployment**: Production deployment, monitoring setup

### Example Task Format:
\`\`\`markdown
## Milestone 1: Project Setup

### TASK-001: Initialize Project Structure
**Description**: Set up the monorepo structure with all necessary packages
**Acceptance Criteria**:
- [ ] Monorepo initialized with Turborepo
- [ ] All packages created (frontend, backend, shared)
- [ ] Package dependencies configured
**Related Requirements**: REQ-001
**Estimated Hours**: 4
**Dependencies**: None
**Priority**: High
\`\`\`

**Generate tasks based on:**
- Requirements document
- HLD architecture decisions
- ER diagram entities and relationships
- Wireframes UI components

**Save to:** Appropriate version directory (e.g., .quikim/v1/tasks.md)

**Next Steps:** After creating tasks, proceed to code implementation using update_code tool.`;
}
