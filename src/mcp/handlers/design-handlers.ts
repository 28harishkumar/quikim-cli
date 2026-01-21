/**
 * Design Handlers
 * Push and pull handlers for HLD, wireframes, ER diagrams
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
  generateRequirementsMissingInstructions,
  generateHLDMissingInstructions,
  generateWireframesMissingInstructions,
  generateERDiagramMissingInstructions,
  generateArtifactSyncedInstructions,
  generateContextExtractionFailedInstructions,
  generateProjectContextInstructions,
  generateSyncFailureInstructions,
} from '../instructions/tool-responses.js';
import { BaseHandler } from './base-handler.js';
import { logger } from '../utils/logger.js';

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
}
