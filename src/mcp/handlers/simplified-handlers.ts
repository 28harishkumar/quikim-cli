/**
 * Quikim - Simplified Tool Handlers using AI Agent
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { ServiceAwareAPIClient } from "../api/service-client.js";
import { HandlerResponse } from "../types/handler-types.js";

// Import specialized handlers
import { RequirementsHandler } from "./requirements-handler.js";
import { TestsHandler } from "./tests-handler.js";
import { DesignHandler } from "./design-handler.js";
import { WireframeHandler } from "./wireframe-handler.js";
import { TaskHandler } from "./task-handler.js";
import { DiagramHandler } from "./diagram-handler.js";
import { CodeHandler } from "./code-handler.js";
import { ContextHandler } from "./context-handler.js";
import { CodeGuidelineHandler } from "./code-guideline-handler.js";

/**
 * Simplified Tool Handlers
 * Delegates to specialized handlers for each artifact type
 */
export class SimplifiedToolHandlers {
  private requirementsHandler: RequirementsHandler;
  private testsHandler: TestsHandler;
  private designHandler: DesignHandler;
  private wireframeHandler: WireframeHandler;
  private taskHandler: TaskHandler;
  private diagramHandler: DiagramHandler;
  private codeHandler: CodeHandler;
  private contextHandler: ContextHandler;
  private codeGuidelineHandler: CodeGuidelineHandler;

  constructor(apiClient: ServiceAwareAPIClient) {
    this.requirementsHandler = new RequirementsHandler(apiClient);
    this.testsHandler = new TestsHandler(apiClient);
    this.designHandler = new DesignHandler(apiClient);
    this.wireframeHandler = new WireframeHandler(apiClient);
    this.taskHandler = new TaskHandler(apiClient);
    this.diagramHandler = new DiagramHandler(apiClient);
    this.codeHandler = new CodeHandler(apiClient);
    this.contextHandler = new ContextHandler(apiClient);
    this.codeGuidelineHandler = new CodeGuidelineHandler(apiClient);
  }

  // ==================== Requirement Handlers ====================

  async handlePushRequirements(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.requirementsHandler.handlePush(codebase, userPrompt, projectContext, data);
  }

  async handlePullRequirements(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.requirementsHandler.handlePull(codebase, userPrompt, projectContext, data);
  }

  // ==================== Tests Handlers ====================

  async handlePushTests(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.testsHandler.handlePush(codebase, userPrompt, projectContext, data);
  }

  async handlePullTests(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.testsHandler.handlePull(codebase, userPrompt, projectContext, data);
  }

  // ==================== HLD Handlers ====================

  async handlePushHLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.designHandler.handlePushHLD(codebase, userPrompt, projectContext, data);
  }

  async handlePullHLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.designHandler.handlePullHLD(codebase, userPrompt, projectContext, data);
  }

  // ==================== LLD Handlers ====================

  async handlePullLLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.designHandler.handlePullLLD(codebase, userPrompt, projectContext, data);
  }

  async handlePushLLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.designHandler.handlePushLLD(codebase, userPrompt, projectContext, data);
  }

  // ==================== Wireframe Handlers ====================

  async handlePullWireframe(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.wireframeHandler.handlePull(codebase, userPrompt, projectContext, data);
  }

  async handlePushWireframes(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.wireframeHandler.handlePush(codebase, userPrompt, projectContext, data);
  }

  async handleSyncWireframeFromPenpot(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.wireframeHandler.handleSyncFromPenpot(codebase, userPrompt, projectContext, data);
  }

  async handleGenerateCodeFromWireframe(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.wireframeHandler.handleGenerateCode(codebase, userPrompt, projectContext, data);
  }

  async handleListPenpotSyncs(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.wireframeHandler.handleListPenpotSyncs(codebase, userPrompt, projectContext, data);
  }

  // ==================== ER Diagram Handlers ====================

  async handleERDiagramPull(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.diagramHandler.handlePullERDiagram(codebase, userPrompt, projectContext, data);
  }

  async handleERDiagramPush(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.diagramHandler.handlePushERDiagram(codebase, userPrompt, projectContext, data);
  }

  // ==================== Mermaid Diagram Handlers ====================

  async handlePullMermaid(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.diagramHandler.handlePullMermaid(codebase, userPrompt, projectContext, data);
  }

  async handlePushMermaid(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.diagramHandler.handlePushMermaid(codebase, userPrompt, projectContext, data);
  }

  // ==================== Task Handlers ====================

  async handlePushTasks(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.taskHandler.handlePush(codebase, userPrompt, projectContext, data);
  }

  async handlePullTasks(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.taskHandler.handlePull(codebase, userPrompt, projectContext, data);
  }

  // ==================== Code Handlers ====================

  async handleUpdateCode(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.codeHandler.handleUpdateCode(codebase, userPrompt, projectContext, data);
  }

  async handlePullRules(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.codeHandler.handlePullRules(codebase, userPrompt, projectContext, data);
  }

  async handlePushContext(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.contextHandler.handlePush(codebase, userPrompt, projectContext, data);
  }

  async handlePullContext(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.contextHandler.handlePull(codebase, userPrompt, projectContext, data);
  }

  async handlePushCodeGuideline(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.codeGuidelineHandler.handlePush(codebase, userPrompt, projectContext, data);
  }

  async handlePullCodeGuideline(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.codeGuidelineHandler.handlePull(codebase, userPrompt, projectContext, data);
  }
}
