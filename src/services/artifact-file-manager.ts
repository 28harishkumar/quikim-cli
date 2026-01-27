/**
 * Quikim - Artifact File Manager
 *
 * Copyright (c) 2026 Quikim Inc.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { existsSync } from "fs";
import { promises as fs } from "fs";
import { dirname, join, basename, resolve } from "path";
import {
  ArtifactFilters,
  ArtifactMetadata,
  LocalArtifact,
  ArtifactType,
} from "../types/artifacts.js";

/** Walk up from cwd to find a directory containing .quikim/artifacts */
function resolveArtifactsRoot(): string {
  let dir = process.cwd();
  while (true) {
    const candidate = join(dir, ".quikim", "artifacts");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), ".quikim", "artifacts");
}

export class ArtifactFileManager {
  private artifactsDir: string;

  constructor(artifactsDir?: string) {
    this.artifactsDir = artifactsDir || resolveArtifactsRoot();
  }

  /**
   * Get the artifacts root directory
   */
  getArtifactsRoot(): string {
    return this.artifactsDir;
  }

  /**
   * Scan local artifacts matching filters
   */
  async scanLocalArtifacts(
    filters: ArtifactFilters
  ): Promise<LocalArtifact[]> {
    const artifacts: LocalArtifact[] = [];

    try {
      // Ensure artifacts directory exists
      await this.ensureArtifactsDir();

      // Read all spec directories
      const specDirs = await fs.readdir(this.artifactsDir, {
        withFileTypes: true,
      });

      for (const specDir of specDirs) {
        if (!specDir.isDirectory()) continue;

        const specName = specDir.name;

        // Filter by spec name if specified
        if (filters.specName && specName !== filters.specName) {
          continue;
        }

        const specPath = join(this.artifactsDir, specName);
        const files = await fs.readdir(specPath);

        for (const file of files) {
          if (!file.endsWith(".md")) continue;

          // Parse artifact from filename: <type>_<name>.md
          const parsed = this.parseArtifactFilename(file);
          if (!parsed) continue;

          // Filter by artifact type if specified
          if (filters.artifactType && parsed.type !== filters.artifactType) {
            continue;
          }

          // Filter by artifact name if specified
          if (filters.artifactName && parsed.name !== filters.artifactName) {
            continue;
          }

          // Read file content
          const filePath = join(specPath, file);
          const content = await fs.readFile(filePath, "utf-8");
          const stats = await fs.stat(filePath);

          artifacts.push({
            specName,
            artifactType: parsed.type,
            artifactName: parsed.name,
            content,
            filePath,
            lastModified: stats.mtime,
          });
        }
      }
    } catch (error) {
      // Directory might not exist yet
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    return artifacts;
  }

  /**
   * Check if artifact file exists locally
   */
  async artifactExists(artifact: ArtifactMetadata): Promise<boolean> {
    const filePath = this.getArtifactFilePath(artifact);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write artifact file to local filesystem with atomic write and backup
   * Uses artifactId if available, otherwise uses artifactName
   */
  async writeArtifactFile(artifact: ArtifactMetadata & { artifactId?: string }): Promise<void> {
    // Use artifactId for filename if available, otherwise use artifactName
    const fileName = artifact.artifactId 
      ? `${artifact.artifactType}_${artifact.artifactId}.md`
      : `${artifact.artifactType}_${artifact.artifactName}.md`;
    
    const filePath = join(this.artifactsDir, artifact.specName, fileName);
    const dirPath = join(this.artifactsDir, artifact.specName);

    // Validate file path to prevent directory traversal
    this.validateFilePath(filePath);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Create backup if file exists
    if (existsSync(filePath)) {
      await this.createBackup(filePath);
    }

    // Atomic write: write to temp file, then rename
    const tempFilePath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempFilePath, artifact.content, "utf-8");
      await fs.rename(tempFilePath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Read artifact file from local filesystem
   */
  async readArtifactFile(
    specName: string,
    artifactType: ArtifactType,
    artifactName: string
  ): Promise<string | null> {
    const filePath = join(
      this.artifactsDir,
      specName,
      `${artifactType}_${artifactName}.md`
    );

    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Parse artifact filename: <type>_<name_or_id>.md
   * Supports both name-based and ID-based filenames
   */
  private parseArtifactFilename(
    filename: string
  ): { type: ArtifactType; name: string } | null {
    const match = filename.match(/^(.+?)_(.+)\.md$/);
    if (!match) return null;

    const [, typeStr, nameOrId] = match;
    const validTypes: ArtifactType[] = [
      "requirement",
      "context",
      "code_guideline",
      "lld",
      "hld",
      "wireframe_files",
      "flow_diagram",
      "tasks",
    ];

    // "flow" is alias for flow_diagram (e.g. flow_<uuid>.md)
    const type = (typeStr === "flow" ? "flow_diagram" : typeStr) as ArtifactType;
    if (!validTypes.includes(type)) {
      return null;
    }

    return {
      type,
      name: nameOrId,
    };
  }

  /**
   * Get artifact file path
   */
  private getArtifactFilePath(artifact: ArtifactMetadata): string {
    return join(
      this.artifactsDir,
      artifact.specName,
      `${artifact.artifactType}_${artifact.artifactName}.md`
    );
  }

  /**
   * Ensure artifacts directory exists
   */
  private async ensureArtifactsDir(): Promise<void> {
    try {
      await fs.mkdir(this.artifactsDir, { recursive: true });
    } catch (error) {
      // Ignore if already exists
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Rename artifact file with proper error handling
   * @param oldPath - Current file path
   * @param newPath - New file path
   * @throws Error if rename fails
   */
  async renameArtifactFile(oldPath: string, newPath: string): Promise<void> {
    // Validate both paths
    this.validateFilePath(oldPath);
    this.validateFilePath(newPath);

    // Check if old file exists
    if (!existsSync(oldPath)) {
      throw new Error(`Source file does not exist: ${oldPath}`);
    }

    // Check if new file already exists
    if (existsSync(newPath)) {
      // Create backup of existing file
      await this.createBackup(newPath);
    }

    // Ensure target directory exists
    const targetDir = dirname(newPath);
    await fs.mkdir(targetDir, { recursive: true });

    // Perform rename
    try {
      await fs.rename(oldPath, newPath);
    } catch (error) {
      throw new Error(
        `Failed to rename file from ${oldPath} to ${newPath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Generate filename following naming conventions
   * @param artifactType - Type of artifact
   * @param artifactId - Artifact ID (or name if ID not available)
   * @returns Filename in format: <artifact_type>_<artifact_id>.md
   */
  generateFilename(artifactType: ArtifactType, artifactId: string): string {
    // Validate inputs
    if (!artifactType || !artifactId) {
      throw new Error("artifactType and artifactId are required");
    }

    // Sanitize artifactId to prevent path traversal
    const sanitizedId = artifactId.replace(/[^a-zA-Z0-9_-]/g, "_");

    return `${artifactType}_${sanitizedId}.md`;
  }

  /**
   * Extract artifact ID from filename
   * Handles both name-based and ID-based formats
   * @param filename - Filename to parse
   * @returns Artifact ID or null if invalid format
   */
  extractArtifactIdFromFilename(filename: string): string | null {
    // Pattern: <type>_<id>.md or <type>_<name>.md
    const match = filename.match(/^([a-z_]+)_([a-zA-Z0-9_-]+)\.md$/);
    if (!match) {
      return null;
    }

    const [, typeStr, idOrName] = match;

    // Validate artifact type
    const validTypes: ArtifactType[] = [
      "requirement",
      "context",
      "code_guideline",
      "lld",
      "hld",
      "wireframe_files",
      "flow_diagram",
      "tasks",
    ];

    // "flow" is alias for flow_diagram
    const type = (typeStr === "flow" ? "flow_diagram" : typeStr) as ArtifactType;
    if (!validTypes.includes(type)) {
      return null;
    }

    return idOrName;
  }

  /**
   * Validate file path to prevent directory traversal attacks
   * @param filePath - Path to validate
   * @throws Error if path is invalid or attempts directory traversal
   */
  private validateFilePath(filePath: string): void {
    // Resolve to absolute path
    const absolutePath = resolve(filePath);
    const artifactsRoot = resolve(this.artifactsDir);

    // Check if path is within artifacts directory
    if (!absolutePath.startsWith(artifactsRoot)) {
      throw new Error(
        `Invalid file path: ${filePath} is outside artifacts directory`
      );
    }

    // Check for directory traversal patterns
    if (filePath.includes("..") || filePath.includes("./")) {
      throw new Error(
        `Invalid file path: ${filePath} contains directory traversal patterns`
      );
    }

    // Check for absolute paths (should be relative to artifacts dir)
    const fileName = basename(filePath);
    if (fileName.startsWith("/") || fileName.includes("\\")) {
      throw new Error(`Invalid file path: ${filePath} contains invalid characters`);
    }
  }

  /**
   * Create backup of existing file
   * @param filePath - Path to file to backup
   */
  private async createBackup(filePath: string): Promise<void> {
    const backupDir = join(dirname(filePath), ".backups");
    await fs.mkdir(backupDir, { recursive: true });

    const fileName = basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(backupDir, `${fileName}.${timestamp}.bak`);

    try {
      await fs.copyFile(filePath, backupPath);

      // Clean up old backups (keep last 5)
      await this.cleanupOldBackups(backupDir, fileName);
    } catch (error) {
      // Log warning but don't fail the operation
      console.warn(`Warning: Failed to create backup: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up old backup files, keeping only the most recent ones
   * @param backupDir - Directory containing backups
   * @param fileName - Base filename to filter backups
   */
  private async cleanupOldBackups(
    backupDir: string,
    fileName: string
  ): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith(fileName) && f.endsWith(".bak"))
        .map((f) => join(backupDir, f));

      // Sort by modification time (newest first)
      const filesWithStats = await Promise.all(
        backupFiles.map(async (f) => ({
          path: f,
          mtime: (await fs.stat(f)).mtime,
        }))
      );

      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete old backups (keep last 5)
      const maxBackups = 5;
      if (filesWithStats.length > maxBackups) {
        const toDelete = filesWithStats.slice(maxBackups);
        await Promise.all(toDelete.map((f) => fs.unlink(f.path)));
      }
    } catch (error) {
      // Log warning but don't fail
      console.warn(
        `Warning: Failed to cleanup old backups: ${(error as Error).message}`
      );
    }
  }
}
