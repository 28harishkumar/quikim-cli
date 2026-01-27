/**
 * Quikim - Artifact Metadata Manager
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { computeContentHash } from "../utils/content-normalizer.js";

/**
 * Local version metadata for tracking artifact sync state
 */
export interface LocalVersionMetadata {
  artifactId: string;
  artifactType: string;
  artifactName: string;
  specName: string;
  versionNumber: number;
  contentHash: string;
  lastSyncTimestamp: string;
}

/**
 * Metadata storage structure
 */
interface MetadataStorage {
  artifacts: Record<string, LocalVersionMetadata>;
  lastUpdated: string;
}

/**
 * Manages local metadata for artifact synchronization
 * Stores version information and content hashes to enable efficient sync
 */
export class MetadataManager {
  private metadataCache: Map<string, MetadataStorage> = new Map();

  /**
   * Get metadata file path for a spec
   */
  private getMetadataPath(artifactsRoot: string, specName: string): string {
    return join(artifactsRoot, specName, ".metadata.json");
  }

  /**
   * Load metadata for a spec
   */
  async loadMetadata(artifactsRoot: string, specName: string): Promise<MetadataStorage> {
    const cacheKey = `${artifactsRoot}:${specName}`;
    
    // Check cache first
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!;
    }

    const metadataPath = this.getMetadataPath(artifactsRoot, specName);

    try {
      const content = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(content) as MetadataStorage;
      this.metadataCache.set(cacheKey, metadata);
      return metadata;
    } catch (error) {
      // If file doesn't exist or is invalid, return empty metadata
      const emptyMetadata: MetadataStorage = {
        artifacts: {},
        lastUpdated: new Date().toISOString(),
      };
      this.metadataCache.set(cacheKey, emptyMetadata);
      return emptyMetadata;
    }
  }

  /**
   * Save metadata for a spec
   */
  async saveMetadata(
    artifactsRoot: string,
    specName: string,
    metadata: MetadataStorage
  ): Promise<void> {
    const metadataPath = this.getMetadataPath(artifactsRoot, specName);
    const cacheKey = `${artifactsRoot}:${specName}`;

    // Ensure directory exists
    await fs.mkdir(dirname(metadataPath), { recursive: true });

    // Update timestamp
    metadata.lastUpdated = new Date().toISOString();

    // Write to file
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

    // Update cache
    this.metadataCache.set(cacheKey, metadata);
  }

  /**
   * Get metadata for a specific artifact
   */
  async getArtifactMetadata(
    artifactsRoot: string,
    specName: string,
    artifactId: string
  ): Promise<LocalVersionMetadata | null> {
    const metadata = await this.loadMetadata(artifactsRoot, specName);
    return metadata.artifacts[artifactId] || null;
  }

  /**
   * Update metadata for a specific artifact
   */
  async updateArtifactMetadata(
    artifactsRoot: string,
    specName: string,
    artifactMetadata: LocalVersionMetadata
  ): Promise<void> {
    const metadata = await this.loadMetadata(artifactsRoot, specName);
    metadata.artifacts[artifactMetadata.artifactId] = artifactMetadata;
    await this.saveMetadata(artifactsRoot, specName, metadata);
  }

  /**
   * Check if artifact content has changed since last sync
   * Returns true if content is different or no metadata exists
   */
  async hasContentChanged(
    artifactsRoot: string,
    specName: string,
    artifactId: string,
    currentContent: string
  ): Promise<boolean> {
    const artifactMetadata = await this.getArtifactMetadata(
      artifactsRoot,
      specName,
      artifactId
    );

    if (!artifactMetadata) {
      return true; // No metadata, assume changed
    }

    const currentHash = computeContentHash(currentContent);
    return currentHash !== artifactMetadata.contentHash;
  }

  /**
   * Update metadata after successful pull
   */
  async updateAfterPull(
    artifactsRoot: string,
    specName: string,
    artifactId: string,
    artifactType: string,
    artifactName: string,
    versionNumber: number,
    content: string
  ): Promise<void> {
    const contentHash = computeContentHash(content);
    const artifactMetadata: LocalVersionMetadata = {
      artifactId,
      artifactType,
      artifactName,
      specName,
      versionNumber,
      contentHash,
      lastSyncTimestamp: new Date().toISOString(),
    };

    await this.updateArtifactMetadata(artifactsRoot, specName, artifactMetadata);
  }

  /**
   * Clear cache for a spec (useful for testing or forcing reload)
   */
  clearCache(artifactsRoot?: string, specName?: string): void {
    if (artifactsRoot && specName) {
      const cacheKey = `${artifactsRoot}:${specName}`;
      this.metadataCache.delete(cacheKey);
    } else {
      this.metadataCache.clear();
    }
  }
}
