/**
 * Quikim - MCP-based Code Generation Service
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { logger } from '../utils/logger.js';
import { errorHandler, ErrorContext } from '../utils/error-handler.js';
import { WorkflowIntegrationService, ArtifactType } from './workflow-integration.js';

export interface CodeGenerationRequest {
  id: string;
  projectId: string;
  userId: string;
  generationType: CodeGenerationType;
  sourceArtifact: {
    type: ArtifactType;
    id: string;
    content: string;
  };
  targetLanguage?: string;
  targetFramework?: string;
  generationOptions: CodeGenerationOptions;
  metadata?: any;
}

export type CodeGenerationType =
  | "requirements_to_code"
  | "design_to_code"
  | "wireframes_to_code"
  | "tests_to_code"
  | "code_refactor"
  | "code_optimization"
  | "api_generation"
  | "database_schema"
  | "component_generation";

export interface CodeGenerationOptions {
  includeTests: boolean;
  includeDocumentation: boolean;
  codeStyle: "functional" | "object_oriented" | "mixed";
  testFramework?: string;
  includeTypeDefinitions: boolean;
  generateComments: boolean;
  optimizeForPerformance: boolean;
  followBestPractices: boolean;
  customTemplates?: string[];
  excludePatterns?: string[];
}

export interface GeneratedCode {
  id: string;
  requestId: string;
  files: GeneratedFile[];
  metadata: GenerationMetadata;
  quality: CodeQuality;
  suggestions: string[];
  warnings: string[];
  createdAt: Date;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  type: "source" | "test" | "config" | "documentation";
  dependencies: string[];
  exports: string[];
  imports: string[];
  metadata?: any;
}

export interface GenerationMetadata {
  sourceArtifact: {
    type: ArtifactType;
    id: string;
    checksum: string;
  };
  generationType: CodeGenerationType;
  targetLanguage: string;
  targetFramework?: string;
  generationTime: number; // milliseconds
  linesOfCode: number;
  complexity: "low" | "medium" | "high";
  coverage: number; // percentage
}

export interface CodeQuality {
  score: number; // 0-100
  metrics: {
    maintainability: number;
    readability: number;
    testability: number;
    performance: number;
    security: number;
  };
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: "error" | "warning" | "info";
  category: "syntax" | "logic" | "performance" | "security" | "style";
  message: string;
  file: string;
  line?: number;
  column?: number;
  severity: "low" | "medium" | "high" | "critical";
  suggestion?: string;
}

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  framework?: string;
  category: string;
  template: string;
  variables: TemplateVariable[];
  dependencies: string[];
  metadata?: any;
}

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: string; // regex pattern
}

export interface GenerationContext {
  projectId: string;
  projectMetadata?: any;
  existingCode?: {
    files: string[];
    dependencies: string[];
    architecture: string;
  };
  requirements?: string;
  design?: string;
  wireframes?: any;
  constraints?: string[];
}

export interface CodeGenerationConfig {
  maxGenerationTime: number; // milliseconds
  maxFilesPerGeneration: number;
  maxLinesPerFile: number;
  enableQualityAnalysis: boolean;
  enableOptimization: boolean;
  defaultLanguage: string;
  defaultFramework?: string;
  templateDirectory?: string;
  customPrompts?: Record<string, string>;
}

/**
 * MCP-based Code Generation Service
 * Provides AI-powered code generation capabilities integrated with the workflow engine
 */
export class CodeGenerationService {
  private workflowIntegration: WorkflowIntegrationService;
  private config: CodeGenerationConfig;
  private templates: Map<string, CodeTemplate> = new Map();
  private generationHistory: Map<string, GeneratedCode> = new Map();
  private activeGenerations: Map<string, CodeGenerationRequest> = new Map();
  private isInitialized: boolean = false;

  constructor(
    workflowIntegration: WorkflowIntegrationService,
    config: CodeGenerationConfig
  ) {
    this.workflowIntegration = workflowIntegration;
    this.config = config;
  }

