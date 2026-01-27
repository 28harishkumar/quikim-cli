/**
 * Quikim - Artifact File Manager
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { promises as fs } from "fs";
import { join } from "path";
import {
  ArtifactFilters,
  ArtifactMetadata,
  LocalArtifact,
  ArtifactType,
} from "../types/artifacts.js";

export class ArtifactFileManager {
  private artifactsDir: string;

  constructor() {
    this.artifactsDir = join(process.cwd(), ".quikim", "artifacts");
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
   * Write artifact file to local filesystem
   * Uses artifactId if available, otherwise uses artifactName
   */
  async writeArtifactFile(artifact: ArtifactMetadata & { artifactId?: string }): Promise<void> {
    // Use artifactId for filename if available, otherwise use artifactName
    const fileName = artifact.artifactId 
      ? `${artifact.artifactType}_${artifact.artifactId}.md`
      : `${artifact.artifactType}_${artifact.artifactName}.md`;
    
    const filePath = join(this.artifactsDir, artifact.specName, fileName);
    const dirPath = join(this.artifactsDir, artifact.specName);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.writeFile(filePath, artifact.content, "utf-8");
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

    if (!validTypes.includes(typeStr as ArtifactType)) {
      return null;
    }

    return {
      type: typeStr as ArtifactType,
      name: nameOrId, // Can be either name or ID
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
}
