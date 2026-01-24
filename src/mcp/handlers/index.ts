/**
 * Tool Handlers
 * Main entry point that combines all handlers
 */

import { CodebaseContext } from '../session/types.js';
import { ProjectContext } from '../services/project-context.js';
import { ServiceAwareAPIClient } from '../api/service-client.js';
import { SimplifiedToolHandlers } from './simplified-handlers.js';

export class ToolHandlers {
  private handlers: SimplifiedToolHandlers;

  constructor(
    apiClient: ServiceAwareAPIClient
  ) {
    // All handlers now use AI Agent - no validations, just delegate to agent
    this.handlers = new SimplifiedToolHandlers(apiClient);
  }

  // All handlers delegate to AI Agent
  async handlePushRequirements(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePushRequirements(codebase, userPrompt, projectContext, data);
  }

  async handlePullRequirements(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullRequirements(codebase, userPrompt, projectContext, data);
  }

  async handlePushHLD(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePushHLD(codebase, userPrompt, projectContext, data);
  }

  async handlePullHLD(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullHLD(codebase, userPrompt, projectContext, data);
  }

  async handlePullWireframe(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullWireframe(codebase, userPrompt, projectContext, data);
  }

  async handlePushWireframes(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePushWireframes(codebase, userPrompt, projectContext, data);
  }

  async handleSyncWireframeFromPenpot(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handleSyncWireframeFromPenpot(codebase, userPrompt, projectContext, data);
  }

  async handleGenerateCodeFromWireframe(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handleGenerateCodeFromWireframe(codebase, userPrompt, projectContext, data);
  }

  async handleListPenpotSyncs(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handleListPenpotSyncs(codebase, userPrompt, projectContext, data);
  }

  async handleERDiagramPull(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handleERDiagramPull(codebase, userPrompt, projectContext, data);
  }

  async handleERDiagramPush(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handleERDiagramPush(codebase, userPrompt, projectContext, data);
  }

  async handlePullMermaid(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullMermaid(codebase, userPrompt, projectContext, data);
  }

  async handlePushMermaid(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePushMermaid(codebase, userPrompt, projectContext, data);
  }

  async handlePullLLD(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullLLD(codebase, userPrompt, projectContext, data);
  }

  async handlePushLLD(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePushLLD(codebase, userPrompt, projectContext, data);
  }

  async handlePushTasks(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePushTasks(codebase, userPrompt, projectContext, data);
  }

  async handlePullTasks(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullTasks(codebase, userPrompt, projectContext, data);
  }

  async handleUpdateCode(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handleUpdateCode(codebase, userPrompt, projectContext, data);
  }

  async handlePullRules(codebase: CodebaseContext, userPrompt: string, projectContext: ProjectContext, data?: any) {
    return this.handlers.handlePullRules(codebase, userPrompt, projectContext, data);
  }
}
