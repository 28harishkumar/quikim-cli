/**
 * Artifact Generator Orchestrator
 * Manages the generation of missing artifacts in correct order
 */

import { CodebaseContext } from '../session/types.js';
import { XMLResponse } from '../types.js';
import { logger } from '../utils/logger.js';

export interface ArtifactStatus {
  requirements: boolean;
  wireframes: boolean;
  erDiagram: boolean;
  prismaSchema: boolean;
  hld: boolean;
  tasks: boolean;
}

export interface ArtifactGenerationRequest {
  artifactType: 'requirements' | 'wireframes' | 'er-diagram' | 'prisma-schema' | 'hld' | 'tasks';
  reason: string;
  prerequisites: string[];
}

/**
 * Artifact Generator Orchestrator
 * Enforces correct ordering: requirements → wireframes → ER diagram → Prisma schema → HLD → tasks
 */
export class ArtifactGenerator {
  /**
   * Check which artifacts exist in the codebase
   */
  checkArtifactStatus(codebase: CodebaseContext): ArtifactStatus {
    const files = codebase.files;

    return {
      requirements: files.some(f => f.path.match(/\.quikim\/v\d+\/requirements\.md/) && f.content.trim().length > 0),
      wireframes: files.some(f => f.path.match(/\.quikim\/v\d+\/wireframes\.md/) && f.content.trim().length > 0),
      erDiagram: files.some(f => f.path.match(/\.quikim\/v\d+\/er-diagram\.md/) && f.content.trim().length > 0),
      prismaSchema: files.some(f => f.path.includes('prisma/schema.prisma') && f.content.trim().length > 0),
      hld: files.some(f => f.path.match(/\.quikim\/v\d+\/hld\.md/) && f.content.trim().length > 0),
      tasks: files.some(f => f.path.match(/\.quikim\/v\d+\/tasks\.md/) && f.content.trim().length > 0)
    };
  }

  /**
   * Determine next artifact to generate based on correct ordering
   * Returns null if all artifacts exist
   */
  getNextArtifactToGenerate(status: ArtifactStatus): ArtifactGenerationRequest | null {
    // Order: requirements → wireframes → ER diagram → Prisma schema → HLD → tasks

    if (!status.requirements) {
      return {
        artifactType: 'requirements',
        reason: 'Requirements document is missing. This is the foundation for all other artifacts.',
        prerequisites: []
      };
    }

    if (!status.wireframes) {
      return {
        artifactType: 'wireframes',
        reason: 'Wireframes are missing. They define the UI/UX structure based on requirements.',
        prerequisites: ['requirements']
      };
    }

    if (!status.erDiagram) {
      return {
        artifactType: 'er-diagram',
        reason: 'ER diagram is missing. It defines the database structure based on requirements and wireframes.',
        prerequisites: ['requirements', 'wireframes']
      };
    }

    if (!status.prismaSchema) {
      return {
        artifactType: 'prisma-schema',
        reason: 'Prisma schema is missing. It implements the database models from the ER diagram.',
        prerequisites: ['requirements', 'wireframes', 'er-diagram']
      };
    }

    if (!status.hld) {
      return {
        artifactType: 'hld',
        reason: 'High-Level Design (HLD) document is missing. It defines the system architecture and tech stack.',
        prerequisites: ['requirements', 'wireframes', 'er-diagram', 'prisma-schema']
      };
    }

    if (!status.tasks) {
      return {
        artifactType: 'tasks',
        reason: 'Tasks document is missing. It breaks down the implementation into actionable tasks.',
        prerequisites: ['requirements', 'wireframes', 'er-diagram', 'prisma-schema', 'hld']
      };
    }

    // All artifacts exist
    return null;
  }

