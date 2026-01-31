/**
 * Quikim - Artifact Metadata Manager Tests
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { MetadataManager } from "./metadata-manager.js";

describe("MetadataManager", () => {
  let testDir: string;
  let metadataManager: MetadataManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `quikim-metadata-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    metadataManager = new MetadataManager();
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
    metadataManager.clearCache();
  });

  describe("loadMetadata", () => {
    it("should return empty metadata when file doesn't exist", async () => {
      const metadata = await metadataManager.loadMetadata(testDir, "test-spec");
      
      assert.strictEqual(typeof metadata, "object");
      assert.strictEqual(typeof metadata.artifacts, "object");
      assert.strictEqual(Object.keys(metadata.artifacts).length, 0);
      assert.ok(metadata.lastUpdated);
    });

    it("should load existing metadata from file", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      
      const testMetadata = {
        artifacts: {
          "artifact-1": {
            artifactId: "artifact-1",
            artifactType: "requirement",
            artifactName: "Test Requirement",
            specName: "test-spec",
            versionNumber: 1,
            contentHash: "abc123",
            lastSyncTimestamp: "2026-01-01T00:00:00Z",
          },
        },
        lastUpdated: "2026-01-01T00:00:00Z",
      };
      
      await fs.writeFile(
        join(specDir, ".metadata.json"),
        JSON.stringify(testMetadata, null, 2)
      );
      
      const metadata = await metadataManager.loadMetadata(testDir, "test-spec");
      
      assert.strictEqual(Object.keys(metadata.artifacts).length, 1);
      assert.ok(metadata.artifacts["artifact-1"]);
      assert.strictEqual(metadata.artifacts["artifact-1"].artifactName, "Test Requirement");
    });

    it("should cache loaded metadata", async () => {
      const metadata1 = await metadataManager.loadMetadata(testDir, "test-spec");
      const metadata2 = await metadataManager.loadMetadata(testDir, "test-spec");
      
      // Should return the same object from cache
      assert.strictEqual(metadata1, metadata2);
    });
  });

  describe("saveMetadata", () => {
    it("should save metadata to file", async () => {
      const metadata = {
        artifacts: {
          "artifact-1": {
            artifactId: "artifact-1",
            artifactType: "requirement",
            artifactName: "Test Requirement",
            specName: "test-spec",
            versionNumber: 1,
            contentHash: "abc123",
            lastSyncTimestamp: "2026-01-01T00:00:00Z",
          },
        },
        lastUpdated: "2026-01-01T00:00:00Z",
      };
      
      await metadataManager.saveMetadata(testDir, "test-spec", metadata);
      
      const filePath = join(testDir, "test-spec", ".metadata.json");
      const fileContent = await fs.readFile(filePath, "utf-8");
      const savedMetadata = JSON.parse(fileContent);
      
      assert.strictEqual(Object.keys(savedMetadata.artifacts).length, 1);
      assert.ok(savedMetadata.artifacts["artifact-1"]);
    });

    it("should update lastUpdated timestamp", async () => {
      const metadata = {
        artifacts: {},
        lastUpdated: "2026-01-01T00:00:00Z",
      };
      
      await metadataManager.saveMetadata(testDir, "test-spec", metadata);
      
      // lastUpdated should be updated to current time
      assert.notStrictEqual(metadata.lastUpdated, "2026-01-01T00:00:00Z");
    });

    it("should create directory if it doesn't exist", async () => {
      const metadata = {
        artifacts: {},
        lastUpdated: "2026-01-01T00:00:00Z",
      };
      
      await metadataManager.saveMetadata(testDir, "new-spec", metadata);
      
      const filePath = join(testDir, "new-spec", ".metadata.json");
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      assert.ok(exists);
    });
  });

  describe("getArtifactMetadata", () => {
    it("should return null when artifact doesn't exist", async () => {
      const artifactMetadata = await metadataManager.getArtifactMetadata(
        testDir,
        "test-spec",
        "non-existent"
      );
      
      assert.strictEqual(artifactMetadata, null);
    });

    it("should return artifact metadata when it exists", async () => {
      const metadata = {
        artifacts: {
          "artifact-1": {
            artifactId: "artifact-1",
            artifactType: "requirement",
            artifactName: "Test Requirement",
            specName: "test-spec",
            versionNumber: 1,
            contentHash: "abc123",
            lastSyncTimestamp: "2026-01-01T00:00:00Z",
          },
        },
        lastUpdated: "2026-01-01T00:00:00Z",
      };
      
      await metadataManager.saveMetadata(testDir, "test-spec", metadata);
      
      const artifactMetadata = await metadataManager.getArtifactMetadata(
        testDir,
        "test-spec",
        "artifact-1"
      );
      
      assert.ok(artifactMetadata);
      assert.strictEqual(artifactMetadata.artifactName, "Test Requirement");
      assert.strictEqual(artifactMetadata.contentHash, "abc123");
    });
  });

  describe("updateArtifactMetadata", () => {
    it("should add new artifact metadata", async () => {
      const artifactMetadata = {
        artifactId: "artifact-1",
        artifactType: "requirement",
        artifactName: "Test Requirement",
        specName: "test-spec",
        versionNumber: 1,
        contentHash: "abc123",
        lastSyncTimestamp: "2026-01-01T00:00:00Z",
      };
      
      await metadataManager.updateArtifactMetadata(testDir, "test-spec", artifactMetadata);
      
      const retrieved = await metadataManager.getArtifactMetadata(
        testDir,
        "test-spec",
        "artifact-1"
      );
      
      assert.ok(retrieved);
      assert.strictEqual(retrieved.artifactName, "Test Requirement");
    });

    it("should update existing artifact metadata", async () => {
      const artifactMetadata1 = {
        artifactId: "artifact-1",
        artifactType: "requirement",
        artifactName: "Test Requirement",
        specName: "test-spec",
        versionNumber: 1,
        contentHash: "abc123",
        lastSyncTimestamp: "2026-01-01T00:00:00Z",
      };
      
      await metadataManager.updateArtifactMetadata(testDir, "test-spec", artifactMetadata1);
      
      const artifactMetadata2 = {
        ...artifactMetadata1,
        versionNumber: 2,
        contentHash: "def456",
        lastSyncTimestamp: "2026-01-02T00:00:00Z",
      };
      
      await metadataManager.updateArtifactMetadata(testDir, "test-spec", artifactMetadata2);
      
      const retrieved = await metadataManager.getArtifactMetadata(
        testDir,
        "test-spec",
        "artifact-1"
      );
      
      assert.ok(retrieved);
      assert.strictEqual(retrieved.versionNumber, 2);
      assert.strictEqual(retrieved.contentHash, "def456");
    });
  });

  describe("hasContentChanged", () => {
    it("should return true when no metadata exists", async () => {
      const changed = await metadataManager.hasContentChanged(
        testDir,
        "test-spec",
        "artifact-1",
        "test content"
      );
      
      assert.strictEqual(changed, true);
    });

    it("should return false when content hash matches", async () => {
      const content = "test content";
      
      await metadataManager.updateAfterPull(
        testDir,
        "test-spec",
        "artifact-1",
        "requirement",
        "Test Requirement",
        1,
        content
      );
      
      const changed = await metadataManager.hasContentChanged(
        testDir,
        "test-spec",
        "artifact-1",
        content
      );
      
      assert.strictEqual(changed, false);
    });

    it("should return true when content hash differs", async () => {
      await metadataManager.updateAfterPull(
        testDir,
        "test-spec",
        "artifact-1",
        "requirement",
        "Test Requirement",
        1,
        "original content"
      );
      
      const changed = await metadataManager.hasContentChanged(
        testDir,
        "test-spec",
        "artifact-1",
        "modified content"
      );
      
      assert.strictEqual(changed, true);
    });
  });

  describe("updateAfterPull", () => {
    it("should create metadata after pull", async () => {
      await metadataManager.updateAfterPull(
        testDir,
        "test-spec",
        "artifact-1",
        "requirement",
        "Test Requirement",
        1,
        "test content"
      );
      
      const metadata = await metadataManager.getArtifactMetadata(
        testDir,
        "test-spec",
        "artifact-1"
      );
      
      assert.ok(metadata);
      assert.strictEqual(metadata.artifactId, "artifact-1");
      assert.strictEqual(metadata.artifactType, "requirement");
      assert.strictEqual(metadata.artifactName, "Test Requirement");
      assert.strictEqual(metadata.versionNumber, 1);
      assert.ok(metadata.contentHash);
      assert.ok(metadata.lastSyncTimestamp);
    });

    it("should update version number on subsequent pulls", async () => {
      await metadataManager.updateAfterPull(
        testDir,
        "test-spec",
        "artifact-1",
        "requirement",
        "Test Requirement",
        1,
        "test content v1"
      );
      
      await metadataManager.updateAfterPull(
        testDir,
        "test-spec",
        "artifact-1",
        "requirement",
        "Test Requirement",
        2,
        "test content v2"
      );
      
      const metadata = await metadataManager.getArtifactMetadata(
        testDir,
        "test-spec",
        "artifact-1"
      );
      
      assert.ok(metadata);
      assert.strictEqual(metadata.versionNumber, 2);
    });
  });

  describe("clearCache", () => {
    it("should clear all cache when no parameters provided", async () => {
      await metadataManager.loadMetadata(testDir, "spec1");
      await metadataManager.loadMetadata(testDir, "spec2");
      
      metadataManager.clearCache();
      
      // After clearing cache, loading should read from disk again
      const metadata = await metadataManager.loadMetadata(testDir, "spec1");
      assert.ok(metadata);
    });

    it("should clear cache for specific spec", async () => {
      await metadataManager.loadMetadata(testDir, "spec1");
      await metadataManager.loadMetadata(testDir, "spec2");
      
      metadataManager.clearCache(testDir, "spec1");
      
      // spec1 cache should be cleared, but spec2 should still be cached
      const metadata = await metadataManager.loadMetadata(testDir, "spec1");
      assert.ok(metadata);
    });
  });
});
