/**
 * Quikim - CLI Type Definitions
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/** CLI Configuration stored locally */
export interface CLIConfig {
  apiUrl: string;
  userServiceUrl?: string;
  projectServiceUrl?: string;
  workflowServiceUrl?: string;
  vibeServiceUrl?: string;
  auth?: AuthConfig;
  currentProject?: ProjectConfig;
}

/** Authentication configuration */
export interface AuthConfig {
  token: string;
  userId: string;
  email: string;
  organizationId?: string;
  organizationName?: string;
  expiresAt?: string;
}

/** Project configuration for connected project (stored in .quikim/project.json) */
export interface ProjectConfig {
  /** Project ID - used by MCP server */
  projectId: string;
  /** Organization ID - used by MCP server */
  organizationId: string;
  /** User ID - used by MCP server */
  userId?: string;
  /** Project name (for display) */
  name: string;
  /** Project slug (for display) */
  slug: string;
  /** Latest artifact version number */
  latestVersion?: number;
  /** When the project was connected */
  connectedAt: string;
}

/** API Response wrapper */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Login response from user service */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified?: boolean;
  };
  organization?: {
    id: string;
    name: string;
    type: string;
  };
  requiresOnboarding: boolean;
}

/** Project list item */
export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/** Project status enum */
export type ProjectStatus = 
  | "DRAFT"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED"
  | "ON_HOLD";

/** Project details with full information */
export interface ProjectDetails extends Project {
  components: ProjectComponent[];
  features: string[];
  team: ProjectTeamMember[];
}

/** Project component */
export interface ProjectComponent {
  id: string;
  name: string;
  type: ComponentType;
  status: string;
}

/** Component type enum */
export type ComponentType = 
  | "WEBSITE"
  | "PORTAL"
  | "MOBILE_APP"
  | "API"
  | "ADMIN_DASHBOARD";

/** Team member on a project */
export interface ProjectTeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string | null;
    email: string;
  };
}

/** User info response */
export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  organizations: OrganizationMembership[];
}

/** Organization membership */
export interface OrganizationMembership {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    type: string;
  };
  role: string;
}
