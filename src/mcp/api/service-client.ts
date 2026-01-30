/**
 * Quikim - Service-Aware API Client
 * Routes requests to appropriate microservices (user-service, project-service)
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { configManager } from '../../config/manager.js';
import {
  APIError,
  AuthenticationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  RateLimitError,
} from './errors.js';

export type ServiceType = 'user' | 'project';

export interface ServiceConfig {
  baseURL: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Service-aware API client that routes requests to correct microservices
 */
export class ServiceAwareAPIClient {
  private config: ServiceConfig;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || configManager.getProjectServiceUrl(),
      apiKey: config.apiKey || configManager.getAuth()?.token || "",
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  /**
   * Get the appropriate service URL based on service type
   */
  private getServiceURL(serviceType: ServiceType): string {
    switch (serviceType) {
      case 'user':
        return configManager.getUserServiceUrl();
      case 'project':
        return configManager.getProjectServiceUrl();
      default:
        return this.config.baseURL;
    }
  }

  /**
   * Make HTTP request to specific service
   */
  private async request<T>(
    serviceType: ServiceType,
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<APIResponse<T>> {
    const baseURL = this.getServiceURL(serviceType);
    const url = `${baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.config.apiKey && {
        Authorization: `Bearer ${this.config.apiKey}`,
      }),
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleErrorResponse(
          response,
          serviceType,
          endpoint,
          options,
          retryCount,
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
      };
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === "AbortError") {
        throw new TimeoutError(`Request to ${serviceType}:${endpoint} timed out`);
      }

      // Retry on network errors
      if (retryCount < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(serviceType, endpoint, options, retryCount + 1);
      }

      throw new NetworkError(`Network request failed: ${err.message}`);
    }
  }

  /**
   * Handle error responses with appropriate error types
   */
  private async handleErrorResponse<T>(
    response: Response,
    serviceType: ServiceType,
    endpoint: string,
    options: RequestInit,
    retryCount: number,
  ): Promise<APIResponse<T>> {
    const errorData: unknown = await response.json().catch(() => ({}));
    const errorObj = errorData as Record<string, unknown>;

    switch (response.status) {
      case 401:
        throw new AuthenticationError(
          (errorObj?.message as string) || "Authentication failed",
        );

      case 404:
        throw new NotFoundError(
          (errorObj?.message as string) || "Resource not found",
        );

      case 429:
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "60",
        );
        if (retryCount < this.config.retryAttempts) {
          await this.delay(retryAfter * 1000);
          return this.request(serviceType, endpoint, options, retryCount + 1);
        }
        throw new RateLimitError(
          (errorObj?.message as string) || "Rate limit exceeded",
          retryAfter,
        );

      case 500:
      case 502:
      case 503:
        // Retry on server errors
        if (retryCount < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
          return this.request(serviceType, endpoint, options, retryCount + 1);
        }
        throw new APIError(
          (errorObj?.message as string) || "Server error",
          response.status,
          errorObj,
        );

      default:
        throw new APIError(
          (errorObj?.message as string) ||
            `Request failed with status ${response.status}`,
          response.status,
          errorObj,
        );
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== Authentication (User Service) ====================

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<unknown> {
    return this.request('user', '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<unknown> {
    return this.request('user', '/api/v1/users/me', {
      method: 'GET',
    });
  }

  // ==================== Projects (Project Service) ====================

  /**
   * List projects
   */
  async listProjects(): Promise<unknown> {
    return this.request('project', '/api/v1/projects', {
      method: 'GET',
    });
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<unknown> {
    return this.request('project', `/api/v1/projects/${projectId}`, {
      method: 'GET',
    });
  }

  // ==================== Requirements (Project Service) ====================

  /**
   * Fetch requirements for a project.
   * List API returns items without content; fetches full requirement (with content) for each item.
   */
  async fetchRequirements(projectId: string, specName?: string): Promise<unknown> {
    const listRes = await this.request<{ data?: { id: string }[]; pagination?: unknown }>(
      'project',
      `/api/v1/requirements/?projectId=${projectId}${specName ? `&specName=${encodeURIComponent(specName)}` : ''}&limit=100`,
      { method: 'GET' }
    );
    const body = listRes.data as { data?: { id: string }[] } | undefined;
    const list = Array.isArray(body) ? body : (body?.data ?? []);
    if (list.length === 0) return { success: true, data: [] };
    const fullList: unknown[] = [];
    for (const item of list) {
      const fullRes = await this.request<{ data?: unknown }>(
        'project',
        `/api/v1/requirements/${item.id}`,
        { method: 'GET' }
      );
      const fullBody = fullRes.data as { data?: unknown } | undefined;
      const full = fullBody?.data ?? fullRes.data;
      if (full) fullList.push(full);
    }
    return { success: true, data: fullList };
  }

  /**
   * Create/update requirements
   */
  async syncRequirements(projectId: string, content: string, metadata?: Record<string, unknown>): Promise<unknown> {
    return this.request('project', '/api/v1/requirements/', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        content,
        changeSummary: metadata?.changeSummary,
        changeType: metadata?.changeType || 'minor',
      }),
    });
  }

  // ==================== Designs (Project Service) ====================

  /**
   * Fetch HLD for a project
   */
  async fetchHLD(projectId: string): Promise<unknown> {
    return this.request('project', `/api/v1/designs/?projectId=${projectId}&type=hld`, {
      method: 'GET',
    });
  }

  /**
   * Create/update HLD
   */
  async syncHLD(projectId: string, content: string, metadata?: Record<string, unknown>): Promise<unknown> {
    return this.request('project', '/api/v1/designs/', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        type: 'hld',
        content,
        changeSummary: metadata?.changeSummary,
      }),
    });
  }

  /**
   * Fetch LLD for a project
   */
  async fetchLLD(projectId: string, componentName?: string): Promise<unknown> {
    const params = new URLSearchParams({ projectId, type: 'lld' });
    if (componentName) {
      params.append('componentName', componentName);
    }
    return this.request('project', `/api/v1/designs/?${params.toString()}`, {
      method: 'GET',
    });
  }

  /**
   * Fetch mermaid/flow diagrams for a project
   */
  async fetchMermaid(projectId: string): Promise<unknown> {
    return this.request('project', `/api/v1/designs/?projectId=${projectId}&type=flow`, {
      method: 'GET',
    });
  }

  /**
   * Create/update LLD
   */
  async syncLLD(projectId: string, content: string, componentName: string, metadata?: Record<string, unknown>): Promise<unknown> {
    return this.request('project', '/api/v1/designs/', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        type: 'lld',
        content,
        componentName,
        changeSummary: metadata?.changeSummary,
      }),
    });
  }

  // ==================== Tasks (Project Service) ====================

  /**
   * Fetch tasks for a project
   */
  async fetchTasks(projectId: string): Promise<unknown> {
    return this.request('project', `/api/v1/tasks/?projectId=${projectId}`, {
      method: 'GET',
    });
  }

  /**
   * Create/update task
   */
  async syncTask(projectId: string, content: string, metadata?: Record<string, unknown>): Promise<unknown> {
    return this.request('project', '/api/v1/tasks/', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        title: metadata?.title || 'Task from MCP',
        description: content,
        status: metadata?.status || 'todo',
        priority: metadata?.priority || 'medium',
        type: metadata?.type || 'feature',
      }),
    });
  }

  // ==================== ER Diagrams (Project Service) ====================

  /**
   * Fetch ER diagram for a project
   */
  async fetchERDiagram(projectId: string): Promise<unknown> {
    return this.request('project', `/api/v1/er-diagrams/?projectId=${projectId}`, {
      method: 'GET',
    });
  }

  /**
   * Create/update ER diagram
   */
  async syncERDiagram(projectId: string, content: string, metadata?: Record<string, unknown>): Promise<unknown> {
    return this.request('project', '/api/v1/er-diagrams/', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        content,
        name: metadata?.name || 'ER Diagram',
        changeSummary: metadata?.changeSummary,
      }),
    });
  }

  // ==================== Wireframes (Project Service) ====================

  /**
   * Fetch wireframes for a project
   */
  async fetchWireframes(projectId: string): Promise<unknown> {
    return this.request('project', `/api/v1/projects/${projectId}/wireframes`, {
      method: 'GET',
    });
  }

  /**
   * Create wireframe. Server expects WireframeUpdateSchema: name (1-100), viewport (width 320-7680, height 240-4320), elements (array).
   * For org projects we always send this shape; content is ignored (wireframes are canvas JSON, not markdown).
   */
  async syncWireframe(
    projectId: string,
    content: string,
    metadata?: Record<string, unknown>,
    organizationId?: string
  ): Promise<unknown> {
    const path = organizationId
      ? `/api/v1/organizations/${organizationId}/projects/${projectId}/wireframes`
      : `/api/v1/projects/${projectId}/wireframes`;
    const defaultName = (metadata?.name as string) || 'Wireframe from MCP';
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    let name = defaultName.slice(0, 100) || 'Wireframe from MCP';
    let viewport = { width: 1280, height: 720, scale: 1 as number };
    let elements: unknown[] = [];
    if (organizationId && content.trim()) {
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        if (typeof parsed.name === 'string' && parsed.name.length >= 1) {
          name = parsed.name.slice(0, 100);
        }
        if (parsed.viewport && typeof parsed.viewport === 'object') {
          const v = parsed.viewport as Record<string, unknown>;
          const w = typeof v.width === 'number' ? clamp(v.width, 320, 7680) : 1280;
          const h = typeof v.height === 'number' ? clamp(v.height, 240, 4320) : 720;
          viewport = { width: w, height: h, scale: typeof v.scale === 'number' ? v.scale : 1 };
        }
        if (Array.isArray(parsed.elements)) {
          elements = parsed.elements;
        }
      } catch {
        // Use defaults when content is not valid JSON
      }
    }
    const body = organizationId
      ? { name, viewport, elements }
      : {
          name,
          content,
          componentType: metadata?.componentType || 'website',
        };
    const res = await this.request('project', path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.data;
  }

  /**
   * Sync mermaid/flow diagram (artifact type flow_diagram)
   */
  async syncMermaid(
    projectId: string,
    content: string,
    metadata?: Record<string, unknown>,
    specName?: string
  ): Promise<unknown> {
    const mermaidType = this.inferMermaidType(content);
    const res = await this.request('project', '/api/v1/designs', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        type: 'flow',
        name: metadata?.name || 'Flow',
        specName: specName || 'default',
        content: '',
        mermaidDiagram: content,
        mermaidType,
      }),
    });
    return res.data;
  }

  private inferMermaidType(content: string): string {
    const s = (content || '').trim();
    if (/^\s*erDiagram\s/mi.test(s)) return 'entity';
    if (/^\s*sequenceDiagram\s/mi.test(s)) return 'sequence';
    if (/^\s*classDiagram\s/mi.test(s)) return 'class';
    if (/^\s*stateDiagram\s/mi.test(s)) return 'state';
    return 'flowchart';
  }

  /**
   * Fetch contexts for a project
   */
  async fetchContexts(projectId: string): Promise<unknown> {
    const res = await this.request('project', `/api/v1/projects/${projectId}/contexts`, {
      method: 'GET',
    });
    return res.data;
  }

  /**
   * Create/update context
   */
  async syncContext(
    projectId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<unknown> {
    const res = await this.request('project', `/api/v1/projects/${projectId}/contexts`, {
      method: 'POST',
      body: JSON.stringify({
        title: metadata?.title || metadata?.name || 'Context',
        content,
        description: metadata?.description || '',
        isActive: true,
      }),
    });
    return res.data;
  }

  /**
   * Fetch code guidelines for a project
   */
  async fetchCodeGuidelines(projectId: string): Promise<unknown> {
    const res = await this.request('project', `/api/v1/projects/${projectId}/code-guidelines`, {
      method: 'GET',
    });
    return res.data;
  }

  /**
   * Create/update code guideline
   */
  async syncCodeGuideline(
    projectId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<unknown> {
    const res = await this.request('project', '/api/v1/code-guidelines', {
      method: 'POST',
      body: JSON.stringify({
        scope: 'project',
        projectId,
        title: metadata?.title || metadata?.name || 'Guideline',
        content,
        description: metadata?.description || '',
      }),
    });
    return res.data;
  }

  // ==================== Health Check ====================

  /**
   * Check service health
   */
  async healthCheck(serviceType: ServiceType): Promise<boolean> {
    try {
      const response = await this.request<{ status: string }>(serviceType, '/health', {
        method: 'GET',
      });
      return response.success && response.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  // ==================== Queue Management ====================

  /**
   * Fetch pending queue requests for a project
   */
  async fetchPendingQueueRequests(projectId: string): Promise<Array<{
    id: string;
    projectId: string;
    type: string;
    status: string;
    context: Record<string, unknown>;
  }>> {
    try {
      const response = await this.request<Array<{
        id: string;
        projectId: string;
        type: string;
        status: string;
        context: Record<string, unknown>;
      }>>('project', `/api/projects/${projectId}/queue/pending`, {
        method: 'GET',
      });
      return response.data || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Update queue request status
   */
  async updateQueueRequestStatus(
    requestId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    result?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.request('project', `/api/projects/queue/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, result }),
      });
    } catch (error) {
      throw error;
    }
  }
}