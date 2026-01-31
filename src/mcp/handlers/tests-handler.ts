/**
 * Quikim - Tests Handler
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

/**
 * Handler for versioned tests (sample input/output, schemas).
 */
export class TestsHandler extends BaseHandler {
  async handlePush(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePushOperation(
      "generate_tests",
      "tests",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }

  async handlePull(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
    data?: unknown
  ): Promise<HandlerResponse> {
    return this.handlePullOperation(
      "pull_tests",
      "Fetch tests from server",
      "tests",
      codebase,
      userPrompt,
      projectContext,
      data
    );
  }
}
