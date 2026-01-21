/**
 * HLD (High-Level Design) Instructions
 * Instructions for creating/updating HLD documents
 */

export interface HLDContext {
  projectName: string;
  components: {
    websites: number;
    portals: number;
    mobileApps: number;
  };
  requirements: string;
}

export function generateHLDInstructions(context: HLDContext): string {
  const { projectName, components } = context;

  let instructions = `Generate a High-Level Design (HLD) document for the ${projectName} project.

**Required Sections:**

### 1. Technology Stack
Define the complete technology stack:
- **Frontend**: Specify frameworks (e.g., Next.js 14, React, TypeScript)
- **Backend**: Specify frameworks (e.g., Express.js, Node.js, TypeScript)
- **Database**: Specify database (e.g., PostgreSQL, Prisma ORM)
${
  components.mobileApps > 0
    ? "- **Mobile**: Specify mobile framework (e.g., Flutter, React Native)\n"
    : ""
}- **Infrastructure**: Hosting, CI/CD, monitoring
- **Additional Tools**: Testing frameworks, linting, formatting

### 2. Project Structure
Define the directory structure:
${components.websites > 0 ? "- Website(s) location and structure\n" : ""}${
    components.portals > 0
      ? "- Portal(s)/Dashboard(s) location and structure\n"
      : ""
  }${
    components.mobileApps > 0 ? "- Mobile app(s) location and structure\n" : ""
  }- Backend services structure
- Shared packages/utilities
- Configuration files location

### 3. Architecture Decisions
Document key architectural decisions:
- Monorepo vs multi-repo approach
- API design patterns (REST, GraphQL)
- State management approach
- Authentication/authorization strategy
- Caching strategy
- Error handling approach
- Logging and monitoring approach

### 4. Integration Points
Define external integrations:
- GitHub integration
- Payment gateways (if applicable)
- Third-party APIs
- Email/notification services
- File storage (S3, etc.)

### 5. Deployment Configuration
Specify deployment details:
- Hosting platform
- Domain configuration
- Environment variables
- CI/CD pipeline
- Database migration strategy

**IMPORTANT:** The technology stack section is critical as it will be used by the MCP server to make decisions about code generation and project structure.

**Save to:** Appropriate version directory (e.g., .quikim/v1/hld.md)

**Next Steps:** After creating HLD, proceed to wireframe generation using pull_wireframe tool.`;

  return instructions;
}
