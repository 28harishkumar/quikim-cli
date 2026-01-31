/**
 * Quikim - CLI Configuration Manager
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import Conf from "conf";
import { readFile, writeFile, access, mkdir } from "fs/promises";
import { join } from "path";
import type { CLIConfig, AuthConfig, ProjectConfig } from "../types/index.js";
import {
  DEFAULT_API_URL,
  LOCAL_USER_SERVICE_URL,
  LOCAL_PROJECT_SERVICE_URL,
  CONFIG_FILE_NAME,
  QUIKIM_DIR,
  PROJECT_CONFIG_FILE,
} from "./constants.js";

/** Global CLI configuration store */
const globalConfig = new Conf<CLIConfig>({
  projectName: CONFIG_FILE_NAME,
  defaults: {
    apiUrl: DEFAULT_API_URL,
  },
});

/** Configuration manager for CLI */
export class ConfigManager {
  /** Get the API URL (legacy, defaults to user service) */
  getApiUrl(): string {
    return globalConfig.get("apiUrl", DEFAULT_API_URL);
  }

  /** Set the API URL (legacy) */
  setApiUrl(url: string): void {
    globalConfig.set("apiUrl", url);
  }

  /** Get user service URL */
  getUserServiceUrl(): string {
    return globalConfig.get("userServiceUrl") ?? this.getApiUrl();
  }

  /** Set user service URL */
  setUserServiceUrl(url: string): void {
    globalConfig.set("userServiceUrl", url);
  }

  /** Get project service URL */
  getProjectServiceUrl(): string {
    return globalConfig.get("projectServiceUrl") ?? this.getApiUrl();
  }

  /** Set project service URL */
  setProjectServiceUrl(url: string): void {
    globalConfig.set("projectServiceUrl", url);
  }

  /** Set local development mode (separate services) */
  setLocalMode(): void {
    globalConfig.set("userServiceUrl", LOCAL_USER_SERVICE_URL);
    globalConfig.set("projectServiceUrl", LOCAL_PROJECT_SERVICE_URL);
  }

  /** Set production mode (single gateway) */
  setProductionMode(): void {
    globalConfig.delete("userServiceUrl");
    globalConfig.delete("projectServiceUrl");
    globalConfig.set("apiUrl", DEFAULT_API_URL);
  }

  /** Check if in local mode */
  isLocalMode(): boolean {
    const userUrl = globalConfig.get("userServiceUrl");
    const projectUrl = globalConfig.get("projectServiceUrl");
    return !!(userUrl || projectUrl);
  }

  /** Get auth configuration */
  getAuth(): AuthConfig | undefined {
    return globalConfig.get("auth");
  }

  /** Set auth configuration */
  setAuth(auth: AuthConfig): void {
    globalConfig.set("auth", auth);
  }

  /** Clear auth configuration */
  clearAuth(): void {
    globalConfig.delete("auth");
  }

  /** Check if user is authenticated */
  isAuthenticated(): boolean {
    const auth = this.getAuth();
    if (!auth?.token) {
      return false;
    }
    
    // Check if token is expired
    if (auth.expiresAt) {
      const expiresAt = new Date(auth.expiresAt);
      if (expiresAt < new Date()) {
        return false;
      }
    }
    
    return true;
  }

  /** Get current project configuration */
  getCurrentProject(): ProjectConfig | undefined {
    return globalConfig.get("currentProject");
  }

  /** Set current project configuration */
  setCurrentProject(project: ProjectConfig): void {
    globalConfig.set("currentProject", project);
  }

  /** Clear current project */
  clearCurrentProject(): void {
    globalConfig.delete("currentProject");
  }

  /** Reset all configuration */
  reset(): void {
    globalConfig.clear();
    globalConfig.set("apiUrl", DEFAULT_API_URL);
  }

  /** Get config file path */
  getConfigPath(): string {
    return globalConfig.path;
  }
}

/** Project-level configuration manager */
export class ProjectConfigManager {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /** Get the .quikim directory path */
  private getQuikimDirPath(): string {
    return join(this.projectPath, QUIKIM_DIR);
  }

  /** Get the config file path (.quikim/project.json) */
  private getConfigFilePath(): string {
    return join(this.getQuikimDirPath(), PROJECT_CONFIG_FILE);
  }

  /** Ensure .quikim directory exists */
  private async ensureQuikimDir(): Promise<void> {
    try {
      await mkdir(this.getQuikimDirPath(), { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  /** Check if project config exists */
  async exists(): Promise<boolean> {
    try {
      await access(this.getConfigFilePath());
      return true;
    } catch {
      return false;
    }
  }

  /** Read project configuration */
  async read(): Promise<ProjectConfig | null> {
    try {
      const content = await readFile(this.getConfigFilePath(), "utf-8");
      return JSON.parse(content) as ProjectConfig;
    } catch {
      return null;
    }
  }

  /** Write project configuration */
  async write(config: ProjectConfig): Promise<void> {
    await this.ensureQuikimDir();
    const content = JSON.stringify(config, null, 2);
    await writeFile(this.getConfigFilePath(), content, "utf-8");
  }

  /** Delete project configuration */
  async delete(): Promise<void> {
    const { unlink } = await import("fs/promises");
    try {
      await unlink(this.getConfigFilePath());
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /** Get the .quikim directory path (for display) */
  getQuikimDirectory(): string {
    return this.getQuikimDirPath();
  }
}

/** Singleton config manager instance */
export const configManager = new ConfigManager();

/** Create project config manager for a specific path */
export function createProjectConfig(projectPath: string): ProjectConfigManager {
  return new ProjectConfigManager(projectPath);
}
