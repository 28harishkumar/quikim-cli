/**
 * Quikim - Design Handlers
 * Push and pull handlers for HLD, LLD, wireframes, ER diagrams
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { XMLResponse } from '../types.js';
import { CodebaseContext } from '../session/types.js';
import {
  ProjectContext,
  projectContextResolver,
} from '../services/project-context.js';
import { extractHLDContext, generateHLDInstructions } from '../workflows/hld.js';
import {
  extractWireframeContext,
  generateWireframeInstructions,
} from '../workflows/wireframe.js';
import {
  extractERDiagramContext,
  generateERDiagramInstructions,
} from '../workflows/er-diagram.js';
import {
  extractMermaidContext,
  formatMermaidForMarkdown,
  getMermaidFilePath,
  detectMermaidDiagramType,
  extractMermaidFromMarkdown,
} from '../workflows/mermaid.js';
import {
  extractLLDContext,
  generateLLDInstructions,
  getLLDFilePath,
  validateLLDPrerequisites,
  extractExistingLLDs,
  parseComponentFromPrompt,
  suggestComponentsForLLD,
} from '../workflows/lld.js';
import {
  generateLLDPullInstructions,
  generateLLDPushInstructions,
} from '../instructions/lld.js';
import { extractProjectName } from '../utils/project-name.js';
import {
  generateMermaidPullInstructions,
  generateMermaidPushInstructions,
  generateMermaidNotFoundInstructions,
} from '../instructions/mermaid.js';
import {
  generateRequirementsMissingInstructions,
  generateHLDMissingInstructions,
  generateLLDMissingInstructions,
  generateWireframesMissingInstructions,
  generateERDiagramMissingInstructions,
  generateArtifactSyncedInstructions,
  generateContextExtractionFailedInstructions,
  generateProjectContextInstructions,
  generateSyncFailureInstructions,
} from '../instructions/tool-responses.js';
import { BaseHandler } from './base-handler.js';
import { logger } from '../utils/logger.js';
import { MermaidDiagramType } from '../api/types.js';

export class DesignHandlers extends BaseHandler {
  /**
   * Push HLD - Sync local HLD to server
   */
  async handlePushHLD(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();
    const hldFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/hld\.md/),
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
        reasoning: "HLD file missing",
        finalResponse: "Please create HLD first using pull_hld tool.",
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
            2,
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
        artifactType: "hld",
        content: hldFile.content,
      });

      logger.info("HLD synced to platform", {
        projectId: projectContext.projectId,
      });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateArtifactSyncedInstructions("HLD", hldFile.path),
        parameters: {},
        reasoning: "HLD synchronized to database",
        finalResponse: `HLD from ${hldFile.path} has been successfully synced.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync HLD", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "HLD",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse:
          "Failed to sync HLD. Please check your API configuration.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Pull HLD - Fetch from server or generate new
   */
  async handlePullHLD(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    const requirementsFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/),
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

    const hldContext = extractHLDContext(codebase);
    if (!hldContext) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateContextExtractionFailedInstructions("HLD"),
        parameters: {
          filePath: ".quikim/v1/hld.md",
          content: "# High-Level Design\n\n[To be created]",
        },
        reasoning: "Could not extract HLD context",
        finalResponse: "Please review requirements and create HLD manually.",
      };
      return this.formatToolResponse(response);
    }

    const latestVersion =
      projectContext.latestVersion ||
      projectContextResolver.getLatestVersion(codebase);
    const filePath = `.quikim/v${latestVersion}/hld.md`;
    const instructions = generateHLDInstructions(hldContext);

    const response: XMLResponse = {
      requestId,
      action: "create_file",
      instructions:
        instructions + `\n\nSave to ${filePath}. Then proceed to wireframe.`,
      parameters: {
        filePath,
        content: "# High-Level Design\n\n[To be generated by Cursor]",
      },
      reasoning: "Generating HLD based on requirements",
      finalResponse: `HLD file will be created at ${filePath}.`,
    };
    return this.formatToolResponse(response);
  }

  /**
   * Pull Wireframe - Fetch from server or generate new
   */
  async handlePullWireframe(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    const requirementsFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/),
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

    const wireframeContext = extractWireframeContext(codebase);
    if (!wireframeContext) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateContextExtractionFailedInstructions("wireframes"),
        parameters: {
          filePath: ".quikim/v1/wireframes.md",
          content: "# Wireframes\n\n[To be created]",
        },
        reasoning: "Could not extract wireframe context",
        finalResponse: "Please create wireframes manually.",
      };
      return this.formatToolResponse(response);
    }

    const latestVersion =
      projectContext.latestVersion ||
      projectContextResolver.getLatestVersion(codebase);
    const filePath = `.quikim/v${latestVersion}/wireframes.md`;
    const instructions = generateWireframeInstructions(wireframeContext);

    const response: XMLResponse = {
      requestId,
      action: "create_file",
      instructions:
        instructions + `\n\nSave to ${filePath}. Then proceed to ER diagram.`,
      parameters: {
        filePath,
        content: "# Wireframes\n\n[To be generated by Cursor]",
      },
      reasoning: "Generating wireframes based on requirements",
      finalResponse: `Wireframes file will be created at ${filePath}.`,
    };
    return this.formatToolResponse(response);
  }

  /**
   * Push Wireframes - Sync local wireframes to server and Penpot
   */
  async handlePushWireframes(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();
    const wireframesFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/wireframes\.md/),
    );

    if (!wireframesFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateWireframesMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/wireframes.md",
          content: "# Wireframes\n\n[To be created]",
        },
        reasoning: "Wireframes file missing",
        finalResponse:
          "Please create wireframes first using pull_wireframe tool.",
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
            2,
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      // Sync wireframe to database
      await this.apiClient.syncArtifact({
        projectId: projectContext.projectId,
        artifactType: "wireframes",
        content: wireframesFile.content,
      });

      logger.info("Wireframes synced to platform", {
        projectId: projectContext.projectId,
      });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateArtifactSyncedInstructions(
          "Wireframes",
          wireframesFile.path,
        ),
        parameters: {},
        reasoning: "Wireframes synchronized to database",
        finalResponse: `Wireframes from ${wireframesFile.path} have been synced.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync wireframes", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "wireframes",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to sync wireframes.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Pull ER Diagram
   */
  async handleERDiagramPull(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    const requirementsFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/requirements\.md/),
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

    // Check for wireframes (ER diagram comes after wireframes)
    const wireframesFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/wireframes\.md/),
    );
    if (!wireframesFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateWireframesMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/wireframes.md",
          content: "# Wireframes\n\n[To be created]",
        },
        reasoning:
          "Prerequisites missing - wireframes needed before ER diagram",
        finalResponse: "Please create wireframes first.",
      };
      return this.formatToolResponse(response);
    }

    const erDiagramContext = extractERDiagramContext(codebase);
    if (!erDiagramContext) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateContextExtractionFailedInstructions("ER diagram"),
        parameters: {
          filePath: ".quikim/v1/er-diagram.md",
          content: "# ER Diagram\n\n[To be created]",
        },
        reasoning: "Could not extract ER diagram context",
        finalResponse: "Please create ER diagram manually.",
      };
      return this.formatToolResponse(response);
    }

    // Fetch Quikim features if available
    let quikimFeatures: Array<{
      name: string;
      description: string;
      entities?: any[];
    }> = [];
    try {
      const features = await this.apiClient.fetchFeatures();
      if (features) {
        quikimFeatures = features.map((f: any) => ({
          name: f.name,
          description: f.description || "",
          entities: f.databaseSchema?.entities,
        }));
      }
    } catch (error) {
      logger.warn("Failed to fetch Quikim features", { error });
    }

    const latestVersion =
      projectContext.latestVersion ||
      projectContextResolver.getLatestVersion(codebase);
    const filePath = `.quikim/v${latestVersion}/er-diagram.md`;
    const instructions = generateERDiagramInstructions(
      erDiagramContext,
      quikimFeatures,
    );

    const response: XMLResponse = {
      requestId,
      action: "create_file",
      instructions:
        instructions + `\n\nSave to ${filePath}. Then proceed to tasks.`,
      parameters: {
        filePath,
        content: "# ER Diagram\n\n[To be generated by Cursor]",
      },
      reasoning: "Generating ER diagram based on requirements",
      finalResponse: `ER diagram file will be created at ${filePath}.`,
    };
    return this.formatToolResponse(response);
  }

  /**
   * Push ER Diagram
   */
  async handleERDiagramPush(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();
    const erDiagramFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/er-diagram\.md/),
    );

    if (!erDiagramFile) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateERDiagramMissingInstructions(["er-diagram"]),
        parameters: {
          filePath: ".quikim/v1/er-diagram.md",
          content: "# ER Diagram\n\n[To be created]",
        },
        reasoning: "ER diagram file missing",
        finalResponse:
          "Please create ER diagram first using er_diagram_pull tool.",
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
            2,
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
        artifactType: "er_diagram",
        content: erDiagramFile.content,
      });

      logger.info("ER diagram synced to platform", {
        projectId: projectContext.projectId,
      });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateArtifactSyncedInstructions(
          "ER Diagram",
          erDiagramFile.path,
        ),
        parameters: {},
        reasoning: "ER diagram synchronized to database",
        finalResponse: `ER diagram from ${erDiagramFile.path} has been synced.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync ER diagram", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "ER diagram",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to sync ER diagram.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Sync wireframe from Penpot back to Quikim
   * Pulls latest changes from Penpot design tool
   */
  async handleSyncWireframeFromPenpot(
    _codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

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
            2,
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      // Call API to sync from Penpot
      const result = await this.apiClient.syncWireframesFromPenpot(
        projectContext.projectId,
      );

      if (!result) {
        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions:
            "Failed to sync from Penpot. Please check Penpot integration configuration.",
          parameters: {},
          reasoning: "Sync operation failed",
          finalResponse:
            "❌ Failed to sync from Penpot. Ensure Penpot integration is configured.",
        };
        return this.formatToolResponse(response);
      }

      const { syncedWireframes, conflicts } = result;

      if (conflicts && conflicts.length > 0) {
        const response: XMLResponse = {
          requestId,
          action: "request_info",
          instructions: `Sync conflicts detected!\n\n${conflicts.map((c: any) => `- ${c.wireframeName}: ${c.reason}`).join("\n")}\n\nUse resolve_wireframe_conflict tool to resolve these conflicts.`,
          parameters: {},
          reasoning: "Sync conflicts detected",
          finalResponse: `⚠️  Sync completed with ${conflicts.length} conflict(s). Please resolve conflicts before proceeding.`,
        };
        return this.formatToolResponse(response);
      }

      // Update local wireframe files
      const latestVersion =
        syncedWireframes[0]?.version || projectContext.latestVersion || 1;
      const fileUpdates = syncedWireframes.map((wf: any) => ({
        path: wf.filePath,
        content: JSON.stringify(wf.content, null, 2),
      }));

      const response: XMLResponse = {
        requestId,
        action: "modify_file",
        instructions: `✅ Synced ${syncedWireframes.length} wireframe(s) from Penpot!\n\n${syncedWireframes.map((wf: any) => `**${wf.pageName}** (v${wf.version})\nChanges:\n${wf.changes.map((c: string) => `  - ${c}`).join("\n")}`).join("\n\n")}\n\nNew version: v${latestVersion}\nReview the changes and proceed to code generation when ready.`,
        parameters: {
          filePath:
            fileUpdates[0]?.path || `.quikim/v${latestVersion}/wireframes.json`,
          content: fileUpdates[0]?.content || "{}",
        },
        reasoning: "Synced changes from Penpot successfully",
        finalResponse: `✅ Synced ${syncedWireframes.length} wireframe(s) from Penpot! New version: v${latestVersion}`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync from Penpot", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "Penpot wireframes",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to sync from Penpot.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Generate React code from wireframe
   * Converts wireframe design to production-ready React components
   */
  async handleGenerateCodeFromWireframe(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    // Find wireframe files
    const wireframeFiles = codebase.files.filter((f) =>
      f.path.match(/\.quikim\/v\d+\/wireframes\/.*\.json/),
    );

    if (wireframeFiles.length === 0) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateWireframesMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/wireframes/page.json",
          content: "{}",
        },
        reasoning: "No wireframes found",
        finalResponse:
          "Please create wireframes first using pull_wireframe tool.",
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
            2,
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      // Get code generation options from project context or defaults
      const options = {
        framework: projectContext.framework || "nextjs",
        styling: projectContext.styling || "tailwind",
        typescript: projectContext.typescript !== false,
        componentPath: projectContext.componentPath || "src/components",
        pagePath: projectContext.pagePath || "src/app",
      };

      // Call design-to-code API for each wireframe
      const wireframeToConvert = wireframeFiles[0]; // Start with first wireframe
      const wireframeContent = JSON.parse(wireframeToConvert.content);

      const result = await this.apiClient.generateCodeFromWireframe(
        wireframeContent,
        options,
        projectContext.projectId,
      );

      if (!result) {
        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions:
            "Failed to generate code from wireframe. Please ensure wireframe is synced to Penpot.",
          parameters: {},
          reasoning: "Code generation failed",
          finalResponse:
            "❌ Failed to generate code. Try syncing wireframe to Penpot first.",
        };
        return this.formatToolResponse(response);
      }

      const { components, tokens } = result;

      if (!components || components.length === 0) {
        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions: "No components generated from wireframe.",
          parameters: {},
          reasoning: "Empty component list",
          finalResponse:
            "⚠️  No components generated. Wireframe might be incomplete.",
        };
        return this.formatToolResponse(response);
      }

      // Generate instructions for component creation
      const mainComponent = components[0];
      const componentList = components
        .map((c: any, i: number) => `${i + 1}. ${c.name} - ${c.path}`)
        .join("\n");

      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: `✅ Generated ${components.length} React component(s) from wireframe!\n\n**Components:**\n${componentList}\n\n**Design Tokens:**\n- Colors: ${Object.keys(tokens?.colors || {}).length} defined\n- Spacing: ${Object.keys(tokens?.spacing || {}).length} defined\n\n**Integration Steps:**\n1. Review the generated code below\n2. Adjust styling/functionality as needed\n3. Add business logic and API connections\n4. Implement authentication/authorization\n5. Add form validation and error handling\n6. Write tests\n\n**Framework:** ${options.framework}\n**Styling:** ${options.styling}\n**TypeScript:** ${options.typescript ? "Yes" : "No"}`,
        parameters: {
          filePath: mainComponent.path,
          content: mainComponent.code,
        },
        reasoning: "Generated React components from wireframe design",
        finalResponse: `✅ Generated ${components.length} React component(s)! Review and integrate into your project.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to generate code from wireframe", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: `Failed to generate code: ${(error as Error).message}`,
        parameters: {},
        reasoning: "Code generation error",
        finalResponse: "❌ Code generation failed.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * List Penpot sync states for project
   * Shows sync status for all wireframes
   */
  async handleListPenpotSyncs(
    _codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    if (!projectContext.projectId) {
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: "Project context required to list sync states.",
        parameters: {},
        reasoning: "Missing project ID",
        finalResponse: "⚠️  Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      const result = await this.apiClient.listPenpotSyncStates(
        projectContext.projectId,
      );

      if (!result || result.length === 0) {
        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions: "No sync states found for this project.",
          parameters: {},
          reasoning: "Empty sync state list",
          finalResponse: "No wireframes have been synced to Penpot yet.",
        };
        return this.formatToolResponse(response);
      }

      const syncStates = result;
      const syncList = syncStates
        .map(
          (s: any) =>
            `- ${s.wireframe?.name || "Unnamed"} (v${s.wireframe?.version || "?"}) - Status: ${s.syncStatus} - Last sync: ${new Date(s.lastSyncAt).toLocaleString()}`,
        )
        .join("\n");

      const conflicts = syncStates.filter(
        (s: any) => s.syncStatus === "conflict",
      );
      const pending = syncStates.filter((s: any) => s.syncStatus === "pending");

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: `**Penpot Sync Status**\n\nTotal: ${syncStates.length} wireframe(s)\n${conflicts.length > 0 ? `⚠️  Conflicts: ${conflicts.length}\n` : ""}${pending.length > 0 ? `⏳ Pending: ${pending.length}\n` : ""}\n\n${syncList}`,
        parameters: {},
        reasoning: "Retrieved Penpot sync states",
        finalResponse: `Found ${syncStates.length} synced wireframe(s).`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to list Penpot syncs", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: "Failed to retrieve sync states.",
        parameters: {},
        reasoning: "API error",
        finalResponse: "❌ Failed to list sync states.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Pull Mermaid diagrams from server
   * Fetches all mermaid diagrams for the project
   */
  async handlePullMermaid(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

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
            2,
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    try {
      // Fetch diagrams from server
      const serverDiagrams = await this.apiClient.fetchMermaidDiagrams(
        projectContext.projectId,
      );

      // Extract local context
      const localContext = extractMermaidContext(codebase);
      const projectName = localContext?.projectName || "your project";

      if (!serverDiagrams || serverDiagrams.length === 0) {
        // No diagrams on server, check local
        if (!localContext || localContext.diagrams.length === 0) {
          const response: XMLResponse = {
            requestId,
            action: "complete",
            instructions: generateMermaidNotFoundInstructions(projectName),
            parameters: {},
            reasoning: "No mermaid diagrams found locally or on server",
            finalResponse: "No mermaid diagrams found. Create new diagrams in .quikim/v1/diagrams/",
          };
          return this.formatToolResponse(response);
        }

        // Return local diagrams info
        const instructions = generateMermaidPullInstructions({
          projectName,
          diagramType: "flowchart",
          existingDiagrams: localContext.diagrams.map((d) => ({
            name: d.name,
            type: d.type,
          })),
        });

        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions: instructions + "\n\n**Note:** These diagrams exist locally but are not yet synced to the server. Use `push_mermaid` to sync them.",
          parameters: {},
          reasoning: "Found local diagrams, none on server",
          finalResponse: `Found ${localContext.diagrams.length} local mermaid diagram(s). Use push_mermaid to sync to server.`,
        };
        return this.formatToolResponse(response);
      }

      // Server has diagrams - create/update local files
      const latestVersion =
        projectContext.latestVersion ||
        projectContextResolver.getLatestVersion(codebase);

      const diagramFiles: Array<{ path: string; content: string }> = [];

      for (const diagram of serverDiagrams) {
        const filePath = getMermaidFilePath(
          latestVersion,
          diagram.diagramType,
          diagram.name,
        );
        const content = formatMermaidForMarkdown(
          diagram.content,
          diagram.name,
        );
        diagramFiles.push({ path: filePath, content });
      }

      const existingDiagrams = serverDiagrams.map((d) => ({
        name: d.name,
        type: d.diagramType,
      }));

      const instructions = generateMermaidPullInstructions({
        projectName,
        diagramType: "flowchart",
        existingDiagrams,
      });

      // Return the first diagram file for creation
      const firstDiagram = diagramFiles[0];
      const additionalDiagramsInfo = diagramFiles.length > 1
        ? `\n\n**Additional diagrams to create:**\n${diagramFiles.slice(1).map((d) => `- ${d.path}`).join("\n")}`
        : "";

      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: instructions + additionalDiagramsInfo,
        parameters: {
          filePath: firstDiagram?.path || `.quikim/v${latestVersion}/diagrams/diagram.md`,
          content: firstDiagram?.content || "# Mermaid Diagram\n\n```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```",
        },
        reasoning: `Fetched ${serverDiagrams.length} diagram(s) from server`,
        finalResponse: `Pulled ${serverDiagrams.length} mermaid diagram(s) from server.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to pull mermaid diagrams", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "mermaid diagrams",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API fetch failed",
        finalResponse: "Failed to pull mermaid diagrams from server.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Push Mermaid diagrams to server
   * Syncs local mermaid diagrams to the platform
   */
  async handlePushMermaid(
    codebase: CodebaseContext,
    _userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

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
            2,
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    // Extract local mermaid context
    const mermaidContext = extractMermaidContext(codebase);

    if (!mermaidContext || mermaidContext.diagrams.length === 0) {
      // Check for mermaid in HLD or ER diagram files
      const hldFile = codebase.files.find((f) =>
        f.path.match(/\.quikim\/v\d+\/hld\.md/),
      );
      const erFile = codebase.files.find((f) =>
        f.path.match(/\.quikim\/v\d+\/er-diagram\.md/),
      );

      const allMermaidBlocks: Array<{
        content: string;
        source: string;
        type: MermaidDiagramType;
      }> = [];

      if (hldFile) {
        const blocks = extractMermaidFromMarkdown(hldFile.content);
        blocks.forEach((block, idx) => {
          allMermaidBlocks.push({
            content: block,
            source: `hld-diagram-${idx + 1}`,
            type: detectMermaidDiagramType(block),
          });
        });
      }

      if (erFile) {
        const blocks = extractMermaidFromMarkdown(erFile.content);
        blocks.forEach((block, idx) => {
          allMermaidBlocks.push({
            content: block,
            source: `er-diagram-${idx + 1}`,
            type: detectMermaidDiagramType(block),
          });
        });
      }

      if (allMermaidBlocks.length === 0) {
        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions: generateMermaidNotFoundInstructions(
            mermaidContext?.projectName || "your project",
          ),
          parameters: {},
          reasoning: "No mermaid diagrams found to push",
          finalResponse: "No mermaid diagrams found. Create diagrams in .quikim/v1/diagrams/ first.",
        };
        return this.formatToolResponse(response);
      }

      // Push embedded diagrams from HLD/ER files
      try {
        const syncResults: string[] = [];

        for (const block of allMermaidBlocks) {
          const result = await this.apiClient.syncMermaidDiagram(
            projectContext.projectId,
            {
              content: block.content,
              diagramType: block.type,
              name: block.source,
              description: `Extracted from ${block.source.includes("hld") ? "HLD" : "ER diagram"} file`,
            },
          );

          if (result) {
            syncResults.push(`✅ ${block.source} (${block.type})`);
          } else {
            syncResults.push(`❌ ${block.source} - failed to sync`);
          }
        }

        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions: `**Mermaid Diagrams Synced**\n\nExtracted and synced diagrams from HLD/ER files:\n${syncResults.join("\n")}`,
          parameters: {},
          reasoning: "Synced embedded mermaid diagrams",
          finalResponse: `Synced ${allMermaidBlocks.length} embedded mermaid diagram(s) from HLD/ER files.`,
        };
        return this.formatToolResponse(response);
      } catch (error) {
        logger.error("Failed to sync embedded mermaid diagrams", { error });
        const response: XMLResponse = {
          requestId,
          action: "complete",
          instructions: generateSyncFailureInstructions(
            "mermaid diagrams",
            (error as Error).message,
          ),
          parameters: {},
          reasoning: "API sync failed",
          finalResponse: "Failed to sync mermaid diagrams.",
        };
        return this.formatToolResponse(response);
      }
    }

    // Push dedicated mermaid diagram files
    try {
      const syncResults: string[] = [];

      for (const diagram of mermaidContext.diagrams) {
        const result = await this.apiClient.syncMermaidDiagram(
          projectContext.projectId,
          {
            content: diagram.content,
            diagramType: diagram.type,
            name: diagram.name,
            description: `Synced from ${diagram.filePath}`,
          },
        );

        if (result) {
          syncResults.push(`✅ ${diagram.name} (${diagram.type}) - v${result.version}`);
        } else {
          syncResults.push(`❌ ${diagram.name} - failed to sync`);
        }
      }

      const successCount = syncResults.filter((r) => r.startsWith("✅")).length;

      const instructions = generateMermaidPushInstructions({
        projectName: mermaidContext.projectName,
        diagramType: mermaidContext.diagrams[0]?.type || "flowchart",
      });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: instructions + `\n\n**Sync Results:**\n${syncResults.join("\n")}`,
        parameters: {},
        reasoning: `Synced ${successCount}/${mermaidContext.diagrams.length} diagrams`,
        finalResponse: `Pushed ${successCount} mermaid diagram(s) to server.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to push mermaid diagrams", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "mermaid diagrams",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to push mermaid diagrams.",
      };
      return this.formatToolResponse(response);
    }
  }

  /**
   * Pull LLD - Fetch from server or generate new
   * Creates detailed low-level design for specific components
   */
  async handlePullLLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    // Validate prerequisites
    const prerequisites = validateLLDPrerequisites(codebase);
    if (!prerequisites.valid) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateRequirementsMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/requirements.md",
          content: "# Requirements\n\n[To be created]",
        },
        reasoning: "Prerequisites missing for LLD generation",
        finalResponse: "Please create requirements first.",
      };
      return this.formatToolResponse(response);
    }

    // Parse component name from user prompt
    const { componentName, componentType } = parseComponentFromPrompt(userPrompt);

    // If no component specified, list existing LLDs and suggest components
    if (!componentName) {
      const existingLLDs = extractExistingLLDs(codebase);
      const hldFile = codebase.files.find((f) =>
        f.path.match(/\.quikim\/v\d+\/hld\.md/),
      );
      const suggestions = hldFile ? suggestComponentsForLLD(hldFile.content) : [];
      const projectName = extractProjectName(codebase);

      const instructions = generateLLDPullInstructions({
        projectName: projectName || "your project",
        existingLLDs: existingLLDs.map((lld) => ({
          name: lld.name,
          type: lld.type,
          version: lld.version,
        })),
        hldSections: suggestions.map((s) => `${s.name} (${s.type}): ${s.reason}`),
      });

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions,
        parameters: {},
        reasoning: "No specific component specified - showing existing LLDs and suggestions",
        finalResponse: existingLLDs.length > 0
          ? `Found ${existingLLDs.length} existing LLD(s). Specify a component name to create/update LLD.`
          : "No LLDs found. Specify a component name to create LLD (e.g., 'pull_lld for auth service').",
      };
      return this.formatToolResponse(response);
    }

    // Check if HLD exists (warning if not)
    const hldFile = codebase.files.find((f) =>
      f.path.match(/\.quikim\/v\d+\/hld\.md/),
    );
    if (!hldFile && prerequisites.warnings.length > 0) {
      logger.warn("Creating LLD without HLD reference", { componentName });
    }

    // Extract LLD context
    const lldContext = extractLLDContext(codebase, componentName);
    if (!lldContext) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateContextExtractionFailedInstructions("LLD"),
        parameters: {
          filePath: `.quikim/v1/lld/${componentName.toLowerCase().replace(/\s+/g, "-")}.md`,
          content: `# Low-Level Design: ${componentName}\n\n[To be created]`,
        },
        reasoning: "Could not extract LLD context",
        finalResponse: "Please review requirements and create LLD manually.",
      };
      return this.formatToolResponse(response);
    }

    // Override component type if specified in prompt
    if (componentType) {
      lldContext.componentType = componentType;
    }

    const latestVersion =
      projectContext.latestVersion ||
      projectContextResolver.getLatestVersion(codebase);
    const filePath = getLLDFilePath(latestVersion, componentName);
    const instructions = generateLLDInstructions(lldContext);

    const response: XMLResponse = {
      requestId,
      action: "create_file",
      instructions:
        instructions + `\n\nSave to ${filePath}. Then create LLDs for other components or proceed to implementation.`,
      parameters: {
        filePath,
        content: `# Low-Level Design: ${componentName}\n\n[To be generated by Cursor]`,
      },
      reasoning: `Generating LLD for ${componentName} based on requirements and HLD`,
      finalResponse: `LLD file for ${componentName} will be created at ${filePath}.`,
    };
    return this.formatToolResponse(response);
  }

  /**
   * Push LLD - Sync local LLD to server
   */
  async handlePushLLD(
    codebase: CodebaseContext,
    userPrompt: string,
    projectContext: ProjectContext,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const requestId = this.generateRequestId();

    // Find LLD files
    const lldFiles = codebase.files.filter((f) =>
      f.path.match(/\.quikim\/v\d+\/lld\/.*\.md$/),
    );

    if (lldFiles.length === 0) {
      const response: XMLResponse = {
        requestId,
        action: "create_file",
        instructions: generateLLDMissingInstructions(),
        parameters: {
          filePath: ".quikim/v1/lld/component.md",
          content: "# Low-Level Design\n\n[To be created]",
        },
        reasoning: "No LLD files found",
        finalResponse: "Please create LLD first using pull_lld tool.",
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
            2,
          ),
        },
        reasoning: "Project context missing",
        finalResponse: "Please set up project context first.",
      };
      return this.formatToolResponse(response);
    }

    // Parse which LLD to push from prompt, or push all
    const { componentName } = parseComponentFromPrompt(userPrompt);
    const filesToPush = componentName
      ? lldFiles.filter((f) =>
          f.path.toLowerCase().includes(componentName.toLowerCase().replace(/\s+/g, "-")),
        )
      : lldFiles;

    if (filesToPush.length === 0) {
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: `No LLD found for component "${componentName}". Available LLDs:\n${lldFiles.map((f) => `- ${f.path}`).join("\n")}`,
        parameters: {},
        reasoning: "Specified component LLD not found",
        finalResponse: `LLD for "${componentName}" not found. Check available LLDs.`,
      };
      return this.formatToolResponse(response);
    }

    try {
      const syncResults: string[] = [];

      for (const lldFile of filesToPush) {
        const nameMatch = lldFile.path.match(/\/lld\/(.+)\.md$/);
        const lldName = nameMatch ? nameMatch[1] : "unknown";

        await this.apiClient.syncArtifact({
          projectId: projectContext.projectId,
          artifactType: "lld",
          content: lldFile.content,
          metadata: {
            componentName: lldName,
            filePath: lldFile.path,
          },
        });

        syncResults.push(`✅ ${lldName}`);
        logger.info("LLD synced to platform", {
          projectId: projectContext.projectId,
          component: lldName,
        });
      }

      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateLLDPushInstructions(
          filesToPush.length === 1
            ? filesToPush[0].path.match(/\/lld\/(.+)\.md$/)?.[1] || "component"
            : `${filesToPush.length} components`,
        ) + `\n\n**Sync Results:**\n${syncResults.join("\n")}`,
        parameters: {},
        reasoning: `Synced ${filesToPush.length} LLD(s) to database`,
        finalResponse: `${filesToPush.length} LLD(s) successfully synced to Quikim platform.`,
      };
      return this.formatToolResponse(response);
    } catch (error) {
      logger.error("Failed to sync LLD", { error });
      const response: XMLResponse = {
        requestId,
        action: "complete",
        instructions: generateSyncFailureInstructions(
          "LLD",
          (error as Error).message,
        ),
        parameters: {},
        reasoning: "API sync failed",
        finalResponse: "Failed to sync LLD. Please check your API configuration.",
      };
      return this.formatToolResponse(response);
    }
  }
}