  /**
   * Validate prerequisites for artifact generation
   */
  validatePrerequisites(artifactType: string, status: ArtifactStatus): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    switch (artifactType) {
      case 'requirements':
        // No prerequisites
        break;

      case 'wireframes':
        if (!status.requirements) missing.push('requirements');
        break;

      case 'er-diagram':
        if (!status.requirements) missing.push('requirements');
        if (!status.wireframes) missing.push('wireframes');
        break;

      case 'prisma-schema':
        if (!status.requirements) missing.push('requirements');
        if (!status.wireframes) missing.push('wireframes');
        if (!status.erDiagram) missing.push('er-diagram');
        break;

      case 'hld':
        if (!status.requirements) missing.push('requirements');
        if (!status.wireframes) missing.push('wireframes');
        if (!status.erDiagram) missing.push('er-diagram');
        if (!status.prismaSchema) missing.push('prisma-schema');
        break;

      case 'tasks':
        if (!status.requirements) missing.push('requirements');
        if (!status.wireframes) missing.push('wireframes');
        if (!status.erDiagram) missing.push('er-diagram');
        if (!status.prismaSchema) missing.push('prisma-schema');
        if (!status.hld) missing.push('hld');
        break;
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Create XML response for artifact generation request
   */
  createArtifactGenerationResponse(
    request: ArtifactGenerationRequest,
    hasLLMKeys: boolean,
    requestId: string
  ): XMLResponse {
    const artifactName = this.getArtifactDisplayName(request.artifactType);

    if (hasLLMKeys) {
      // LLM keys integrated - queue request for platform generation
      return {
        requestId,
        action: 'request_info',
        instructions: `${artifactName} will be generated by the platform using your LLM keys. The request has been queued. You will be notified when generation is complete.`,
        parameters: {
          content: `Artifact generation queued: ${request.artifactType}`
        },
        reasoning: `${request.reason} LLM keys are integrated, so platform will generate using developer's keys.`
      };
    }

    // LLM keys NOT integrated - send instructions to Cursor
    return {
      requestId,
      action: 'request_info',
      instructions: `${artifactName} is missing. ${request.reason}\n\nPlease generate the ${artifactName} based on the following prerequisites: ${request.prerequisites.join(', ')}.\n\nOnce generated, save it to the appropriate location in .quikim/ directory.`,
      parameters: {
        content: `Generate ${request.artifactType}`,
        files: request.prerequisites.map(p => `.quikim/${p}/`)
      },
      reasoning: `${request.reason} LLM keys are NOT integrated, so Cursor should generate the artifact.`
    };
  }

  /**
   * Get display name for artifact type
   */
  private getArtifactDisplayName(artifactType: string): string {
    const names: Record<string, string> = {
      'requirements': 'Requirements Document',
      'wireframes': 'Wireframes',
      'er-diagram': 'ER Diagram',
      'prisma-schema': 'Prisma Schema',
      'hld': 'High-Level Design (HLD)',
      'tasks': 'Tasks Document'
    };

    return names[artifactType] || artifactType;
  }

  /**
   * Check if workflow should proceed with artifact generation
   */
  shouldGenerateArtifacts(userPrompt: string): boolean {
    const prompt = userPrompt.toLowerCase();

    // Check for new project setup keywords
    if (prompt.includes('new project') || prompt.includes('initialize') || prompt.includes('setup')) {
      return true;
    }

    // Check for artifact generation keywords
    if (prompt.includes('generate') && (
      prompt.includes('requirements') ||
      prompt.includes('wireframe') ||
      prompt.includes('er diagram') ||
      prompt.includes('schema') ||
      prompt.includes('hld') ||
      prompt.includes('tasks')
    )) {
      return true;
    }

    // Check for planning keywords
    if (prompt.includes('plan') || prompt.includes('design') || prompt.includes('architecture')) {
      return true;
    }

    return false;
  }

  /**
   * Log artifact generation status
   */
  logArtifactStatus(status: ArtifactStatus): void {
    logger.info('Artifact Status:', {
      requirements: status.requirements ? '✓' : '✗',
      wireframes: status.wireframes ? '✓' : '✗',
      erDiagram: status.erDiagram ? '✓' : '✗',
      prismaSchema: status.prismaSchema ? '✓' : '✗',
      hld: status.hld ? '✓' : '✗',
      tasks: status.tasks ? '✓' : '✗'
    });
  }
}