  /**
   * Initialize the code generation service
   */
  async initialize(): Promise<void> {
    const context: ErrorContext = {
      operation: "initializeCodeGeneration",
      additionalData: { config: this.config }
    };

    try {
      logger.info("Initializing code generation service", this.config);

      // Validate configuration
      this.validateConfiguration();

      // Load default templates
      await this.loadDefaultTemplates();

      // Load custom templates if directory specified
      if (this.config.templateDirectory) {
        await this.loadCustomTemplates(this.config.templateDirectory);
      }

      this.isInitialized = true;
      logger.info("Code generation service initialized successfully", {
        templatesLoaded: this.templates.size
      });

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to initialize code generation", error);
        throw new Error(`Code generation initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      logger.warn("Code generation initialized with limited functionality");
      this.isInitialized = true;
    }
  }

  /**
   * Generate code from requirements
   */
  async generateFromRequirements(
    projectId: string,
    requirementsId: string,
    requirementsContent: string,
    userId: string,
    options: CodeGenerationOptions,
    targetLanguage?: string,
    targetFramework?: string
  ): Promise<GeneratedCode> {
    const context: ErrorContext = {
      operation: "generateFromRequirements",
      userId,
      additionalData: { projectId, requirementsId, targetLanguage }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Code generation not initialized");
      }

      logger.info("Generating code from requirements", {
        projectId,
        requirementsId,
        targetLanguage,
        targetFramework,
        userId
      });

      const request: CodeGenerationRequest = {
        id: this.generateId(),
        projectId,
        userId,
        generationType: "requirements_to_code",
        sourceArtifact: {
          type: "requirements",
          id: requirementsId,
          content: requirementsContent
        },
        targetLanguage: targetLanguage || this.config.defaultLanguage,
        targetFramework: targetFramework || this.config.defaultFramework,
        generationOptions: options
      };

      return await this.executeGeneration(request);

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to generate code from requirements", error);
        throw error;
      }

      // Return a fallback generated code
      return this.createFallbackGeneratedCode(
        this.generateId(),
        "requirements_to_code",
        targetLanguage || this.config.defaultLanguage
      );
    }
  }

  /**
   * Generate code from design documents
   */
  async generateFromDesign(
    projectId: string,
    designId: string,
    designContent: string,
    userId: string,
    options: CodeGenerationOptions,
    targetLanguage?: string,
    targetFramework?: string
  ): Promise<GeneratedCode> {
    const context: ErrorContext = {
      operation: "generateFromDesign",
      userId,
      additionalData: { projectId, designId, targetLanguage }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Code generation not initialized");
      }

      logger.info("Generating code from design", {
        projectId,
        designId,
        targetLanguage,
        targetFramework,
        userId
      });

      const request: CodeGenerationRequest = {
        id: this.generateId(),
        projectId,
        userId,
        generationType: "design_to_code",
        sourceArtifact: {
          type: "design",
          id: designId,
          content: designContent
        },
        targetLanguage: targetLanguage || this.config.defaultLanguage,
        targetFramework: targetFramework || this.config.defaultFramework,
        generationOptions: options
      };

      return await this.executeGeneration(request);

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to generate code from design", error);
        throw error;
      }

      return this.createFallbackGeneratedCode(
        this.generateId(),
        "design_to_code",
        targetLanguage || this.config.defaultLanguage
      );
    }
  }

  /**
   * Generate code from wireframes
   */
  async generateFromWireframes(
    projectId: string,
    wireframesId: string,
    wireframesContent: string,
    userId: string,
    options: CodeGenerationOptions,
    targetLanguage?: string,
    targetFramework?: string
  ): Promise<GeneratedCode> {
    const context: ErrorContext = {
      operation: "generateFromWireframes",
      userId,
      additionalData: { projectId, wireframesId, targetLanguage }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Code generation not initialized");
      }

      logger.info("Generating code from wireframes", {
        projectId,
        wireframesId,
        targetLanguage,
        targetFramework,
        userId
      });

      const request: CodeGenerationRequest = {
        id: this.generateId(),
        projectId,
        userId,
        generationType: "wireframes_to_code",
        sourceArtifact: {
          type: "wireframes",
          id: wireframesId,
          content: wireframesContent
        },
        targetLanguage: targetLanguage || this.config.defaultLanguage,
        targetFramework: targetFramework || this.config.defaultFramework,
        generationOptions: options
      };

      return await this.executeGeneration(request);

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to generate code from wireframes", error);
        throw error;
      }

      return this.createFallbackGeneratedCode(
        this.generateId(),
        "wireframes_to_code",
        targetLanguage || this.config.defaultLanguage
      );
    }
  }

  /**
   * Generate tests for existing code
   */
  async generateTests(
    projectId: string,
    codeId: string,
    codeContent: string,
    userId: string,
    options: CodeGenerationOptions,
    testFramework?: string
  ): Promise<GeneratedCode> {
    const context: ErrorContext = {
      operation: "generateTests",
      userId,
      additionalData: { projectId, codeId, testFramework }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Code generation not initialized");
      }

      logger.info("Generating tests for code", {
        projectId,
        codeId,
        testFramework,
        userId
      });

      const request: CodeGenerationRequest = {
        id: this.generateId(),
        projectId,
        userId,
        generationType: "tests_to_code",
        sourceArtifact: {
          type: "code",
          id: codeId,
          content: codeContent
        },
        generationOptions: {
          ...options,
          includeTests: true,
          testFramework: testFramework || options.testFramework
        }
      };

      return await this.executeGeneration(request);

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to generate tests", error);
        throw error;
      }

      return this.createFallbackGeneratedCode(
        this.generateId(),
        "tests_to_code",
        "typescript"
      );
    }
  }

  /**
   * Refactor existing code
   */
  async refactorCode(
    projectId: string,
    codeId: string,
    codeContent: string,
    userId: string,
    refactorType: "optimize" | "modernize" | "restructure" | "cleanup",
    options: CodeGenerationOptions
  ): Promise<GeneratedCode> {
    const context: ErrorContext = {
      operation: "refactorCode",
      userId,
      additionalData: { projectId, codeId, refactorType }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Code generation not initialized");
      }

      logger.info("Refactoring code", {
        projectId,
        codeId,
        refactorType,
        userId
      });

      const request: CodeGenerationRequest = {
        id: this.generateId(),
        projectId,
        userId,
        generationType: refactorType === "optimize" ? "code_optimization" : "code_refactor",
        sourceArtifact: {
          type: "code",
          id: codeId,
          content: codeContent
        },
        generationOptions: {
          ...options,
          optimizeForPerformance: refactorType === "optimize"
        },
        metadata: { refactorType }
      };

      return await this.executeGeneration(request);

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to refactor code", error);
        throw error;
      }

      return this.createFallbackGeneratedCode(
        this.generateId(),
        "code_refactor",
        "typescript"
      );
    }
  }

  /**
   * Get available templates
   */
  getTemplates(
    language?: string,
    framework?: string,
    category?: string
  ): CodeTemplate[] {
    let templates = Array.from(this.templates.values());

    if (language) {
      templates = templates.filter(t => t.language === language);
    }

    if (framework) {
      templates = templates.filter(t => t.framework === framework);
    }

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return templates;
  }

  /**
   * Add a custom template
   */
  async addTemplate(template: CodeTemplate): Promise<void> {
    const context: ErrorContext = {
      operation: "addTemplate",
      additionalData: { templateId: template.id, language: template.language }
    };

    try {
      if (!this.isInitialized) {
        throw new Error("Code generation not initialized");
      }

      // Validate template
      this.validateTemplate(template);

      this.templates.set(template.id, template);
      
      logger.info("Template added successfully", {
        templateId: template.id,
        name: template.name,
        language: template.language
      });

    } catch (error) {
      const recoveryResult = await errorHandler.handleError(error, context);
      
      if (!recoveryResult.success) {
        logger.logError("Failed to add template", error);
        throw error;
      }
    }
  }

  /**
   * Get generation history
   */
  getGenerationHistory(
    projectId?: string,
    userId?: string,
    limit: number = 50
  ): GeneratedCode[] {
    let history = Array.from(this.generationHistory.values());

    // Filter by project if specified
    if (projectId) {
      // Would need to store projectId in GeneratedCode for proper filtering
      // For now, return all
    }

    // Filter by user if specified
    if (userId) {
      // Would need to store userId in GeneratedCode for proper filtering
      // For now, return all
    }

    return history
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get generation by ID
   */
  getGeneration(generationId: string): GeneratedCode | undefined {
    return this.generationHistory.get(generationId);
  }

  /**
   * Stop the code generation service
   */
  async stop(): Promise<void> {
    logger.info("Stopping code generation service");

    // Cancel active generations
    for (const [requestId] of this.activeGenerations) {
      logger.info(`Cancelling active generation: ${requestId}`);
    }
    this.activeGenerations.clear();

    this.isInitialized = false;
    logger.info("Code generation service stopped");
  }

  // Private helper methods

  private validateConfiguration(): void {
    if (this.config.maxGenerationTime <= 0) {
      throw new Error("Max generation time must be greater than 0");
    }

    if (this.config.maxFilesPerGeneration <= 0) {
      throw new Error("Max files per generation must be greater than 0");
    }

    if (this.config.maxLinesPerFile <= 0) {
      throw new Error("Max lines per file must be greater than 0");
    }

    if (!this.config.defaultLanguage) {
      throw new Error("Default language is required");
    }
  }

  private async loadDefaultTemplates(): Promise<void> {
    // Load built-in templates
    const defaultTemplates: CodeTemplate[] = [
      {
        id: "react-component",
        name: "React Component",
        description: "Basic React functional component template",
        language: "typescript",
        framework: "react",
        category: "component",
        template: `import React from 'react';

interface {{componentName}}Props {
  // Add props here
}

export const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  return (
    <div>
      {/* Component content */}
    </div>
  );
};

export default {{componentName}};`,
        variables: [
          {
            name: "componentName",
            type: "string",
            description: "Name of the React component",
            required: true
          }
        ],
        dependencies: ["react", "@types/react"]
      },
      {
        id: "express-route",
        name: "Express Route",
        description: "Express.js route handler template",
        language: "typescript",
        framework: "express",
        category: "api",
        template: `import { Request, Response } from 'express';

export const {{routeName}} = async (req: Request, res: Response) => {
  try {
    // Route logic here
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};`,
        variables: [
          {
            name: "routeName",
            type: "string",
            description: "Name of the route handler",
            required: true
          }
        ],
        dependencies: ["express", "@types/express"]
      }
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }

    logger.info(`Loaded ${defaultTemplates.length} default templates`);
  }

  private async loadCustomTemplates(directory: string): Promise<void> {
    // Implementation would load templates from filesystem
    logger.info(`Loading custom templates from: ${directory}`);
  }

  private validateTemplate(template: CodeTemplate): void {
    if (!template.id || !template.name || !template.language || !template.template) {
      throw new Error("Template must have id, name, language, and template content");
    }

    if (this.templates.has(template.id)) {
      throw new Error(`Template with id '${template.id}' already exists`);
    }
  }

  private async executeGeneration(request: CodeGenerationRequest): Promise<GeneratedCode> {
    const startTime = Date.now();
    this.activeGenerations.set(request.id, request);

    try {
      logger.info("Executing code generation", {
        requestId: request.id,
        generationType: request.generationType,
        targetLanguage: request.targetLanguage
      });

      // Simulate code generation process
      const generatedFiles = await this.generateFiles(request);
      const generationTime = Date.now() - startTime;

      // Analyze code quality if enabled
      let quality: CodeQuality = {
        score: 85,
        metrics: {
          maintainability: 85,
          readability: 90,
          testability: 80,
          performance: 85,
          security: 90
        },
        issues: []
      };

      if (this.config.enableQualityAnalysis) {
        quality = await this.analyzeCodeQuality(generatedFiles);
      }

      // Create generated code result
      const generatedCode: GeneratedCode = {
        id: this.generateId(),
        requestId: request.id,
        files: generatedFiles,
        metadata: {
          sourceArtifact: {
            type: request.sourceArtifact.type,
            id: request.sourceArtifact.id,
            checksum: this.calculateChecksum(request.sourceArtifact.content)
          },
          generationType: request.generationType,
          targetLanguage: request.targetLanguage || this.config.defaultLanguage,
          targetFramework: request.targetFramework,
          generationTime,
          linesOfCode: generatedFiles.reduce((total, file) => 
            total + file.content.split("\n").length, 0
          ),
          complexity: this.assessComplexity(generatedFiles),
          coverage: request.generationOptions.includeTests ? 85 : 0
        },
        quality,
        suggestions: this.generateSuggestions(generatedFiles, request.generationOptions),
        warnings: this.generateWarnings(generatedFiles),
        createdAt: new Date()
      };

      // Store in history
      this.generationHistory.set(generatedCode.id, generatedCode);

      // Record change in workflow engine
      await this.workflowIntegration.detectChange(
        request.projectId,
        "code",
        generatedCode.id,
        "create",
        "feature",
        undefined,
        JSON.stringify(generatedCode),
        request.userId,
        `Generated code from ${request.sourceArtifact.type}`,
        { generationType: request.generationType }
      );

      logger.info("Code generation completed successfully", {
        requestId: request.id,
        generatedId: generatedCode.id,
        filesGenerated: generatedFiles.length,
        generationTime,
        qualityScore: quality.score
      });

      return generatedCode;

    } finally {
      this.activeGenerations.delete(request.id);
    }
  }

  private async generateFiles(request: CodeGenerationRequest): Promise<GeneratedFile[]> {
    // Mock implementation - in practice would use AI/LLM for generation
    const files: GeneratedFile[] = [];

    switch (request.generationType) {
      case "requirements_to_code":
        files.push({
          path: "src/main.ts",
          content: `// Generated from requirements\n// ${request.sourceArtifact.id}\n\nexport class Application {\n  start() {\n    console.log('Application started');\n  }\n}`,
          language: request.targetLanguage || "typescript",
          type: "source",
          dependencies: [],
          exports: ["Application"],
          imports: []
        });
        break;

      case "design_to_code":
        files.push({
          path: "src/components/Component.tsx",
          content: `// Generated from design\n// ${request.sourceArtifact.id}\n\nimport React from 'react';\n\nexport const Component: React.FC = () => {\n  return <div>Generated Component</div>;\n};`,
          language: request.targetLanguage || "typescript",
          type: "source",
          dependencies: ["react"],
          exports: ["Component"],
          imports: ["React"]
        });
        break;

      case "wireframes_to_code":
        files.push({
          path: "src/pages/Page.tsx",
          content: `// Generated from wireframes\n// ${request.sourceArtifact.id}\n\nimport React from 'react';\n\nexport const Page: React.FC = () => {\n  return (\n    <div className="page">\n      <h1>Generated Page</h1>\n    </div>\n  );\n};`,
          language: request.targetLanguage || "typescript",
          type: "source",
          dependencies: ["react"],
          exports: ["Page"],
          imports: ["React"]
        });
        break;

      case "tests_to_code":
        files.push({
          path: "src/__tests__/test.spec.ts",
          content: `// Generated tests\n// ${request.sourceArtifact.id}\n\ndescribe('Generated Tests', () => {\n  it('should pass', () => {\n    expect(true).toBe(true);\n  });\n});`,
          language: request.targetLanguage || "typescript",
          type: "test",
          dependencies: ["jest", "@types/jest"],
          exports: [],
          imports: []
        });
        break;

      default:
        files.push({
          path: "src/generated.ts",
          content: `// Generated code\n// Type: ${request.generationType}\n\nexport const generated = true;`,
          language: request.targetLanguage || "typescript",
          type: "source",
          dependencies: [],
          exports: ["generated"],
          imports: []
        });
    }

