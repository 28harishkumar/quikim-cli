/**
 * Quikim - CLI API Client
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import type {
  APIResponse,
  LoginResponse,
  Project,
  ProjectDetails,
  UserInfo,
} from "../types/index.js";
import {
  APIError,
  AuthenticationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
} from "./errors.js";

/** API client configuration */
interface APIClientConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
}

/** Quikim API Client for CLI */
export class QuikimAPIClient {
  private baseUrl: string;
  private token?: string;
  private timeout: number;

  constructor(config: APIClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.timeout = config.timeout ?? 30000;
  }

  /** Update the auth token */
  setToken(token: string): void {
    this.token = token;
  }

  /** Clear the auth token */
  clearToken(): void {
    this.token = undefined;
  }

  /** Make an HTTP request */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!response.ok) {
        this.handleErrorResponse(response.status, data);
      }

      return {
        success: true,
        data: (data.data ?? data) as T,
      };
    } catch (error: unknown) {
      if (error instanceof APIError) {
        throw error;
      }
      
      const err = error as Error;
      if (err.name === "AbortError") {
        throw new TimeoutError(`Request to ${endpoint} timed out`);
      }
      throw new NetworkError(`Network request failed: ${err.message}`);
    }
  }

  /** Handle error response */
  private handleErrorResponse(
    status: number,
    data: Record<string, unknown>
  ): never {
    const message = (data.message ?? data.error ?? "Request failed") as string;

    switch (status) {
      case 401:
        throw new AuthenticationError(message);
      case 404:
        throw new NotFoundError(message);
      default:
        throw new APIError(message, status, data);
    }
  }

  // ==================== Auth Endpoints ====================

  /** Login with email and password */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(
      "/api/v1/user/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );

    if (!response.data) {
      throw new APIError("Login failed: No data returned");
    }

    return response.data;
  }

  /** Register a new user */
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(
      "/api/v1/user/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }
    );

    if (!response.data) {
      throw new APIError("Registration failed: No data returned");
    }

    return response.data;
  }

  /** Get current user info */
  async getCurrentUser(): Promise<UserInfo> {
    const response = await this.request<UserInfo>("/api/v1/user/users/me", {
      method: "GET",
    });

    if (!response.data) {
      throw new APIError("Failed to get user info");
    }

    return response.data;
  }

  // ==================== Project Endpoints ====================

  /** List projects for the authenticated user */
  async listProjects(): Promise<Project[]> {
    // API returns paginated response: { data: Project[], pagination: {...} }
    const response = await this.request<Project[]>(
      "/api/v1/project/projects",
      { method: "GET" }
    );

    // Handle both paginated response format and direct array
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  /** Get project details by ID */
  async getProject(projectId: string): Promise<ProjectDetails> {
    const response = await this.request<ProjectDetails>(
      `/api/v1/project/projects/${projectId}`,
      { method: "GET" }
    );

    if (!response.data) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    return response.data;
  }

  /** Get project by slug */
  async getProjectBySlug(
    organizationId: string,
    slug: string
  ): Promise<ProjectDetails> {
    const response = await this.request<ProjectDetails>(
      `/api/v1/project/organizations/${organizationId}/projects/slug/${slug}`,
      { method: "GET" }
    );

    if (!response.data) {
      throw new NotFoundError(`Project with slug "${slug}" not found`);
    }

    return response.data;
  }

  // ==================== Health Check ====================

  /** Check API health */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{ status: string }>(
        "/api/health",
        { method: "GET" }
      );
      return response.success && response.data?.status === "ok";
    } catch {
      return false;
    }
  }
}

/** Create API client instance */
export function createAPIClient(
  baseUrl: string,
  token?: string
): QuikimAPIClient {
  return new QuikimAPIClient({ baseUrl, token });
}
