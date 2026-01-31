/**
 * Quikim - Code Handler
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

export class CodeHandler extends BaseHandler {
  async handleUpdateCode(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "update_code",
      "Implement code changes based on requirements and HLD",
      "requirements",
      codebase,
      userPrompt,
      projectContext,
      data,
      { useApiOnly: true }
    );
  }

  async handlePullRules(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_rules",
      "Update local Quikim cursor rules files",
      "requirements",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }
}