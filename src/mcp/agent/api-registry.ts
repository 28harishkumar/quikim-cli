/**
 * Quikim - API Registry
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { APIEndpoint } from './types.js';

/**
 * Registry of all available API endpoints with their schemas
 * This is what the AI agent will share with the LLM
 */
export class APIRegistry {
  private endpoints: Map<string, APIEndpoint> = new Map();

  constructor() {
    this.registerDefaultEndpoints();
  }

  /**
   * Register all default Quikim API endpoints
   */
  private registerDefaultEndpoints(): void {
    // Requirements endpoints
    this.register({
      path: '/api/projects/{projectId}/requirements/latest',
      method: 'GET',
      description: 'Fetch the latest requirements for a project',
      pathParams: ['projectId'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        quikimFeatures: 'string[]',
        customFeatures: 'string[]',
        createdAt: 'string'
      },
      examples: [{
        description: 'Fetch requirements for project abc123',
        response: {
          id: 'req_123',
          projectId: 'abc123',
          version: 1,
          content: '# Requirements\n\n...',
          quikimFeatures: ['auth', 'payments'],
          customFeatures: [],
          createdAt: '2026-01-24T00:00:00Z'
        }
      }]
    });

    // HLD endpoints
    this.register({
      path: '/api/projects/{projectId}/hld/latest',
      method: 'GET',
      description: 'Fetch the latest High-Level Design for a project',
      pathParams: ['projectId'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        techStack: 'object',
        architecture: 'object',
        createdAt: 'string'
      }
    });

    // LLD endpoints
    this.register({
      path: '/api/projects/{projectId}/lld',
      method: 'GET',
      description: 'Fetch all Low-Level Design documents for a project',
      pathParams: ['projectId'],
      responseSchema: {
        type: 'array',
        items: {
          id: 'string',
          projectId: 'string',
          version: 'number',
          content: 'string',
          componentName: 'string',
          componentType: 'string'
        }
      }
    });

    this.register({
      path: '/api/projects/{projectId}/lld/{componentName}',
      method: 'GET',
      description: 'Fetch a specific Low-Level Design by component name',
      pathParams: ['projectId', 'componentName'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        componentName: 'string',
        componentType: 'string',
        specifications: 'object'
      }
    });

    // Tasks endpoints
    this.register({
      path: '/api/projects/{projectId}/tasks/latest',
      method: 'GET',
      description: 'Fetch the latest tasks for a project',
      pathParams: ['projectId'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        milestones: 'array',
        createdAt: 'string'
      }
    });

    // ER Diagram endpoints
    this.register({
      path: '/api/projects/{projectId}/er-diagram/latest',
      method: 'GET',
      description: 'Fetch the latest ER Diagram for a project',
      pathParams: ['projectId'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        entities: 'array',
        createdAt: 'string'
      }
    });

    // Prisma Schema endpoints
    this.register({
      path: '/api/projects/{projectId}/prisma-schema/latest',
      method: 'GET',
      description: 'Fetch the latest Prisma schema for a project',
      pathParams: ['projectId'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        generatedFrom: 'string',
        createdAt: 'string'
      }
    });

    // Wireframes endpoints
    this.register({
      path: '/api/projects/{projectId}/wireframes',
      method: 'GET',
      description: 'Fetch all wireframes for a project',
      pathParams: ['projectId'],
      responseSchema: {
        type: 'array',
        items: {
          id: 'string',
          projectId: 'string',
          version: 'number',
          penpotFileId: 'string',
          metadata: 'object'
        }
      }
    });

    // Code Guidelines endpoints
    this.register({
      path: '/api/projects/{projectId}/code-guidelines/latest',
      method: 'GET',
      description: 'Fetch code guidelines for a project',
      pathParams: ['projectId'],
      queryParams: ['organizationId', 'userId'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        createdAt: 'string'
      }
    });

    // Sync Artifact endpoint
    this.register({
      path: '/api/projects/{projectId}/artifacts/sync',
      method: 'POST',
      description: 'Sync an artifact to the platform (creates new version)',
      pathParams: ['projectId'],
      requestSchema: {
        artifactType: 'string (requirements | hld | lld | tasks | er_diagram | prisma_schema | wireframes | theme | code_guidelines | mermaid)',
        content: 'string',
        version: 'number (optional)',
        metadata: 'object (optional)'
      },
      requiredFields: ['artifactType', 'content'],
      responseSchema: {
        success: 'boolean',
        artifactId: 'string',
        version: 'number',
        message: 'string (optional)'
      },
      examples: [{
        description: 'Sync updated requirements',
        request: {
          artifactType: 'requirements',
          content: '# Updated Requirements\n\n...',
          version: 2
        },
        response: {
          success: true,
          artifactId: 'req_456',
          version: 2
        }
      }]
    });

    // Component Search
    this.register({
      path: '/api/v1/snippets/components',
      method: 'GET',
      description: 'Search for reusable components in the snippet library',
      queryParams: ['search', 'limit', 'organizationId'],
      responseSchema: {
        success: 'boolean',
        data: 'array'
      }
    });

    // Sample Code Search
    this.register({
      path: '/api/v1/snippets/sample-code/search',
      method: 'GET',
      description: 'Search for sample code snippets',
      queryParams: ['search', 'organizationId', 'limit'],
      responseSchema: {
        success: 'boolean',
        data: 'array'
      }
    });

    // Features
    this.register({
      path: '/api/v1/snippets/features',
      method: 'GET',
      description: 'Fetch all available Quikim features with database schemas',
      responseSchema: {
        success: 'boolean',
        data: 'array'
      }
    });

    // Mermaid Diagrams
    this.register({
      path: '/api/projects/{projectId}/mermaid-diagrams',
      method: 'GET',
      description: 'Fetch all mermaid diagrams for a project',
      pathParams: ['projectId'],
      queryParams: ['type'],
      responseSchema: {
        type: 'array',
        items: {
          id: 'string',
          projectId: 'string',
          version: 'number',
          content: 'string',
          diagramType: 'string',
          name: 'string'
        }
      }
    });

    this.register({
      path: '/api/projects/{projectId}/mermaid-diagrams',
      method: 'POST',
      description: 'Create or update a mermaid diagram',
      pathParams: ['projectId'],
      requestSchema: {
        content: 'string',
        diagramType: 'string (flowchart | sequence | classDiagram | etc)',
        name: 'string',
        description: 'string (optional)',
        linkedArtifact: 'object (optional)'
      },
      requiredFields: ['content', 'diagramType', 'name'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        version: 'number',
        content: 'string',
        diagramType: 'string',
        name: 'string'
      }
    });

    // Wireframe Generation
    this.register({
      path: '/api/v1/tools/wireframes/generate',
      method: 'POST',
      description: 'Generate wireframe from a text prompt using AI',
      requestSchema: {
        projectId: 'string',
        prompt: 'string'
      },
      requiredFields: ['projectId', 'prompt'],
      responseSchema: {
        success: 'boolean',
        data: 'object'
      }
    });

    // Penpot Sync
    this.register({
      path: '/api/v1/tools/penpot/sync/{wireframeId}/to-penpot',
      method: 'POST',
      description: 'Sync a wireframe to Penpot design tool',
      pathParams: ['wireframeId'],
      responseSchema: {
        success: 'boolean',
        data: 'object'
      }
    });

    this.register({
      path: '/api/v1/tools/penpot/sync/project/{projectId}/from-penpot',
      method: 'POST',
      description: 'Sync wireframes from Penpot back to Quikim',
      pathParams: ['projectId'],
      responseSchema: {
        success: 'boolean',
        data: 'object'
      }
    });

    // Design to Code
    this.register({
      path: '/api/v1/tools/design-to-code/convert-from-wireframe',
      method: 'POST',
      description: 'Convert wireframe to React component code',
      requestSchema: {
        wireframeContent: 'any',
        options: 'object',
        projectId: 'string'
      },
      requiredFields: ['wireframeContent', 'projectId'],
      responseSchema: {
        success: 'boolean',
        data: 'object'
      }
    });

    // LLM Key Status
    this.register({
      path: '/api/projects/{projectId}/llm-keys/status',
      method: 'GET',
      description: 'Check if project has LLM API keys configured',
      pathParams: ['projectId'],
      responseSchema: {
        integrated: 'boolean',
        provider: 'string (optional)',
        hasKeys: 'boolean'
      }
    });

    // Queue Management
    this.register({
      path: '/api/projects/{projectId}/queue',
      method: 'POST',
      description: 'Queue a request for dashboard workflow processing',
      pathParams: ['projectId'],
      requestSchema: {
        type: 'string (wireframe | er_diagram | prisma_schema | hld | tasks | code_generation)',
        context: 'object'
      },
      requiredFields: ['type', 'context'],
      responseSchema: {
        id: 'string',
        projectId: 'string',
        type: 'string',
        status: 'string',
        context: 'object',
        createdAt: 'string'
      }
    });

    this.register({
      path: '/api/projects/{projectId}/queue/pending',
      method: 'GET',
      description: 'Fetch pending queued requests for a project',
      pathParams: ['projectId'],
      responseSchema: {
        type: 'array',
        items: {
          id: 'string',
          projectId: 'string',
          type: 'string',
          status: 'string',
          context: 'object'
        }
      }
    });

    // Health Check
    this.register({
      path: '/api/health',
      method: 'GET',
      description: 'Check API health status',
      responseSchema: {
        status: 'string'
      }
    });
  }

  /**
   * Register a new endpoint
   */
  register(endpoint: APIEndpoint): void {
    const key = `${endpoint.method}:${endpoint.path}`;
    this.endpoints.set(key, endpoint);
  }

  /**
   * Get all registered endpoints
   */
  getAll(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get endpoint by method and path
   */
  get(method: string, path: string): APIEndpoint | undefined {
    const key = `${method}:${path}`;
    return this.endpoints.get(key);
  }

  /**
   * Search endpoints by description or path
   */
  search(query: string): APIEndpoint[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(endpoint => 
      endpoint.description.toLowerCase().includes(lowerQuery) ||
      endpoint.path.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get endpoints for a specific resource type
   */
  getByResourceType(resourceType: string): APIEndpoint[] {
    return this.getAll().filter(endpoint => 
      endpoint.path.includes(resourceType)
    );
  }
}

// Export singleton instance
export const apiRegistry = new APIRegistry();
