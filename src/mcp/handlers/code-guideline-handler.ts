/**
 * Quikim - Code Guideline Artifact Handler
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

export class CodeGuidelineHandler extends BaseHandler {
  async handlePush(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "push_code_guideline",
      "code_guideline",
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
      "pull_code_guideline",
      "Fetch code guidelines from server",
      "code_guideline",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }
}
