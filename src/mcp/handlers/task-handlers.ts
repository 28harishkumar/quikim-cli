/**
 * Task Handlers
 * Push and pull handlers for tasks
 */

import { XMLResponse } from '../types.js';
import { CodebaseContext } from '../session/types.js';
import {
  ProjectContext,
  projectContextResolver,
} from '../services/project-context.js';
import {
  extractTasksContext,
  generateTasksInstructions,
} from '../workflows/tasks.js';
import {
  generateRequirementsMissingInstructions,
  generateHLDMissingInstructions,
  generateTasksMissingInstructions,
  generateArtifactSyncedInstructions,
  generateContextExtractionFailedInstructions,
  generateProjectContextInstructions,
  generateSyncFailureInstructions,
} from '../instructions/tool-responses.js';
import { BaseHandler } from './base-handler.js';
import { logger } from '../utils/logger.js';

export class TaskHandlers extends BaseHandler {
  /**
   * Push Tasks - Sync local tasks to server
   */
  async handlePushTasks(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();
    const tasksFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/tasks\.md/)
    );

    if (!tasksFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateTasksMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/tasks.md",
          content: "# Tasks\n\n[To be created]",
        },
        reasoning: "Tasks file missing",
        finalResponse: "Please create tasks first using pull_tasks tool.",
      };
      return this.formatToolResponse(response);
    }

    if (!projectContext.projectId) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateProjectContextInstructions(),
        parameters: {
          filePath: ".quikim/project.json",
          content: JSON.stringify(
            { projectId: "", organizationId: "" },
            null,
            2
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      await this.apiClient.syncArtifact({
        projectId: projectContext.projectId,
        artifactType: "tasks",
        content: tasksFile.content,
      });

      logger.info("Tasks synced to platform", {
        projectId: projectContext.projectId,
      });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateArtifactSyncedInstructions(
          "Tasks",
          tasksFile.path
        ),
        parameters: {},
        reasoning: "Tasks synchronized to database",
        finalResponse: `Tasks from ${tasksFile.path} have been synced.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync tasks", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "tasks",
          (error as Error).message
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to sync tasks.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Pull Tasks - Fetch from server or generate new
   */
  async handlePullTasks(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    const requirementsFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/)
    );
    if (!requirementsFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateRequirementsMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/requirements.md",
          content: "# Requirements\n\n[To be created]",
        },
        reasoning: "Prerequisites missing",
        finalResponse: "Please create requirements first.",
      };
      return this.formatToolResponse(response);
    }

    const hldFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/hld\.md/)
    );
    if (!hldFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateHLDMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/hld.md",
          content: "# High-Level Design\n\n[To be created]",
        },
        reasoning: "Prerequisites missing",
        finalResponse: "Please create HLD first.",
      };
      return this.formatToolResponse(response);
    }

    const tasksContext = extractTasksContext(codebase);
    if (!tasksContext) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateContextExtractionFailedInstructions("tasks"),
        parameters: {
          filePath: ".quikim/v1/tasks.md",
          content: "# Tasks\n\n[To be created]",
        },
        reasoning: "Could not extract tasks context",
        finalResponse: "Please create tasks manually.",
      };
      return this.formatToolResponse(response);
    }

    const latestVersion =
      projectContext.latestVersion ||
      projectContextResolver.getLatestVersion(codebase);
    const filePath = `.quikim/v${latestVersion}/tasks.md`;
    const instructions = generateTasksInstructions(tasksContext);

    const response: XMLResponse = {
      requestId,
      action: "create_file",
      instructions:
        instructions +
        `\n\nSave to ${filePath}. Then proceed to code implementation.`,
      parameters: {
        filePath,
        content: "# Tasks\n\n[To be generated by Cursor]",
      },
      reasoning: "Generating tasks based on requirements and HLD",
      finalResponse: `Tasks file will be created at ${filePath}.`,
    };
    return this.formatToolResponse(response);
  }
}
