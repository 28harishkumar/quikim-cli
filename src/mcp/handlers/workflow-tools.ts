/**
 * Quikim - MCP Workflow Engine Tools
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

// Lazy import to avoid circular dependency: server.ts -> workflow-tools.ts -> integration/index.ts -> server.ts
// import { protocolIntegration } from '../integration/index.js';
import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';

/**
 * Workflow Engine MCP Tools
 * Provides MCP tools for workflow engine integration
 */
export class WorkflowEngineTools {
  /**
   * List all available workflow tools
   */
  static async listTools(): Promise<any[]> {
    return [
      {
        name: "detect_change",
        description: "Detect and record a change event in the workflow engine",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID"
            },
            artifactType: {
              type: "string",
              enum: ["requirements", "design", "wireframes", "code", "tests"],
              description: "Type of artifact being changed"
            },
            artifactId: {
              type: "string",
              description: "ID of the artifact"
            },
            changeType: {
              type: "string",
              enum: ["create", "update", "delete"],
              description: "Type of change"
            },
            changeCategory: {
              type: "string",
              enum: ["breaking", "feature", "refactor", "fix", "docs", "style"],
              description: "Category of change"
            },
            oldContent: {
              type: "string",
              description: "Previous content (optional for create operations)"
            },
            newContent: {
              type: "string",
              description: "New content"
            },
            userId: {
              type: "string",
              description: "User making the change"
            },
            message: {
              type: "string",
              description: "Optional change message"
            }
          },
          required: ["projectId", "artifactType", "artifactId", "changeType", "changeCategory", "newContent", "userId"]
        }
      },
      {
        name: "analyze_impact",
        description: "Analyze the impact of a change event",
        inputSchema: {
          type: "object",
          properties: {
            changeEventId: {
              type: "string",
              description: "ID of the change event to analyze"
            }
          },
          required: ["changeEventId"]
        }
      },
      {
        name: "generate_propagation_plan",
        description: "Generate a propagation plan from impact analysis",
        inputSchema: {
          type: "object",
          properties: {
            impactAnalysisId: {
              type: "string",
              description: "ID of the impact analysis"
            }
          },
          required: ["impactAnalysisId"]
        }
      },
      {
        name: "execute_propagation",
        description: "Execute a propagation plan",
        inputSchema: {
          type: "object",
          properties: {
            propagationPlanId: {
              type: "string",
              description: "ID of the propagation plan to execute"
            },
            executorId: {
              type: "string",
              description: "ID of the user executing the plan"
            }
          },
          required: ["propagationPlanId", "executorId"]
        }
      },
      {
        name: "acquire_lock",
        description: "Acquire a resource lock",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID"
            },
            resourceType: {
              type: "string",
              enum: ["requirements", "design", "wireframes", "code", "tests"],
              description: "Type of resource to lock"
            },
            resourceId: {
              type: "string",
              description: "ID of the resource"
            },
            lockType: {
              type: "string",
              enum: ["read", "write", "exclusive"],
              description: "Type of lock"
            },
            lockedBy: {
              type: "string",
              description: "User acquiring the lock"
            },
            reason: {
              type: "string",
              description: "Reason for the lock"
            },
            expiresAt: {
              type: "string",
              description: "Lock expiration time (ISO string)"
            }
          },
          required: ["projectId", "resourceType", "resourceId", "lockType", "lockedBy"]
        }
      },
      {
        name: "release_lock",
        description: "Release a resource lock",
        inputSchema: {
          type: "object",
          properties: {
            lockId: {
              type: "string",
              description: "ID of the lock to release"
            }
          },
          required: ["lockId"]
        }
      },
      {
        name: "sync_to_ide",
        description: "Sync artifact content to IDE",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID"
            },
            artifactType: {
              type: "string",
              enum: ["requirements", "design", "wireframes", "code", "tests"],
              description: "Type of artifact"
            },
            artifactId: {
              type: "string",
              description: "ID of the artifact"
            },
            content: {
              type: "string",
              description: "Content to sync"
            },
            userId: {
              type: "string",
              description: "User performing the sync"
            }
          },
          required: ["projectId", "artifactType", "artifactId", "content", "userId"]
        }
      },
      {
        name: "sync_from_ide",
        description: "Sync artifact content from IDE",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID"
            },
            artifactType: {
              type: "string",
              enum: ["requirements", "design", "wireframes", "code", "tests"],
              description: "Type of artifact"
            },
            artifactId: {
              type: "string",
              description: "ID of the artifact"
            },
            content: {
              type: "string",
              description: "Content to sync"
            },
            userId: {
              type: "string",
              description: "User performing the sync"
            }
          },
          required: ["projectId", "artifactType", "artifactId", "content", "userId"]
        }
      },
      {
        name: "generate_code_from_requirements",
        description: "Generate code from requirements using AI",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID"
            },
            requirementsId: {
              type: "string",
              description: "Requirements artifact ID"
            },
            requirementsContent: {
              type: "string",
              description: "Requirements content"
            },
            userId: {
              type: "string",
              description: "User requesting generation"
            },
            targetLanguage: {
              type: "string",
              description: "Target programming language"
            },
            targetFramework: {
              type: "string",
              description: "Target framework"
            },
            options: {
              type: "object",
              properties: {
                includeTests: { type: "boolean" },
                includeDocumentation: { type: "boolean" },
                codeStyle: { 
                  type: "string",
                  enum: ["functional", "object_oriented", "mixed"]
                },
                testFramework: { type: "string" },
                includeTypeDefinitions: { type: "boolean" },
                generateComments: { type: "boolean" },
                optimizeForPerformance: { type: "boolean" },
                followBestPractices: { type: "boolean" }
              },
              description: "Code generation options"
            }
          },
          required: ["projectId", "requirementsId", "requirementsContent", "userId", "options"]
        }
      },
      {
        name: "generate_code_from_design",
        description: "Generate code from design documents using AI",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID"
            },
            designId: {
              type: "string",
              description: "Design artifact ID"
            },
            designContent: {
              type: "string",
              description: "Design content"
            },
            userId: {
              type: "string",
              description: "User requesting generation"
            },
            targetLanguage: {
              type: "string",
              description: "Target programming language"
            },
            targetFramework: {
              type: "string",
              description: "Target framework"
            },
            options: {
              type: "object",
              properties: {
                includeTests: { type: "boolean" },
                includeDocumentation: { type: "boolean" },
                codeStyle: { 
                  type: "string",
                  enum: ["functional", "object_oriented", "mixed"]
                },
                testFramework: { type: "string" },
                includeTypeDefinitions: { type: "boolean" },
                generateComments: { type: "boolean" },
                optimizeForPerformance: { type: "boolean" },
                followBestPractices: { type: "boolean" }
              },
              description: "Code generation options"
            }
          },
          required: ["projectId", "designId", "designContent", "userId", "options"]
        }
      }
    ];
  }

  /**
   * Handle tool calls
   */
  static async handleToolCall(request: any): Promise<any> {
    const context: ErrorContext = {
      operation: "handleWorkflowToolCall",
      additionalData: { toolName: request.params?.name }
    };

    try {
      const { name, arguments: args } = request.params;
      // Lazy import to avoid circular dependency
      const { protocolIntegration } = await import('../integration/index.js');
      const components = protocolIntegration.getComponents();

      switch (name) {
        case "detect_change":
          return await WorkflowEngineTools.handleDetectChange(args, components);

        case "analyze_impact":
          return await WorkflowEngineTools.handleAnalyzeImpact(args, components);

        case "generate_propagation_plan":
          return await WorkflowEngineTools.handleGeneratePropagationPlan(args, components);

        case "execute_propagation":
          return await WorkflowEngineTools.handleExecutePropagation(args, components);

        case "acquire_lock":
          return await WorkflowEngineTools.handleAcquireLock(args, components);

        case "release_lock":
          return await WorkflowEngineTools.handleReleaseLock(args, components);

        case "sync_to_ide":
          return await WorkflowEngineTools.handleSyncToIDE(args, components);

        case "sync_from_ide":
          return await WorkflowEngineTools.handleSyncFromIDE(args, components);

        case "generate_code_from_requirements":
          return await WorkflowEngineTools.handleGenerateCodeFromRequirements(args, components);

        case "generate_code_from_design":
          return await WorkflowEngineTools.handleGenerateCodeFromDesign(args, components);

        default:
          throw new Error(`Unknown workflow tool: ${name}`);
      }

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (recoveryResult.success && recoveryResult.fallbackData) {
        return {
          content: [{
            type: "text",
            text: `Tool execution failed but recovered: ${recoveryResult.fallbackData.message || "Unknown recovery"}`
          }]
        };
      }

      logger.logError("Failed to handle workflow tool call", error);
      return {
        content: [{
          type: "text",
          text: `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`
        }],
        isError: true
      };
    }
  }

  // Tool handler methods

  private static async handleDetectChange(args: any, components: any): Promise<any> {
    const changeEvent = await components.workflowIntegration.detectChange(
      args.projectId,
      args.artifactType,
      args.artifactId,
      args.changeType,
      args.changeCategory,
      args.oldContent,
      args.newContent,
      args.userId,
      args.message
    );

    return {
      content: [{
        type: "text",
        text: `Change detected successfully. Change Event ID: ${changeEvent.id}`
      }]
    };
  }

  private static async handleAnalyzeImpact(args: any, components: any): Promise<any> {
    const impactAnalysis = await components.workflowIntegration.analyzeImpact(args.changeEventId);

    return {
      content: [{
        type: "text",
        text: `Impact analysis completed. Analysis ID: ${impactAnalysis.id}\nAffected artifacts: ${impactAnalysis.affectedArtifacts.length}\nRisk level: ${impactAnalysis.riskLevel}\nRequires approval: ${impactAnalysis.requiresApproval}`
      }]
    };
  }

  private static async handleGeneratePropagationPlan(args: any, components: any): Promise<any> {
    const propagationPlan = await components.workflowIntegration.generatePropagationPlan(args.impactAnalysisId);

    return {
      content: [{
        type: "text",
        text: `Propagation plan generated. Plan ID: ${propagationPlan.id}\nSteps: ${propagationPlan.steps.length}\nStatus: ${propagationPlan.status}`
      }]
    };
  }

  private static async handleExecutePropagation(args: any, components: any): Promise<any> {
    const result = await components.workflowIntegration.executePropagation(
      args.propagationPlanId,
      args.executorId
    );

    return {
      content: [{
        type: "text",
        text: `Propagation execution ${result.success ? "completed successfully" : "failed"}${result.errors ? `\nErrors: ${result.errors.join(", ")}` : ""}`
      }]
    };
  }

  private static async handleAcquireLock(args: any, components: any): Promise<any> {
    const lock = await components.workflowIntegration.acquireLock(
      args.projectId,
      args.resourceType,
      args.resourceId,
      args.lockType,
      args.lockedBy,
      args.reason,
      args.expiresAt ? new Date(args.expiresAt) : undefined
    );

    return {
      content: [{
        type: "text",
        text: `Lock acquired successfully. Lock ID: ${lock.id}\nType: ${lock.lockType}\nExpires: ${lock.expiresAt || "Never"}`
      }]
    };
  }

  private static async handleReleaseLock(args: any, components: any): Promise<any> {
    await components.workflowIntegration.releaseLock(args.lockId);

    return {
      content: [{
        type: "text",
        text: `Lock ${args.lockId} released successfully`
      }]
    };
  }

  private static async handleSyncToIDE(args: any, components: any): Promise<any> {
    const status = await components.bidirectionalSync.syncToIDE(
      args.projectId,
      args.artifactType,
      args.artifactId,
      args.content,
      args.userId
    );

    return {
      content: [{
        type: "text",
        text: `Sync to IDE ${status.status === "synced" ? "completed successfully" : `failed: ${status.errorMessage || status.conflictReason || "Unknown error"}`}`
      }]
    };
  }

  private static async handleSyncFromIDE(args: any, components: any): Promise<any> {
    const status = await components.bidirectionalSync.syncFromIDE(
      args.projectId,
      args.artifactType,
      args.artifactId,
      args.content,
      args.userId
    );

    return {
      content: [{
        type: "text",
        text: `Sync from IDE ${status.status === "synced" ? "completed successfully" : `failed: ${status.errorMessage || status.conflictReason || "Unknown error"}`}`
      }]
    };
  }

  private static async handleGenerateCodeFromRequirements(args: any, components: any): Promise<any> {
    const generatedCode = await components.codeGeneration.generateFromRequirements(
      args.projectId,
      args.requirementsId,
      args.requirementsContent,
      args.userId,
      args.options,
      args.targetLanguage,
      args.targetFramework
    );

    return {
      content: [{
        type: "text",
        text: `Code generated successfully from requirements!\n\nGeneration ID: ${generatedCode.id}\nFiles generated: ${generatedCode.files.length}\nLines of code: ${generatedCode.metadata.linesOfCode}\nQuality score: ${generatedCode.quality.score}/100\nComplexity: ${generatedCode.metadata.complexity}\n\nGenerated files:\n${generatedCode.files.map((f: any) => `- ${f.path} (${f.type})`).join("\n")}\n\nSuggestions:\n${generatedCode.suggestions.map((s: string) => `- ${s}`).join("\n")}`
      }]
    };
  }

  private static async handleGenerateCodeFromDesign(args: any, components: any): Promise<any> {
    const generatedCode = await components.codeGeneration.generateFromDesign(
      args.projectId,
      args.designId,
      args.designContent,
      args.userId,
      args.options,
      args.targetLanguage,
      args.targetFramework
    );

    return {
      content: [{
        type: "text",
        text: `Code generated successfully from design!\n\nGeneration ID: ${generatedCode.id}\nFiles generated: ${generatedCode.files.length}\nLines of code: ${generatedCode.metadata.linesOfCode}\nQuality score: ${generatedCode.quality.score}/100\nComplexity: ${generatedCode.metadata.complexity}\n\nGenerated files:\n${generatedCode.files.map((f: any) => `- ${f.path} (${f.type})`).join("\n")}\n\nSuggestions:\n${generatedCode.suggestions.map((s: string) => `- ${s}`).join("\n")}`
      }]
    };
  }
}