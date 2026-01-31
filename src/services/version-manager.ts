/**
 * Quikim - Version Manager
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { promises as fs } from "fs";
import { dirname } from "path";
import { computeContentHash, normalizeForComparison } from "../utils/content-normalizer.js";
import { getMetadataPath } from "../utils/artifacts-path-resolver.js";

/**
 * Represents a version of an artifact
 */
export interface ArtifactVersion {
  artifactId: string;
  versionNumber: number;
  contentHash: string;
  createdAt: string;
}

/**
 * Local metadata for tracking artifact versions
 */
export interface LocalVersionMetadata {
  artifactId: string;
  versionNumber: number;
  contentHash: string;
  lastSyncTimestamp: string;
}

/**
 * Metadata storage structure for a spec
 */
export interface SpecMetadata {
  specName: string;
  artifacts: Record<string, LocalVersionMetadata>;
  lastUpdated: string;
}

/**
 * Version Manager handles artifact version tracking and comparison
 */
export class VersionManager {
  private metadataCache: Map<string, SpecMetadata> = new Map();

  /**
   * Get the latest version information for an artifact
   * @param artifactId - The artifact ID
   * @param specName - The spec name
   * @returns The latest version metadata or null if not found
   */
  async getLatestVersion(
    artifactId: string,
    specName: string
  ): Promise<LocalVersionMetadata | null> {
    const metadata = await this.loadMetadata(specName);
    return metadata.artifacts[artifactId] || null;
  }

  /**
   * Determine if a new version should be created based on content comparison
   * @param currentContent - The current content to push
   * @param serverContent - The content from the server
   * @returns True if content differs and new version should be created
   */
  shouldCreateNewVersion(currentContent: string, serverContent: string): boolean {
    if (!currentContent && !serverContent) {
      return false;
    }

    if (!currentContent || !serverContent) {
      return true;
    }

    // Normalize both contents for comparison
    const normalizedCurrent = normalizeForComparison(currentContent);
    const normalizedServer = normalizeForComparison(serverContent);

    // Compare normalized content
    return normalizedCurrent !== normalizedServer;
  }

  /**
   * Create or update version metadata for an artifact
   * @param artifactId - The artifact ID
   * @param specName - The spec name
   * @param content - The artifact content
   * @param versionNumber - The version number
   * @returns The created version metadata
   */
  async createVersion(
    artifactId: string,
    specName: string,
    content: string,
    versionNumber: number
  ): Promise<LocalVersionMetadata> {
    const contentHash = computeContentHash(content);
    const timestamp = new Date().toISOString();

    const versionMetadata: LocalVersionMetadata = {
      artifactId,
      versionNumber,
      contentHash,
      lastSyncTimestamp: timestamp,
    };

    // Update metadata
    await this.updateMetadata(specName, artifactId, versionMetadata);

    return versionMetadata;
  }

  /**
   * Check if content has changed compared to stored metadata
   * @param artifactId - The artifact ID
   * @param specName - The spec name
   * @param content - The current content
   * @returns True if content has changed
   */
  async hasContentChanged(
    artifactId: string,
    specName: string,
    content: string
  ): Promise<boolean> {
    const latestVersion = await this.getLatestVersion(artifactId, specName);
    
    if (!latestVersion) {
      return true; // No metadata means it's new or changed
    }

    const currentHash = computeContentHash(content);
    return currentHash !== latestVersion.contentHash;
  }

  /**
   * Load metadata for a spec from disk
   * @param specName - The spec name
   * @returns The spec metadata
   */
  private async loadMetadata(specName: string): Promise<SpecMetadata> {
    // Check cache first
    if (this.metadataCache.has(specName)) {
      return this.metadataCache.get(specName)!;
    }

    const metadataPath = getMetadataPath(specName);

    try {
      const data = await fs.readFile(metadataPath, "utf-8");
      const metadata: SpecMetadata = JSON.parse(data);
      this.metadataCache.set(specName, metadata);
      return metadata;
    } catch (error) {
      // If file doesn't exist or is invalid, return empty metadata
      const emptyMetadata: SpecMetadata = {
        specName,
        artifacts: {},
        lastUpdated: new Date().toISOString(),
      };
      this.metadataCache.set(specName, emptyMetadata);
      return emptyMetadata;
    }
  }

  /**
   * Save metadata for a spec to disk
   * @param specName - The spec name
   * @param metadata - The metadata to save
   */
  private async saveMetadata(specName: string, metadata: SpecMetadata): Promise<void> {
    const metadataPath = getMetadataPath(specName);

    // Ensure directory exists
    await fs.mkdir(dirname(metadataPath), { recursive: true });

    // Update timestamp
    metadata.lastUpdated = new Date().toISOString();

    // Write to disk
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

    // Update cache
    this.metadataCache.set(specName, metadata);
  }

  /**
   * Update metadata for a specific artifact
   * @param specName - The spec name
   * @param artifactId - The artifact ID
   * @param versionMetadata - The version metadata to store
   */
  private async updateMetadata(
    specName: string,
    artifactId: string,
    versionMetadata: LocalVersionMetadata
  ): Promise<void> {
    const metadata = await this.loadMetadata(specName);
    metadata.artifacts[artifactId] = versionMetadata;
    await this.saveMetadata(specName, metadata);
  }

  /**
   * Clear metadata cache (useful for testing)
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Delete metadata for a specific artifact
   * @param specName - The spec name
   * @param artifactId - The artifact ID
   */
  async deleteArtifactMetadata(specName: string, artifactId: string): Promise<void> {
    const metadata = await this.loadMetadata(specName);
    delete metadata.artifacts[artifactId];
    await this.saveMetadata(specName, metadata);
  }

  /**
   * Get all artifact metadata for a spec
   * @param specName - The spec name
   * @returns Record of artifact IDs to their metadata
   */
  async getAllArtifactMetadata(specName: string): Promise<Record<string, LocalVersionMetadata>> {
    const metadata = await this.loadMetadata(specName);
    return metadata.artifacts;
  }
}
