/**
 * Quikim - API Structure Generator
 * Generates .quikim/api_structure.json with correct service endpoints
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { configManager } from "../config/manager.js";

export interface APIEndpoint {
  path: string;
  method: string;
  service: "user" | "project";
  description: string;
  pathParams?: string[];
  queryParams?: string[];
  requiredFields?: string[];
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  examples?: unknown[];
}

export interface APIStructure {
  version: string;
  generatedAt: string;
  description: string;
  usage: string;
  services: {
    userService: string;
    projectService: string;
  };
  endpoints: APIEndpoint[];
  quickReference: {
    byService: Record<string, APIEndpoint[]>;
    byResourceType: Record<string, APIEndpoint[]>;
    byMethod: Record<string, APIEndpoint[]>;
  };
}

export class APIStructureGenerator {
  /**
   * Generate complete API structure for MCP integration
   */
  static generateAPIStructure(): APIStructure {
    const endpoints: APIEndpoint[] = [
      // Authentication endpoints (User Service)
      {
        path: "/api/v1/auth/login",
        method: "POST",
        service: "user",
        description: "Authenticate user with email and password",
        requiredFields: ["email", "password"],
        requestSchema: {
          email: "string",
          password: "string",
        },
      },
      {
        path: "/api/v1/users/me",
        method: "GET",
        service: "user",
        description: "Get current user information",
      },

      // Project endpoints (Project Service)
      {
        path: "/api/v1/projects",
        method: "GET",
        service: "project",
        description: "List all projects for authenticated user",
      },
      {
        path: "/api/v1/projects/{projectId}",
        method: "GET",
        service: "project",
        description: "Get project details by ID",
        pathParams: ["projectId"],
      },

      // Requirements endpoints (Project Service)
      {
        path: "/api/v1/requirements/",
        method: "GET",
        service: "project",
        description: "Fetch requirements for a project",
        queryParams: ["projectId"],
        requiredFields: ["projectId"],
      },
      {
        path: "/api/v1/requirements/",
        method: "POST",
        service: "project",
        description: "Create or update requirements",
        requiredFields: ["projectId", "content"],
        requestSchema: {
          projectId: "string",
          content: "string",
          changeSummary: "string (optional)",
          changeType: "string (optional, default: minor)",
        },
      },

      // Design endpoints (Project Service)
      {
        path: "/api/v1/designs/",
        method: "GET",
        service: "project",
        description: "Fetch designs (HLD/LLD) for a project",
        queryParams: ["projectId", "type", "componentName"],
        requiredFields: ["projectId", "type"],
      },
      {
        path: "/api/v1/designs/",
        method: "POST",
        service: "project",
        description: "Create or update design (HLD/LLD)",
        requiredFields: ["projectId", "type", "content"],
        requestSchema: {
          projectId: "string",
          type: "string (hld | lld)",
          content: "string",
          componentName: "string (required for LLD)",
          changeSummary: "string (optional)",
        },
      },

      // Task endpoints (Project Service)
      {
        path: "/api/v1/tasks/",
        method: "GET",
        service: "project",
        description: "Fetch tasks for a project",
        queryParams: ["projectId"],
        requiredFields: ["projectId"],
      },
      {
        path: "/api/v1/tasks/",
        method: "POST",
        service: "project",
        description: "Create or update task",
        requiredFields: ["projectId", "title", "description"],
        requestSchema: {
          projectId: "string",
          title: "string",
          description: "string",
          status: "string (optional, default: todo)",
          priority: "string (optional, default: medium)",
          type: "string (optional, default: feature)",
        },
      },

      // ER Diagram endpoints (Project Service)
      {
        path: "/api/v1/er-diagrams/",
        method: "GET",
        service: "project",
        description: "Fetch ER diagrams for a project",
        queryParams: ["projectId"],
        requiredFields: ["projectId"],
      },
      {
        path: "/api/v1/er-diagrams/",
        method: "POST",
        service: "project",
        description: "Create or update ER diagram",
        requiredFields: ["projectId", "content"],
        requestSchema: {
          projectId: "string",
          content: "string",
          name: "string (optional, default: ER Diagram)",
          changeSummary: "string (optional)",
        },
      },

      // Wireframe endpoints (Project Service)
      {
        path: "/api/v1/projects/{projectId}/wireframes",
        method: "GET",
        service: "project",
        description: "Fetch wireframes for a project",
        pathParams: ["projectId"],
      },
      {
        path: "/api/v1/projects/{projectId}/wireframes",
        method: "POST",
        service: "project",
        description: "Create or update wireframe",
        pathParams: ["projectId"],
        requiredFields: ["name", "content"],
        requestSchema: {
          name: "string",
          content: "string",
          componentType: "string (optional, default: website)",
        },
      },
    ];

    // Generate quick reference indexes
    const byService: Record<string, APIEndpoint[]> = {};
    const byResourceType: Record<string, APIEndpoint[]> = {};
    const byMethod: Record<string, APIEndpoint[]> = {};

    endpoints.forEach((endpoint) => {
      // Group by service
      if (!byService[endpoint.service]) {
        byService[endpoint.service] = [];
      }
      byService[endpoint.service].push(endpoint);

      // Group by resource type (extracted from path)
      const resourceType = this.extractResourceType(endpoint.path);
      if (!byResourceType[resourceType]) {
        byResourceType[resourceType] = [];
      }
      byResourceType[resourceType].push(endpoint);

      // Group by method
      if (!byMethod[endpoint.method]) {
        byMethod[endpoint.method] = [];
      }
      byMethod[endpoint.method].push(endpoint);
    });

    return {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      description: "Complete Quikim API structure for MCP Agent",
      usage: "This file is used by Cursor to directly select endpoints without instruction phase",
      services: {
        userService: configManager.getUserServiceUrl(),
        projectService: configManager.getProjectServiceUrl(),
      },
      endpoints,
      quickReference: {
        byService,
        byResourceType,
        byMethod,
      },
    };
  }

  /**
   * Extract resource type from API path
   */
  private static extractResourceType(path: string): string {
    const segments = path.split("/").filter(Boolean);
    
    // Find the main resource segment (usually after /api/v1/)
    const apiIndex = segments.findIndex(s => s.startsWith("v"));
    if (apiIndex >= 0 && apiIndex + 1 < segments.length) {
      return segments[apiIndex + 1];
    }
    
    return "unknown";
  }

  /**
   * Generate API structure JSON string
   */
  static generateAPIStructureJSON(): string {
    const structure = this.generateAPIStructure();
    return JSON.stringify(structure, null, 2);
  }
}