    // Add tests if requested
    if (request.generationOptions.includeTests && request.generationType !== "tests_to_code") {
      files.push({
        path: "src/__tests__/generated.test.ts",
        content: `// Generated tests\n\ndescribe('Generated Code', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});`,
        language: request.targetLanguage || "typescript",
        type: "test",
        dependencies: ["jest"],
        exports: [],
        imports: []
      });
    }

    return files;
  }

  private async analyzeCodeQuality(files: GeneratedFile[]): Promise<CodeQuality> {
    // Mock quality analysis
    const issues: QualityIssue[] = [];
    let totalScore = 0;
    let fileCount = 0;

    for (const file of files) {
      if (file.type === "source") {
        fileCount++;
        
        // Simple quality checks
        const lines = file.content.split("\n");
        let fileScore = 100;

        // Check for long lines
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length > 120) {
            issues.push({
              type: "warning",
              category: "style",
              message: "Line too long (>120 characters)",
              file: file.path,
              line: i + 1,
              severity: "low",
              suggestion: "Break long lines for better readability"
            });
            fileScore -= 2;
          }
        }

        // Check for TODO comments
        if (file.content.includes("TODO") || file.content.includes("FIXME")) {
          issues.push({
            type: "info",
            category: "logic",
            message: "Contains TODO/FIXME comments",
            file: file.path,
            severity: "low",
            suggestion: "Complete TODO items before production"
          });
          fileScore -= 1;
        }

        totalScore += Math.max(fileScore, 0);
      }
    }

    const averageScore = fileCount > 0 ? totalScore / fileCount : 85;

    return {
      score: Math.round(averageScore),
      metrics: {
        maintainability: Math.round(averageScore * 0.9),
        readability: Math.round(averageScore * 1.1),
        testability: Math.round(averageScore * 0.8),
        performance: Math.round(averageScore * 0.95),
        security: Math.round(averageScore * 1.05)
      },
      issues
    };
  }

  private assessComplexity(files: GeneratedFile[]): "low" | "medium" | "high" {
    const totalLines = files.reduce((total, file) => 
      total + file.content.split("\n").length, 0
    );

    if (totalLines < 100) return "low";
    if (totalLines < 500) return "medium";
    return "high";
  }

  private generateSuggestions(
    files: GeneratedFile[],
    options: CodeGenerationOptions
  ): string[] {
    const suggestions: string[] = [];

    if (!options.includeTests) {
      suggestions.push("Consider adding unit tests for better code coverage");
    }

    if (!options.includeDocumentation) {
      suggestions.push("Add documentation comments for better maintainability");
    }

    if (!options.includeTypeDefinitions) {
      suggestions.push("Consider adding TypeScript type definitions");
    }

    if (files.length > 10) {
      suggestions.push("Consider organizing code into modules or packages");
    }

    return suggestions;
  }

  private generateWarnings(files: GeneratedFile[]): string[] {
    const warnings: string[] = [];

    const hasTests = files.some(file => file.type === "test");
    if (!hasTests) {
      warnings.push("No test files generated - consider adding tests");
    }

    const totalLines = files.reduce((total, file) => 
      total + file.content.split("\n").length, 0
    );
    if (totalLines > 1000) {
      warnings.push("Generated code is quite large - consider refactoring");
    }

    return warnings;
  }

  private createFallbackGeneratedCode(
    requestId: string,
    generationType: CodeGenerationType,
    language: string
  ): GeneratedCode {
    return {
      id: this.generateId(),
      requestId,
      files: [{
        path: "src/fallback.ts",
        content: "// Fallback generated code\nexport const fallback = true;",
        language,
        type: "source",
        dependencies: [],
        exports: ["fallback"],
        imports: []
      }],
      metadata: {
        sourceArtifact: {
          type: "requirements",
          id: "unknown",
          checksum: "fallback"
        },
        generationType,
        targetLanguage: language,
        generationTime: 0,
        linesOfCode: 2,
        complexity: "low",
        coverage: 0
      },
      quality: {
        score: 50,
        metrics: {
          maintainability: 50,
          readability: 50,
          testability: 50,
          performance: 50,
          security: 50
        },
        issues: []
      },
      suggestions: ["This is fallback code - regenerate for better results"],
      warnings: ["Generation failed - using fallback code"],
      createdAt: new Date()
    };
  }

  private calculateChecksum(content: string): string {
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}