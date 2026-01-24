/**
 * Quikim - Diagram Handler (ER Diagrams & Mermaid)
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { BaseHandler } from "./base-handler.js";
import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { HandlerResponse } from "../types/handler-types.js";

export class DiagramHandler extends BaseHandler {
  // ER Diagram Handlers
  async handlePushERDiagram(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "er_diagram_push",
      "er_diagram",
      codebase,
      userPrompt,
      projectContext
    );
  }

  async handlePullERDiagram(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "er_diagram_pull",
      "Fetch ER diagram from server",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  // Mermaid Diagram Handlers
  async handlePushMermaid(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "push_mermaid",
      "mermaid",
      codebase,
      userPrompt,
      projectContext
    );
  }

  async handlePullMermaid(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_mermaid",
      "Fetch mermaid diagrams from server",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }
}