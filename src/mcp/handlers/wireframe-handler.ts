/**
 * Quikim - Wireframe Handler
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

export class WireframeHandler extends BaseHandler {
  async handlePush(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "push_wireframes",
      "wireframes",
      codebase,
      userPrompt,
      projectContext
    );
  }

  async handlePull(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_wireframe",
      "Fetch wireframes from server",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleSyncFromPenpot(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "sync_wireframe_from_penpot",
      "Sync wireframes from Penpot back to Quikim",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleGenerateCode(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "generate_code_from_wireframe",
      "Convert wireframe to React component code",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handleListPenpotSyncs(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "list_penpot_syncs",
      "List all Penpot sync states for project",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }
}