/**
 * Quikim - Design Handler (HLD/LLD)
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { BaseHandler } from "./base-handler.js";
import { CodebaseContext } from "../session/types.js";
import { ProjectContext } from "../services/project-context.js";
import { HandlerResponse } from "../types/handler-types.js";

export class DesignHandler extends BaseHandler {
  // HLD Handlers
  async handlePushHLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "generate_hld",
      "hld",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handlePullHLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_hld",
      "Fetch HLD from server",
      "hld",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  // LLD Handlers
  async handlePushLLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "generate_lld",
      "lld",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handlePullLLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_lld",
      "Fetch LLD from server",
      "lld",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }
}