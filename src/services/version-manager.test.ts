/**
 * Quikim - Version Manager Tests
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { VersionManager } from "./version-manager.js";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getQuikimProjectRoot } from "../config/project-root.js";


describe("VersionManager", () => {
  let versionManager: VersionManager;
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    versionManager = new VersionManager();
    originalCwd = getQuikimProjectRoot();

    // Create a temporary test directory
    testDir = join(tmpdir(), `version-manager-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, ".quikim", "artifacts", "test-spec"), { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original directory
    process.chdir(originalCwd);

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    versionManager.clearCache();
  });

  describe("shouldCreateNewVersion", () => {
    it("should return false when both contents are empty", () => {
      const result = versionManager.shouldCreateNewVersion("", "");
      assert.strictEqual(result, false);
    });

    it("should return true when current content is empty but server has content", () => {
      const result = versionManager.shouldCreateNewVersion("", "some content");
      assert.strictEqual(result, true);
    });

    it("should return true when server content is empty but current has content", () => {
      const result = versionManager.shouldCreateNewVersion("some content", "");
      assert.strictEqual(result, true);
    });

    it("should return false when normalized contents are identical", () => {
      const current = "Hello World";
      const server = "hello world"; // Different case
      const result = versionManager.shouldCreateNewVersion(current, server);
      assert.strictEqual(result, false);
    });

    it("should return false when contents differ only in whitespace", () => {
      const current = "Hello    World";
      const server = "Hello World";
      const result = versionManager.shouldCreateNewVersion(current, server);
      assert.strictEqual(result, false);
    });

    it("should return false when contents differ only in HTML tags", () => {
      const current = "<p>Hello World</p>";
      const server = "Hello World";
      const result = versionManager.shouldCreateNewVersion(current, server);
      assert.strictEqual(result, false);
    });

    it("should return true when normalized contents are different", () => {
      const current = "Hello World";
      const server = "Goodbye World";
      const result = versionManager.shouldCreateNewVersion(current, server);
      assert.strictEqual(result, true);
    });

    it("should handle complex HTML content", () => {
      const current = "<div><h1>Title</h1><p>Content</p></div>";
      const server = "<h1>Title</h1><p>Content</p>";
      const result = versionManager.shouldCreateNewVersion(current, server);
      assert.strictEqual(result, false); // Same after normalization
    });
  });

  describe("createVersion", () => {
    it("should create version metadata with correct properties", async () => {
      const artifactId = "artifact-123";
      const specName = "test-spec";
      const content = "Test content";
      const versionNumber = 1;

      const version = await versionManager.createVersion(
        artifactId,
        specName,
        content,
        versionNumber
      );

      assert.strictEqual(version.artifactId, artifactId);
      assert.strictEqual(version.versionNumber, versionNumber);
      assert.ok(version.contentHash);
      assert.ok(version.lastSyncTimestamp);
    });

    it("should persist metadata to disk", async () => {
      const artifactId = "artifact-456";
      const specName = "test-spec";
      const content = "Test content";
      const versionNumber = 2;

      await versionManager.createVersion(artifactId, specName, content, versionNumber);

      // Read metadata file directly
      const metadataPath = join(testDir, ".quikim", "artifacts", specName, ".metadata.json");
      const data = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(data);

      assert.ok(metadata.artifacts[artifactId]);
      assert.strictEqual(metadata.artifacts[artifactId].versionNumber, versionNumber);
    });

    it("should update existing artifact metadata", async () => {
      const artifactId = "artifact-789";
      const specName = "test-spec";

      // Create first version
      await versionManager.createVersion(artifactId, specName, "Content v1", 1);

      // Create second version
      const version2 = await versionManager.createVersion(
        artifactId,
        specName,
        "Content v2",
        2
      );

      assert.strictEqual(version2.versionNumber, 2);

      // Verify only latest version is stored
      const latest = await versionManager.getLatestVersion(artifactId, specName);
      assert.strictEqual(latest?.versionNumber, 2);
    });
  });

  describe("getLatestVersion", () => {
    it("should return null when no metadata exists", async () => {
      const result = await versionManager.getLatestVersion("nonexistent", "test-spec");
      assert.strictEqual(result, null);
    });

    it("should return latest version metadata when it exists", async () => {
      const artifactId = "artifact-abc";
      const specName = "test-spec";
      const content = "Test content";
      const versionNumber = 3;

      await versionManager.createVersion(artifactId, specName, content, versionNumber);

      const latest = await versionManager.getLatestVersion(artifactId, specName);

      assert.ok(latest);
      assert.strictEqual(latest?.artifactId, artifactId);
      assert.strictEqual(latest?.versionNumber, versionNumber);
    });
  });

  describe("hasContentChanged", () => {
    it("should return true when no metadata exists", async () => {
      const result = await versionManager.hasContentChanged(
        "new-artifact",
        "test-spec",
        "content"
      );
      assert.strictEqual(result, true);
    });

    it("should return false when content hash matches", async () => {
      const artifactId = "artifact-def";
      const specName = "test-spec";
      const content = "Test content";

      await versionManager.createVersion(artifactId, specName, content, 1);

      const result = await versionManager.hasContentChanged(artifactId, specName, content);
      assert.strictEqual(result, false);
    });

    it("should return true when content hash differs", async () => {
      const artifactId = "artifact-ghi";
      const specName = "test-spec";
      const originalContent = "Original content";
      const newContent = "Modified content";

      await versionManager.createVersion(artifactId, specName, originalContent, 1);

      const result = await versionManager.hasContentChanged(artifactId, specName, newContent);
      assert.strictEqual(result, true);
    });

    it("should return false when content differs only in formatting", async () => {
      const artifactId = "artifact-jkl";
      const specName = "test-spec";
      const originalContent = "Hello World";
      const newContent = "<p>Hello    World</p>"; // Same after normalization

      await versionManager.createVersion(artifactId, specName, originalContent, 1);

      const result = await versionManager.hasContentChanged(artifactId, specName, newContent);
      assert.strictEqual(result, false);
    });
  });

  describe("metadata storage", () => {
    it("should create metadata directory if it doesn't exist", async () => {
      const specName = "new-spec";
      const artifactId = "artifact-001";

      await versionManager.createVersion(artifactId, specName, "content", 1);

      const metadataPath = join(testDir, ".quikim", "artifacts", specName, ".metadata.json");
      const exists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);

      assert.strictEqual(exists, true);
    });

    it("should store multiple artifacts in same spec", async () => {
      const specName = "multi-spec";

      await versionManager.createVersion("artifact-1", specName, "content 1", 1);
      await versionManager.createVersion("artifact-2", specName, "content 2", 1);
      await versionManager.createVersion("artifact-3", specName, "content 3", 1);

      const allMetadata = await versionManager.getAllArtifactMetadata(specName);

      assert.strictEqual(Object.keys(allMetadata).length, 3);
      assert.ok(allMetadata["artifact-1"]);
      assert.ok(allMetadata["artifact-2"]);
      assert.ok(allMetadata["artifact-3"]);
    });

    it("should update lastUpdated timestamp on save", async () => {
      const specName = "timestamp-spec";
      const artifactId = "artifact-time";

      await versionManager.createVersion(artifactId, specName, "content", 1);

      const metadataPath = join(testDir, ".quikim", "artifacts", specName, ".metadata.json");
      const data = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(data);

      assert.ok(metadata.lastUpdated);
      const timestamp = new Date(metadata.lastUpdated);
      assert.ok(timestamp.getTime() > Date.now() - 5000); // Within last 5 seconds
    });
  });

  describe("deleteArtifactMetadata", () => {
    it("should remove artifact metadata from spec", async () => {
      const specName = "delete-spec";
      const artifactId = "artifact-delete";

      await versionManager.createVersion(artifactId, specName, "content", 1);

      let metadata = await versionManager.getAllArtifactMetadata(specName);
      assert.ok(metadata[artifactId]);

      await versionManager.deleteArtifactMetadata(specName, artifactId);

      metadata = await versionManager.getAllArtifactMetadata(specName);
      assert.strictEqual(metadata[artifactId], undefined);
    });

    it("should not affect other artifacts in same spec", async () => {
      const specName = "delete-multi-spec";

      await versionManager.createVersion("artifact-keep", specName, "content 1", 1);
      await versionManager.createVersion("artifact-delete", specName, "content 2", 1);

      await versionManager.deleteArtifactMetadata(specName, "artifact-delete");

      const metadata = await versionManager.getAllArtifactMetadata(specName);
      assert.ok(metadata["artifact-keep"]);
      assert.strictEqual(metadata["artifact-delete"], undefined);
    });
  });

  describe("cache management", () => {
    it("should cache metadata after first load", async () => {
      const specName = "cache-spec";
      const artifactId = "artifact-cache";

      await versionManager.createVersion(artifactId, specName, "content", 1);

      // First access loads from disk
      const version1 = await versionManager.getLatestVersion(artifactId, specName);

      // Second access should use cache
      const version2 = await versionManager.getLatestVersion(artifactId, specName);

      assert.deepStrictEqual(version1, version2);
    });

    it("should clear cache when clearCache is called", async () => {
      const specName = "clear-cache-spec";
      const artifactId = "artifact-clear";

      await versionManager.createVersion(artifactId, specName, "content", 1);
      await versionManager.getLatestVersion(artifactId, specName);

      versionManager.clearCache();

      // Should still be able to load from disk
      const version = await versionManager.getLatestVersion(artifactId, specName);
      assert.ok(version);
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", async () => {
      const artifactId = "artifact-empty";
      const specName = "test-spec";

      const version = await versionManager.createVersion(artifactId, specName, "", 1);

      assert.ok(version.contentHash);
      assert.ok(version.contentHash.length > 0);
    });

    it("should handle very long content", async () => {
      const artifactId = "artifact-long";
      const specName = "test-spec";
      const longContent = "x".repeat(100000); // 100KB of content

      const version = await versionManager.createVersion(artifactId, specName, longContent, 1);

      assert.ok(version.contentHash);
    });

    it("should handle special characters in content", async () => {
      const artifactId = "artifact-special";
      const specName = "test-spec";
      const specialContent = "Content with émojis 🎉 and spëcial çhars!";

      const version = await versionManager.createVersion(
        artifactId,
        specName,
        specialContent,
        1
      );

      assert.ok(version.contentHash);

      const retrieved = await versionManager.getLatestVersion(artifactId, specName);
      assert.strictEqual(retrieved?.contentHash, version.contentHash);
    });

    it("should handle corrupted metadata file gracefully", async () => {
      const specName = "corrupted-spec";
      const metadataPath = join(testDir, ".quikim", "artifacts", specName, ".metadata.json");

      // Create corrupted metadata file
      await fs.mkdir(join(testDir, ".quikim", "artifacts", specName), { recursive: true });
      await fs.writeFile(metadataPath, "{ invalid json", "utf-8");

      // Should return null instead of throwing
      const result = await versionManager.getLatestVersion("any-artifact", specName);
      assert.strictEqual(result, null);
    });
  });
});
