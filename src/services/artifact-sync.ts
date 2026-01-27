/**
 * Quikim - Artifact Sync Service
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { ArtifactFileManager } from "./artifact-file-manager.js";
import { configManager } from "../config/manager.js";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import {
  ArtifactFilters,
  ArtifactMetadata,
  LocalArtifact,
  ServerArtifact,
  PushOptions,
  PullOptions,
  SyncOptions,
  PushResult,
  PullResult,
  SyncResult,
  ArtifactType,
} from "../types/artifacts.js";
import { extractTitleFromMarkdown, parseTasksFromMarkdown } from "../utils/markdown-parser.js";

/** Extract list from API response: array as-is, or response.data if wrapped as { data: T[] } */
function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && "data" in raw) {
    const inner = (raw as { data: unknown }).data;
    return Array.isArray(inner) ? (inner as T[]) : [];
  }
  return [];
}

/** Normalize text for comparison: strip HTML tags and collapse whitespace */
function normalizedText(s: string): string {
  const stripped = s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped;
}

export class ArtifactSyncService {
  private fileManager: ArtifactFileManager;

  constructor() {
    this.fileManager = new ArtifactFileManager();
  }

  /**
   * Push local artifacts to server
   */
  async pushArtifacts(
    filters: ArtifactFilters,
    options: PushOptions = {}
  ): Promise<PushResult> {
    const result: PushResult = {
      success: true,
      pushed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Scan local artifacts
      const localArtifacts = await this.fileManager.scanLocalArtifacts(filters);

      if (options.dryRun) {
        console.log(`[DRY RUN] Would push ${localArtifacts.length} artifacts`);
        return result;
      }

      // Get current project
      const project = configManager.getCurrentProject();
      if (!project) {
        throw new Error("No project connected. Run 'quikim connect' first.");
      }

      // Process each artifact
      for (const artifact of localArtifacts) {
        try {
          const shouldPush = await this.shouldPushArtifact(artifact, options);
          
          if (!shouldPush) {
            result.skipped++;
            if (options.verbose) {
              console.log(`Skipped: ${artifact.filePath} (no changes)`);
            }
            continue;
          }

          // Handle tasks differently - create milestone and tasks
          if (artifact.artifactType === "tasks") {
            await this.pushTasksAsMilestone(project.projectId, artifact);
          } else {
            const artifactId = await this.pushSingleArtifact(project.projectId, artifact);
            
            // Rename file to use artifact ID
            if (artifactId) {
              await this.renameArtifactFile(artifact, artifactId);
            }
          }
          
          result.pushed++;

          if (options.verbose) {
            console.log(`Pushed: ${artifact.filePath}`);
          }
        } catch (error) {
          result.success = false;
          result.errors.push({
            artifact: artifact.filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        artifact: "general",
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    }
  }

  /**
   * Pull artifacts from server to local
   */
  async pullArtifacts(
    filters: ArtifactFilters,
    options: PullOptions = {}
  ): Promise<PullResult> {
    const result: PullResult = {
      success: true,
      pulled: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      const project = configManager.getCurrentProject();
      if (!project) {
        throw new Error("No project connected. Run 'quikim connect' first.");
      }

      // Fetch artifacts from server
      const serverArtifacts = await this.fetchServerArtifacts(
        project.projectId,
        filters
      );

      if (options.dryRun) {
        console.log(`[DRY RUN] Would pull ${serverArtifacts.length} artifacts`);
        return result;
      }

      // Process each artifact
      for (const artifact of serverArtifacts) {
        try {
          const exists = await this.fileManager.artifactExists(artifact);
          
          await this.fileManager.writeArtifactFile(artifact);
          
          if (exists) {
            result.updated++;
            if (options.verbose) {
              console.log(`Updated: ${this.getArtifactPath(artifact)}`);
            }
          } else {
            result.created++;
            if (options.verbose) {
              console.log(`Created: ${this.getArtifactPath(artifact)}`);
            }
          }
          
          result.pulled++;
        } catch (error) {
          result.success = false;
          result.errors.push({
            artifact: this.getArtifactPath(artifact),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        artifact: "general",
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    }
  }

  /**
   * Sync artifacts (push then pull)
   */
  async syncArtifacts(
    filters: ArtifactFilters,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const pushResult = await this.pushArtifacts(filters, options);
    const pullResult = await this.pullArtifacts(filters, options);

    return {
      push: pushResult,
      pull: pullResult,
      success: pushResult.success && pullResult.success,
    };
  }

  /**
   * Check if artifact should be pushed (has changes)
   */
  private async shouldPushArtifact(
    artifact: LocalArtifact,
    options: PushOptions
  ): Promise<boolean> {
    if (options.force) {
      return true;
    }

    // Calculate content hash
    const contentHash = this.calculateHash(artifact.content);

    // Check if artifact exists on server
    const project = configManager.getCurrentProject();
    if (!project) {
      return true; // Push if no project (will fail later, but let it)
    }

    try {
      const serverArtifact = await this.fetchServerArtifact(
        project.projectId,
        artifact.specName,
        artifact.artifactType,
        artifact.artifactName
      );

      if (!serverArtifact) {
        return true; // New artifact, push it
      }

      // Compare hashes
      const serverHash = serverArtifact.contentHash || 
        this.calculateHash(serverArtifact.content);

      return contentHash !== serverHash;
    } catch (error) {
      // If we can't check, push it (server will handle)
      return true;
    }
  }

  /**
   * Push single artifact to server
   * Returns the artifact ID for file renaming
   */
  private async pushSingleArtifact(
    projectId: string,
    artifact: LocalArtifact
  ): Promise<string | null> {
    // Route to appropriate endpoint based on artifact type
    let endpoint: string;
    let requestBody: any;

    // Extract name from content for HLD/LLD if name is generic
    let artifactName = artifact.artifactName;
    if ((artifact.artifactType === "hld" || artifact.artifactType === "lld") && 
        (artifactName === "design" || artifactName === "hld" || artifactName === "lld")) {
      const extractedName = extractTitleFromMarkdown(artifact.content);
      if (extractedName) {
        artifactName = extractedName;
      }
    }

    const reqIdFromName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artifactName);

    switch (artifact.artifactType) {
      case "requirement":
        if (reqIdFromName) {
          endpoint = `/api/v1/requirements/${artifactName}`;
          requestBody = {
            content: artifact.content,
            changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
            changeType: "minor",
          };
        } else {
          endpoint = `/api/v1/requirements/`;
          requestBody = {
            projectId,
            name: artifactName,
            content: artifact.content,
            changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
            changeType: "minor",
            specName: artifact.specName || "default",
          };
        }
        break;

      case "hld":
      case "lld":
        endpoint = `/api/v1/designs/`;
        // Check if artifactName is a UUID (ID from filename)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artifactName);
        requestBody = {
          projectId,
          ...(isUUID && { id: artifactName }), // Send as ID if it's a UUID
          ...(!isUUID && { name: artifactName }), // Send as name if it's not a UUID
          type: artifact.artifactType,
          content: artifact.content,
          changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
          specName: artifact.specName || "default",
        };
        break;

      case "flow_diagram":
        endpoint = `/api/v1/er-diagrams/`;
        requestBody = {
          projectId,
          name: artifactName,
          content: artifact.content,
          specName: artifact.specName || "default",
        };
        break;

      case "context":
      case "code_guideline":
      case "wireframe_files":
        // Use unified artifacts endpoint if it exists, otherwise throw error
        endpoint = `/api/v1/projects/${projectId}/artifacts`;
        requestBody = {
          specName: artifact.specName || "default",
          artifactType: artifact.artifactType,
          artifactName: artifactName,
          content: artifact.content,
        };
        break;

      default:
        throw new Error(`Unsupported artifact type: ${artifact.artifactType}`);
    }
    
    const isReqPatch = artifact.artifactType === "requirement" && reqIdFromName;
    const response = await this.makeRequest<{
      success: boolean;
      id?: string;
      artifactId?: string;
      data?: { id?: string };
      version?: number;
    }>("project", endpoint, {
      method: isReqPatch ? "PATCH" : "POST",
      body: JSON.stringify(requestBody),
    });

    if (!response.success || !response.data) {
      const errorMsg = response.error || "Unknown error";
      throw new Error(`Failed to push artifact to server: ${errorMsg}`);
    }

    const raw = response.data as { id?: string; artifactId?: string; data?: { id?: string } };
    const artifactId = raw.id ?? raw.artifactId ?? raw.data?.id ?? (isReqPatch ? artifactName : null);
    return artifactId;
  }

  /**
   * Push tasks file as milestone with tasks. Resolves milestone by name to avoid duplicates;
   * skips tasks whose description (normalized, MD vs HTML) already exists.
   */
  private async pushTasksAsMilestone(
    projectId: string,
    artifact: LocalArtifact
  ): Promise<void> {
    const fromContent = extractTitleFromMarkdown(artifact.content);
    const fromFilename = artifact.artifactName.replace(/^tasks_?/i, "") || artifact.specName || "Milestone";
    const milestoneName = fromContent || fromFilename;

    const parsed = parseTasksFromMarkdown(artifact.content, milestoneName);

    const specFilter = artifact.specName ? `&specName=${encodeURIComponent(artifact.specName)}` : "";
    const listRes = await this.makeRequest<unknown>(
      "project",
      `/api/v1/milestones/?projectId=${projectId}${specFilter}`,
      { method: "GET" }
    );
    const milestones = asList<{ id: string; name: string }>(listRes.data);
    const existing = milestones.find((m: { name: string }) => m.name === parsed.name || m.name === milestoneName);

    let milestoneId: string;
    if (existing) {
      milestoneId = existing.id;
    } else {
      const createRes = await this.makeRequest<{ success: boolean; data?: { id: string } }>(
        "project",
        "/api/v1/milestones/",
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            name: parsed.name,
            description: parsed.description,
            order: 0,
            status: "pending",
          }),
        }
      );
      const data = createRes.data as { data?: { id: string } } | undefined;
      if (!createRes.success || !data?.data?.id) {
        throw new Error("Failed to create milestone");
      }
      milestoneId = data.data.id;
    }

    const tasksRes = await this.makeRequest<unknown>(
      "project",
      `/api/v1/tasks/?projectId=${projectId}&milestoneId=${milestoneId}${specFilter}`,
      { method: "GET" }
    );
    type TaskRec = { title?: string; description?: string };
    const existingTasks = asList<TaskRec>(tasksRes.data);
    const existingNorm = new Set(existingTasks.map((t) => normalizedText(String(t.description ?? ""))));

    for (const task of parsed.tasks) {
      const normLocal = normalizedText(task.description || "");
      if (existingNorm.has(normLocal)) continue;
      const taskResponse = await this.makeRequest<{ success: boolean }>(
        "project",
        "/api/v1/tasks/",
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            milestoneId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.required ? "high" : "medium",
            type: "feature",
            specName: artifact.specName || "default",
            locked: task.required,
            order: task.order,
          }),
        }
      );
      if (!taskResponse.success) {
        console.warn(`Failed to create task: ${task.title}`);
      } else {
        existingNorm.add(normLocal);
      }
    }

    const safeName = (parsed.name || milestoneName).replace(/[/\\:*?"<>|]/g, "_").replace(/\s+/g, "_") || "milestone";
    const dir = dirname(artifact.filePath);
    const newPath = join(dir, `tasks_${safeName}.md`);
    if (artifact.filePath !== newPath) {
      try {
        await fs.rename(artifact.filePath, newPath);
      } catch {
        // ignore rename errors
      }
    }
  }

  /**
   * Rename artifact file to use server ID
   */
  private async renameArtifactFile(
    artifact: LocalArtifact,
    artifactId: string
  ): Promise<void> {
    const oldPath = artifact.filePath;
    const dir = dirname(oldPath);
    const newFileName = `${artifact.artifactType}_${artifactId}.md`;
    const newPath = join(dir, newFileName);

    try {
      await fs.rename(oldPath, newPath);
    } catch (error) {
      // If rename fails, log but don't throw (file might already be renamed)
      console.warn(`Failed to rename file ${oldPath} to ${newPath}: ${error}`);
    }
  }

  /**
   * Make HTTP request using ServiceAwareAPIClient pattern
   */
  private async makeRequest<T>(
    serviceType: "user" | "project",
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const baseURL = serviceType === "user" 
      ? configManager.getUserServiceUrl()
      : configManager.getProjectServiceUrl();
    const url = `${baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(configManager.getAuth()?.token && {
        Authorization: `Bearer ${configManager.getAuth()!.token}`,
      }),
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: (errorData as any)?.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch artifacts from server
   */
  private async fetchServerArtifacts(
    projectId: string,
    filters: ArtifactFilters
  ): Promise<ServerArtifact[]> {
    const artifacts: ServerArtifact[] = [];

    // Fetch from appropriate endpoints based on artifact type
    if (!filters.artifactType || filters.artifactType === "requirement") {
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/requirements/?projectId=${projectId}${filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : ""}`,
        { method: "GET" }
      );
      const list = asList<{ id: string; specName?: string; name: string; content: unknown; version: number; createdAt: string; updatedAt: string }>(response.data);
      for (const req of list) {
        if (filters.specName && req.specName !== filters.specName) continue;
        if (filters.artifactName && req.name !== filters.artifactName) continue;
        const createdAt = req.createdAt;
        artifacts.push({
          artifactId: req.id,
          specName: req.specName || "default",
          artifactType: "requirement",
          artifactName: req.name,
          content: typeof req.content === "string" ? req.content : JSON.stringify(req.content),
          version: req.version,
          createdAt: new Date(createdAt),
          updatedAt: new Date(req.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "hld" || filters.artifactType === "lld") {
      const typeFilter = filters.artifactType === "hld" ? "hld" : filters.artifactType === "lld" ? "lld" : undefined;
      const specFilter = filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : "";
      const endpoint = typeFilter 
        ? `/api/v1/designs/?projectId=${projectId}&type=${typeFilter}${specFilter}`
        : `/api/v1/designs/?projectId=${projectId}${specFilter}`;
      
      const response = await this.makeRequest<unknown>(
        "project",
        endpoint,
        { method: "GET" }
      );
      const list = asList<{ id: string; specName?: string; type: string; name: string; content: unknown; version: number; createdAt: string; updatedAt: string }>(response.data);
      for (const design of list) {
        if (filters.specName && design.specName !== filters.specName) continue;
        if (filters.artifactName && design.name !== filters.artifactName) continue;
        artifacts.push({
          artifactId: design.id,
          specName: design.specName || "default",
          artifactType: design.type as ArtifactType,
          artifactName: design.name,
          content: typeof design.content === "string" ? design.content : JSON.stringify(design.content),
          version: design.version,
          createdAt: new Date(design.createdAt),
          updatedAt: new Date(design.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "tasks") {
      const specFilter = filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : "";
      const milestoneResponse = await this.makeRequest<unknown>(
        "project",
        `/api/v1/milestones/?projectId=${projectId}${specFilter}`,
        { method: "GET" }
      );
      const milestones = asList<{ id: string; name: string; description?: string; createdAt: string; updatedAt: string }>(milestoneResponse.data);
      for (const milestone of milestones) {
        const tasksResponse = await this.makeRequest<unknown>(
          "project",
          `/api/v1/tasks/?projectId=${projectId}&milestoneId=${milestone.id}${specFilter}`,
          { method: "GET" }
        );
        type TaskRecord = { title?: string; description?: string; status?: string; order?: number; locked?: boolean; specName?: string };
        const tasks = asList<TaskRecord>(tasksResponse.data);
        const markdown = this.reconstructTasksMarkdown(milestone, tasks);
        const specName = tasks.length > 0 && tasks[0].specName ? tasks[0].specName : "default";
        artifacts.push({
          artifactId: milestone.id,
          specName,
          artifactType: "tasks",
          artifactName: milestone.name,
          content: markdown,
          version: 1,
          createdAt: new Date(milestone.createdAt),
          updatedAt: new Date(milestone.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "flow_diagram") {
      const specFilter = filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : "";
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/er-diagrams/?projectId=${projectId}${specFilter}`,
        { method: "GET" }
      );
      const list = asList<{ id: string; specName?: string; name: string; content: unknown; version?: number; createdAt: string; updatedAt: string }>(response.data);
      for (const diagram of list) {
        if (filters.specName && diagram.specName !== filters.specName) continue;
        if (filters.artifactName && diagram.name !== filters.artifactName) continue;
        artifacts.push({
          artifactId: diagram.id,
          specName: diagram.specName || "default",
          artifactType: "flow_diagram",
          artifactName: diagram.name,
          content: typeof diagram.content === "string" ? diagram.content : JSON.stringify(diagram.content),
          version: diagram.version || 1,
          createdAt: new Date(diagram.createdAt),
          updatedAt: new Date(diagram.updatedAt),
        });
      }
    }

    return artifacts;
  }

  /**
   * Fetch single artifact from server
   * Returns the latest version if multiple versions exist
   */
  private async fetchServerArtifact(
    projectId: string,
    specName: string,
    artifactType: ArtifactType,
    artifactName: string
  ): Promise<ServerArtifact | null> {
    const artifacts = await this.fetchServerArtifacts(projectId, {
      specName,
      artifactType,
      artifactName,
    });

    if (artifacts.length === 0) {
      return null;
    }

    // Return the artifact with the highest version (latest)
    return artifacts.reduce((latest, current) => {
      return current.version > latest.version ? current : latest;
    });
  }

  /**
   * Calculate content hash
   */
  private calculateHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Get artifact file path
   */
  private getArtifactPath(artifact: ArtifactMetadata & { artifactId?: string }): string {
    const fileName = artifact.artifactId 
      ? `${artifact.artifactType}_${artifact.artifactId}.md`
      : `${artifact.artifactType}_${artifact.artifactName}.md`;
    return `.quikim/artifacts/${artifact.specName}/${fileName}`;
  }

  /**
   * Reconstruct tasks markdown from milestone and tasks
   */
  private reconstructTasksMarkdown(milestone: any, tasks: any[]): string {
    let markdown = `# ${milestone.name}\n\n`;
    
    if (milestone.description) {
      markdown += `${milestone.description}\n\n`;
    }
    
    markdown += `## Tasks\n\n`;
    
    // Sort tasks by order
    const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    for (const task of sortedTasks) {
      const status = task.status || "todo";
      const isCompleted = status === "completed";
      const isOptional = !task.locked;
      const checkbox = isCompleted ? "[x]" : "[ ]";
      const optionalMarker = isOptional ? "*" : "";
      
      markdown += `- ${checkbox} ${task.title}${optionalMarker}\n`;
      
      if (task.description) {
        const descLines = task.description.split("\n");
        for (const line of descLines) {
          markdown += `  ${line}\n`;
        }
      }
    }
    
    return markdown;
  }

  /**
   * Update artifact metadata (name and specName)
   */
  async updateArtifactMetadata(
    artifactType: string,
    identifier: string,
    updates: { name?: string; specName?: string }
  ): Promise<void> {
    const project = configManager.getCurrentProject();
    if (!project) {
      throw new Error("No project connected. Run 'quikim connect' first.");
    }

    // Determine if identifier is an ID (UUID) or name
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    let endpoint: string;
    let method = "PATCH";

    switch (artifactType) {
      case "requirement":
        endpoint = isId 
          ? `/api/v1/requirements/${identifier}`
          : `/api/v1/requirements/?projectId=${project.projectId}&name=${encodeURIComponent(identifier)}`;
        break;

      case "hld":
      case "lld":
        endpoint = isId
          ? `/api/v1/designs/${identifier}`
          : `/api/v1/designs/?projectId=${project.projectId}&type=${artifactType}&name=${encodeURIComponent(identifier)}`;
        break;

      case "context":
      case "code_guideline":
      case "wireframe_files":
        endpoint = `/api/v1/projects/${project.projectId}/artifacts/${identifier}`;
        break;

      case "tasks":
        // For tasks, update milestone
        endpoint = isId
          ? `/api/v1/milestones/${identifier}`
          : `/api/v1/milestones/?projectId=${project.projectId}&name=${encodeURIComponent(identifier)}`;
        break;

      default:
        throw new Error(`Cannot edit ${artifactType}`);
    }

    const requestBody: any = {};
    if (updates.name) {
      if (artifactType === "tasks") {
        requestBody.name = updates.name;
      } else {
        requestBody.name = updates.name;
      }
    }

    // Note: specName updates may require different endpoints or may not be supported
    // This is a simplified implementation
    if (updates.specName && artifactType !== "tasks") {
      // For most artifacts, specName is set on creation and may not be updatable
      // This would require checking the API documentation
    }

    const response = await this.makeRequest<{
      success: boolean;
      data?: any;
    }>("project", endpoint, {
      method,
      body: JSON.stringify(requestBody),
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to update artifact");
    }
  }
}
