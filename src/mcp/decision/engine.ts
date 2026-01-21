/**
 * Decision-Making Logic - REFACTORED to use Cursor Analysis
 * Makes workflow decisions based ONLY on structured analysis from Cursor
 * NO hardcoded technology detection, file analysis, or guessing allowed
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { DecisionContext, XMLResponse, PromptAnalysis, WorkflowType } from '../types.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { RequirementHandler } from '../workflows/requirement-handler.js';

export class DecisionEngine {
  private requirementHandler: RequirementHandler;

  constructor() {
    this.requirementHandler = new RequirementHandler();
  }

  /**
   * Makes workflow decisions based ONLY on analysis from Cursor
   * NEVER detects, guesses, or analyzes anything - uses only provided analysis
   */
  async makeDecision(context: DecisionContext): Promise<XMLResponse> {
    const errorContext: ErrorContext = {
      operation: 'makeDecision',
      additionalData: { 
        userPrompt: context.userPrompt?.substring(0, 100),
        workflowType: context.analysis.workflow_type,
        requestCount: context.requestCount,
        maxRequests: context.maxRequests
      }
    };

    try {
      // Validate that we have analysis from Cursor
      this.validateAnalysis(context.analysis);

      // Check if we've reached the request limit
      if (context.requestCount >= context.maxRequests) {
        return this.createCompletionResponse(context, 'Request limit reached');
      }

      // Route to appropriate handler based on workflow_type from analysis
      return this.routeWorkflow(context);

    } catch (error) {
      // Comprehensive error handling for decision making
      const recoveryResult = await errorHandler.handleError(error, errorContext);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        // Use fallback decision
        return {
          requestId: this.generateRequestId(),
          action: recoveryResult.fallbackData.action || 'complete',
          instructions: recoveryResult.fallbackData.instructions || 'Error occurred during decision making',
          parameters: recoveryResult.fallbackData.parameters || {},
          reasoning: recoveryResult.fallbackData.reasoning || 'Decision engine encountered an error, using fallback',
          finalResponse: recoveryResult.fallbackData.finalResponse
        };
      }

      // Create error completion response
      logger.logError('Critical error in decision engine', error);
      return this.createCompletionResponse(
        context, 
        `Decision engine error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate that analysis is present and contains required fields
   */
  private validateAnalysis(analysis: PromptAnalysis): void {
    if (!analysis) {
      throw new Error('Analysis is required from Cursor but was not provided');
    }

    if (!analysis.workflow_type) {
      throw new Error('workflow_type is required in analysis from Cursor');
    }

    // Validate workflow_type is one of the fixed enum values
    const validWorkflowTypes: WorkflowType[] = [
      'requirement_create', 'requirement_update',
      'wireframe_create', 'wireframe_update',
      'er_diagram_create', 'er_diagram_update',
      'prisma_schema_create', 'prisma_schema_update',
      'hld_create', 'hld_update',
      'tasks_create', 'tasks_update',
      'code_implementation', 'bug_fix', 'question'
    ];

    if (!validWorkflowTypes.includes(analysis.workflow_type)) {
      throw new Error(`Invalid workflow_type: ${analysis.workflow_type}. Must be one of: ${validWorkflowTypes.join(', ')}`);
    }

    // Validate required boolean fields
    if (typeof analysis.is_create !== 'boolean') {
      throw new Error('is_create must be a boolean in analysis');
    }

    if (typeof analysis.is_new_project !== 'boolean') {
      throw new Error('is_new_project must be a boolean in analysis');
    }

    if (typeof analysis.has_quikim_directory !== 'boolean') {
      throw new Error('has_quikim_directory must be a boolean in analysis');
    }

    // Validate arrays
    if (!Array.isArray(analysis.existing_artifact_versions)) {
      throw new Error('existing_artifact_versions must be an array in analysis');
    }

    if (!Array.isArray(analysis.artifacts_in_latest_version)) {
      throw new Error('artifacts_in_latest_version must be an array in analysis');
    }
  }

  /**
   * Route workflow based on analysis.workflow_type (FIXED ENUM - no guessing)
   */
  private routeWorkflow(context: DecisionContext): XMLResponse {
    const requestId = this.generateRequestId();
    
    // Use ONLY the workflow_type from analysis - NO GUESSING OR DETECTION
    switch (context.analysis.workflow_type) {
      case 'requirement_create':
        return this.requirementHandler.handleCreate(
          context.userPrompt,
          context.analysis,
          requestId
        );
      
      case 'requirement_update':
        return this.requirementHandler.handleUpdate(
          context.userPrompt,
          context.analysis,
          context.codebase,
          requestId
        );
      
      case 'wireframe_create':
        return this.handleWireframeCreate(context, requestId);
      
      case 'wireframe_update':
        return this.handleWireframeUpdate(context, requestId);
      
      case 'er_diagram_create':
        return this.handleERDiagramCreate(context, requestId);
      
      case 'er_diagram_update':
        return this.handleERDiagramUpdate(context, requestId);
      
      case 'prisma_schema_create':
        return this.handlePrismaSchemaCreate(context, requestId);
      
      case 'prisma_schema_update':
        return this.handlePrismaSchemaUpdate(context, requestId);
      
      case 'hld_create':
        return this.handleHLDCreate(context, requestId);
      
      case 'hld_update':
        return this.handleHLDUpdate(context, requestId);
      
      case 'tasks_create':
        return this.handleTasksCreate(context, requestId);
      
      case 'tasks_update':
        return this.handleTasksUpdate(context, requestId);
      
      case 'code_implementation':
        return this.handleCodeImplementation(context, requestId);
      
      case 'bug_fix':
        return this.handleBugFix(context, requestId);
      
      case 'question':
        return this.handleQuestion(context, requestId);
      
      default:
        // This should never happen due to validation, but TypeScript requires it
        throw new Error(`Unhandled workflow_type: ${context.analysis.workflow_type}`);
    }
  }

  /**
   * Handle wireframe creation
   */
  private handleWireframeCreate(context: DecisionContext, requestId: string): XMLResponse {
    const version = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${version}/wireframes.md`;

    return {
      requestId,
      action: 'create_file',
      instructions: `Create wireframes document (v${version}) based on the user request.`,
      parameters: {
        filePath,
        content: this.generateWireframeTemplate(context.userPrompt)
      },
      reasoning: `Analysis indicates wireframe_create workflow. Creating v${version} wireframes.`,
      finalResponse: `I've created the wireframes document (v${version}) at ${filePath}. Please review and modify as needed.`
    };
  }

  /**
   * Handle wireframe updates
   */
  private handleWireframeUpdate(context: DecisionContext, requestId: string): XMLResponse {
    const newVersion = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${newVersion}/wireframes.md`;

    // Find existing wireframes
    const existingWireframes = this.findExistingArtifact(context, 'wireframes');

    return {
      requestId,
      action: 'create_file',
      instructions: `Update wireframes document to v${newVersion} with the requested changes.`,
      parameters: {
        filePath,
        content: this.updateWireframeContent(existingWireframes, context.userPrompt)
      },
      reasoning: `Analysis indicates wireframe_update workflow. Updating from v${context.analysis.latest_version} to v${newVersion}.`,
      finalResponse: `I've updated the wireframes document to v${newVersion}. Previous version preserved. Please review at ${filePath}.`
    };
  }

  /**
   * Handle ER diagram creation
   */
  private handleERDiagramCreate(context: DecisionContext, requestId: string): XMLResponse {
    const version = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${version}/er-diagram.md`;

    return {
      requestId,
      action: 'create_file',
      instructions: `Create ER diagram document (v${version}) based on the user request.`,
      parameters: {
        filePath,
        content: this.generateERDiagramTemplate(context.userPrompt)
      },
      reasoning: `Analysis indicates er_diagram_create workflow. Creating v${version} ER diagram.`,
      finalResponse: `I've created the ER diagram document (v${version}) at ${filePath}. Please review and modify as needed.`
    };
  }

  /**
   * Handle ER diagram updates
   */
  private handleERDiagramUpdate(context: DecisionContext, requestId: string): XMLResponse {
    const newVersion = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${newVersion}/er-diagram.md`;

    const existingERDiagram = this.findExistingArtifact(context, 'er-diagram');

    return {
      requestId,
      action: 'create_file',
      instructions: `Update ER diagram document to v${newVersion} with the requested changes.`,
      parameters: {
        filePath,
        content: this.updateERDiagramContent(existingERDiagram, context.userPrompt)
      },
      reasoning: `Analysis indicates er_diagram_update workflow. Updating from v${context.analysis.latest_version} to v${newVersion}.`,
      finalResponse: `I've updated the ER diagram document to v${newVersion}. Previous version preserved. Please review at ${filePath}.`
    };
  }

  /**
   * Handle Prisma schema creation
   */
  private handlePrismaSchemaCreate(context: DecisionContext, requestId: string): XMLResponse {
    return {
      requestId,
      action: 'create_file',
      instructions: 'Create Prisma schema file based on the user request.',
      parameters: {
        filePath: 'prisma/schema.prisma',
        content: this.generatePrismaSchemaTemplate(context.userPrompt)
      },
      reasoning: 'Analysis indicates prisma_schema_create workflow. Creating new Prisma schema.',
      finalResponse: 'I\'ve created the Prisma schema file at prisma/schema.prisma. Please review and run `npx prisma generate` to generate the client.'
    };
  }

  /**
   * Handle Prisma schema updates
   */
  private handlePrismaSchemaUpdate(context: DecisionContext, requestId: string): XMLResponse {
    const existingSchema = this.findExistingPrismaSchema(context);

    return {
      requestId,
      action: 'modify_file',
      instructions: 'Update the existing Prisma schema with the requested changes.',
      parameters: {
        filePath: 'prisma/schema.prisma',
        content: this.updatePrismaSchemaContent(existingSchema, context.userPrompt)
      },
      reasoning: 'Analysis indicates prisma_schema_update workflow. Updating existing Prisma schema.',
      finalResponse: 'I\'ve updated the Prisma schema file. Please run `npx prisma db push` or `npx prisma migrate dev` to apply the changes to your database.'
    };
  }

  /**
   * Handle HLD creation
   */
  private handleHLDCreate(context: DecisionContext, requestId: string): XMLResponse {
    const version = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${version}/hld.md`;

    return {
      requestId,
      action: 'create_file',
      instructions: `Create High-Level Design document (v${version}) based on the user request.`,
      parameters: {
        filePath,
        content: this.generateHLDTemplate(context.userPrompt)
      },
      reasoning: `Analysis indicates hld_create workflow. Creating v${version} HLD.`,
      finalResponse: `I've created the High-Level Design document (v${version}) at ${filePath}. Please review and modify as needed.`
    };
  }

  /**
   * Handle HLD updates
   */
  private handleHLDUpdate(context: DecisionContext, requestId: string): XMLResponse {
    const newVersion = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${newVersion}/hld.md`;

    const existingHLD = this.findExistingArtifact(context, 'hld');

    return {
      requestId,
      action: 'create_file',
      instructions: `Update High-Level Design document to v${newVersion} with the requested changes.`,
      parameters: {
        filePath,
        content: this.updateHLDContent(existingHLD, context.userPrompt)
      },
      reasoning: `Analysis indicates hld_update workflow. Updating from v${context.analysis.latest_version} to v${newVersion}.`,
      finalResponse: `I've updated the High-Level Design document to v${newVersion}. Previous version preserved. Please review at ${filePath}.`
    };
  }

  /**
   * Handle tasks creation
   */
  private handleTasksCreate(context: DecisionContext, requestId: string): XMLResponse {
    const version = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${version}/tasks.md`;

    return {
      requestId,
      action: 'create_file',
      instructions: `Create tasks document (v${version}) based on the user request.`,
      parameters: {
        filePath,
        content: this.generateTasksTemplate(context.userPrompt)
      },
      reasoning: `Analysis indicates tasks_create workflow. Creating v${version} tasks.`,
      finalResponse: `I've created the tasks document (v${version}) at ${filePath}. Please review and modify as needed.`
    };
  }

  /**
   * Handle tasks updates
   */
  private handleTasksUpdate(context: DecisionContext, requestId: string): XMLResponse {
    const newVersion = (context.analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${newVersion}/tasks.md`;

    const existingTasks = this.findExistingArtifact(context, 'tasks');

    return {
      requestId,
      action: 'create_file',
      instructions: `Update tasks document to v${newVersion} with the requested changes.`,
      parameters: {
        filePath,
        content: this.updateTasksContent(existingTasks, context.userPrompt)
      },
      reasoning: `Analysis indicates tasks_update workflow. Updating from v${context.analysis.latest_version} to v${newVersion}.`,
      finalResponse: `I've updated the tasks document to v${newVersion}. Previous version preserved. Please review at ${filePath}.`
    };
  }

  /**
   * Handle code implementation
   */
  private handleCodeImplementation(_context: DecisionContext, requestId: string): XMLResponse {
    return {
      requestId,
      action: 'request_info',
      instructions: 'Code implementation requires additional context. Please provide the specific files you want to modify or create.',
      parameters: {
        content: 'Need file paths and implementation details for code generation'
      },
      reasoning: 'Analysis indicates code_implementation workflow. Requesting specific implementation details.',
      finalResponse: 'I need more information about which files to create or modify for the code implementation. Please specify the file paths and implementation requirements.'
    };
  }

  /**
   * Handle bug fixes
   */
  private handleBugFix(_context: DecisionContext, requestId: string): XMLResponse {
    return {
      requestId,
      action: 'request_info',
      instructions: 'Bug fix requires additional context. Please provide the specific files and error details.',
      parameters: {
        content: 'Need bug details, error messages, and affected file paths'
      },
      reasoning: 'Analysis indicates bug_fix workflow. Requesting bug details and context.',
      finalResponse: 'I need more information about the bug you want to fix. Please provide error messages, affected files, and steps to reproduce the issue.'
    };
  }

  /**
   * Handle user questions
   */
  private handleQuestion(context: DecisionContext, requestId: string): XMLResponse {
    return {
      requestId,
      action: 'complete',
      instructions: 'Answer the user question based on available context.',
      parameters: {},
      reasoning: 'Analysis indicates question workflow. Providing direct response.',
      finalResponse: `I understand you have a question: "${context.userPrompt}". Based on the available context, I can help you with information about your project structure and documentation. Please let me know if you need specific details about any aspect of your project.`
    };
  }

  /**
   * Find existing artifact in codebase
   */
  private findExistingArtifact(context: DecisionContext, artifactType: string): string | null {
    if (!context.analysis.latest_version) {
      return null;
    }

    const artifactPath = `.quikim/v${context.analysis.latest_version}/${artifactType}.md`;
    const artifactFile = context.codebase.files.find(f => f.path === artifactPath);
    
    return artifactFile?.content || null;
  }

  /**
   * Find existing Prisma schema
   */
  private findExistingPrismaSchema(context: DecisionContext): string | null {
    const schemaFile = context.codebase.files.find(f => f.path === 'prisma/schema.prisma');
    return schemaFile?.content || null;
  }

  /**
   * Generate wireframe template
   */
  private generateWireframeTemplate(userPrompt: string): string {
    return `# Wireframes\n\n## Overview\n\nWireframes for: ${userPrompt}\n\n## Page Layouts\n\n### Main Page\n- Header with navigation\n- Main content area\n- Footer\n\n### Additional Pages\n- [Add specific pages based on requirements]\n\n## Component Details\n\n### Navigation\n- Logo/Brand\n- Menu items\n- User actions (login/logout)\n\n### Content Areas\n- Primary content\n- Sidebar (if applicable)\n- Call-to-action buttons\n\n## Notes\n\n- Responsive design considerations\n- Accessibility requirements\n- User interaction flows\n`;
  }

  /**
   * Update wireframe content
   */
  private updateWireframeContent(existingContent: string | null, userPrompt: string): string {
    const base = existingContent || this.generateWireframeTemplate('');
    return `${base}\n\n## Updates\n\n**Latest Update:** ${new Date().toISOString().split('T')[0]}\n\n${userPrompt}\n\n`;
  }

  /**
   * Generate ER diagram template
   */
  private generateERDiagramTemplate(userPrompt: string): string {
    return `# Entity Relationship Diagram\n\n## Overview\n\nER Diagram for: ${userPrompt}\n\n## Entities\n\n### User\n- id (Primary Key)\n- email (Unique)\n- password_hash\n- created_at\n- updated_at\n\n### [Additional Entities]\n- Add entities based on requirements\n\n## Relationships\n\n### User Relationships\n- User has many [related entities]\n\n## Constraints\n\n- Primary keys are auto-incrementing integers\n- Foreign keys maintain referential integrity\n- Unique constraints on email fields\n\n## Indexes\n\n- Primary key indexes (automatic)\n- Email index for fast lookups\n- Foreign key indexes for joins\n`;
  }

  /**
   * Update ER diagram content
   */
  private updateERDiagramContent(existingContent: string | null, userPrompt: string): string {
    const base = existingContent || this.generateERDiagramTemplate('');
    return `${base}\n\n## Updates\n\n**Latest Update:** ${new Date().toISOString().split('T')[0]}\n\n${userPrompt}\n\n`;
  }

  /**
   * Generate Prisma schema template
   */
  private generatePrismaSchemaTemplate(userPrompt: string): string {
    return `// Prisma Schema\n// Generated for: ${userPrompt}\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\nmodel User {\n  id        Int      @id @default(autoincrement())\n  email     String   @unique\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@map("users")\n}\n\n// Add additional models based on requirements\n`;
  }

  /**
   * Update Prisma schema content
   */
  private updatePrismaSchemaContent(existingContent: string | null, userPrompt: string): string {
    if (!existingContent) {
      return this.generatePrismaSchemaTemplate(userPrompt);
    }

    return `${existingContent}\n\n// Updated: ${new Date().toISOString().split('T')[0]}\n// Changes: ${userPrompt}\n`;
  }

  /**
   * Generate HLD template
   */
  private generateHLDTemplate(userPrompt: string): string {
    return `# High-Level Design\n\n## Overview\n\nHigh-level design for: ${userPrompt}\n\n## Architecture\n\n### System Components\n- Frontend: [Technology stack]\n- Backend: [Technology stack]\n- Database: [Database choice]\n- External Services: [Third-party integrations]\n\n### Technology Stack\n\n#### Frontend\n- Framework: [e.g., React, Vue, Angular]\n- Styling: [e.g., CSS, Tailwind, Material-UI]\n- State Management: [e.g., Redux, Zustand]\n\n#### Backend\n- Runtime: [e.g., Node.js, Python, Java]\n- Framework: [e.g., Express, FastAPI, Spring]\n- Authentication: [e.g., JWT, OAuth]\n\n#### Database\n- Primary: [e.g., PostgreSQL, MongoDB]\n- Caching: [e.g., Redis]\n- Search: [e.g., Elasticsearch]\n\n## Data Flow\n\n1. User interaction with frontend\n2. API calls to backend\n3. Database operations\n4. Response back to frontend\n\n## Security Considerations\n\n- Authentication and authorization\n- Data encryption\n- Input validation\n- CORS configuration\n\n## Deployment\n\n- Hosting platform\n- CI/CD pipeline\n- Environment configuration\n- Monitoring and logging\n`;
  }

  /**
   * Update HLD content
   */
  private updateHLDContent(existingContent: string | null, userPrompt: string): string {
    const base = existingContent || this.generateHLDTemplate('');
    return `${base}\n\n## Updates\n\n**Latest Update:** ${new Date().toISOString().split('T')[0]}\n\n${userPrompt}\n\n`;
  }

  /**
   * Generate tasks template
   */
  private generateTasksTemplate(userPrompt: string): string {
    return `# Tasks\n\n## Overview\n\nTasks for: ${userPrompt}\n\n## Development Tasks\n\n### Phase 1: Setup\n- [ ] Project initialization\n- [ ] Development environment setup\n- [ ] Database setup\n- [ ] Basic project structure\n\n### Phase 2: Core Features\n- [ ] User authentication\n- [ ] Main functionality implementation\n- [ ] Database integration\n- [ ] API development\n\n### Phase 3: Frontend\n- [ ] UI component development\n- [ ] Frontend-backend integration\n- [ ] Responsive design\n- [ ] User experience optimization\n\n### Phase 4: Testing & Deployment\n- [ ] Unit testing\n- [ ] Integration testing\n- [ ] Deployment setup\n- [ ] Production monitoring\n\n## Notes\n\n- Prioritize tasks based on dependencies\n- Regular testing throughout development\n- Code review for all changes\n`;
  }

  /**
   * Update tasks content
   */
  private updateTasksContent(existingContent: string | null, userPrompt: string): string {
    const base = existingContent || this.generateTasksTemplate('');
    return `${base}\n\n## Additional Tasks\n\n**Added:** ${new Date().toISOString().split('T')[0]}\n\n${userPrompt}\n\n`;
  }

  /**
   * Creates completion response when workflow is done or limit reached
   */
  private createCompletionResponse(context: DecisionContext, reason: string): XMLResponse {
    const summary = this.generateWorkflowSummary(context);
    
    return {
      requestId: this.generateRequestId(),
      action: 'complete',
      instructions: 'Workflow completed',
      parameters: {},
      reasoning: reason,
      finalResponse: `Workflow completed. ${summary}`
    };
  }

  /**
   * Generates a summary of the workflow actions taken
   */
  private generateWorkflowSummary(context: DecisionContext): string {
    const totalActions = context.actionHistory.length;
    const successfulActions = context.actionHistory.filter(a => a.executionResult.success).length;

    return `Completed ${successfulActions}/${totalActions} actions successfully. ` +
           `Workflow type: ${context.analysis.workflow_type}. ` +
           `Request count: ${context.requestCount}/${context.maxRequests}.`;
  }

  /**
   * Generates a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}