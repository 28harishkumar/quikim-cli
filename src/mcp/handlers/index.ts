/**
 * Tool Handlers
 * Main entry point that combines all handlers
 */

import { CodebaseContext } from '../session/types.js';
import { ProjectContext } from '../services/project-context.js';
import { RequirementHandler } from '../workflows/requirement-handler.js';
import { QuikimAPIClient } from '../api/client.js';
import { XMLProtocolParser } from '../xml/parser.js';
import { RAGService } from '../services/rag.js';
import { RequirementHandlers } from './requirement-handlers.js';
import { DesignHandlers } from './design-handlers.js';
import { TaskHandlers } from './task-handlers.js';
import { CodeHandlers } from './code-handlers.js';

export class ToolHandlers {
  private requirementHandlers: RequirementHandlers;
  private designHandlers: DesignHandlers;
  private taskHandlers: TaskHandlers;
  private codeHandlers: CodeHandlers;

  constructor(
    requirementHandler: RequirementHandler,
    apiClient: QuikimAPIClient,
    xmlParser: XMLProtocolParser,
    ragService: RAGService,
  ) {
    this.requirementHandlers = new RequirementHandlers(
      requirementHandler,
      apiClient,
      xmlParser,
      ragService,
    );
    this.designHandlers = new DesignHandlers(apiClient, xmlParser, ragService);
    this.taskHandlers = new TaskHandlers(apiClient, xmlParser, ragService);
    this.codeHandlers = new CodeHandlers(apiClient, xmlParser, ragService);
  }

  // Requirement handlers
  async handlePushRequirements(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.requirementHandlers.handlePushRequirements(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePullRequirements(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.requirementHandlers.handlePullRequirements(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  // Design handlers
  async handlePushHLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handlePushHLD(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePullHLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handlePullHLD(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePullWireframe(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handlePullWireframe(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePushWireframes(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handlePushWireframes(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handleSyncWireframeFromPenpot(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handleSyncWireframeFromPenpot(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handleGenerateCodeFromWireframe(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handleGenerateCodeFromWireframe(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handleListPenpotSyncs(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handleListPenpotSyncs(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handleERDiagramPull(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handleERDiagramPull(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handleERDiagramPush(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handleERDiagramPush(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePullMermaid(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handlePullMermaid(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePushMermaid(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.designHandlers.handlePushMermaid(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  // Task handlers
  async handlePushTasks(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.taskHandlers.handlePushTasks(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePullTasks(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.taskHandlers.handlePullTasks(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  // Code handlers
  async handleUpdateCode(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.codeHandlers.handleUpdateCode(
      codebase,
      userPrompt,
      projectContext,
    );
  }

  async handlePullRules(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ) {
    return this.codeHandlers.handlePullRules(
      codebase,
      userPrompt,
      projectContext,
    );
  }
}
