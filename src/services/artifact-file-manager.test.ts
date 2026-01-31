/**
 * Quikim - Artifact File Manager Tests
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
import { ArtifactFileManager } from "./artifact-file-manager.js";
import { ArtifactType } from "../types/artifacts.js";

describe("ArtifactFileManager", () => {
  let fileManager: ArtifactFileManager;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(process.cwd(), ".test-artifacts-" + Date.now());
    
    // Pass test directory to file manager
    fileManager = new ArtifactFileManager(testDir);
    
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("writeArtifactFile", () => {
    it("should write artifact file with atomic write", async () => {
      const artifact = {
        specName: "test-spec",
        artifactType: "requirement" as ArtifactType,
        artifactName: "test-requirement",
        content: "# Test Requirement\n\nThis is a test.",
        artifactId: "abc123",
      };

      await fileManager.writeArtifactFile(artifact);

      const filePath = join(testDir, "test-spec", "requirement_abc123.md");
      const content = await fs.readFile(filePath, "utf-8");
      
      assert.strictEqual(content, artifact.content);
    });

    it("should create backup before overwriting existing file", async () => {
      const artifact = {
        specName: "test-spec",
        artifactType: "requirement" as ArtifactType,
        artifactName: "test-requirement",
        content: "# Original Content",
        artifactId: "abc123",
      };

      // Write initial file
      await fileManager.writeArtifactFile(artifact);

      // Overwrite with new content
      artifact.content = "# Updated Content";
      await fileManager.writeArtifactFile(artifact);

      // Check backup was created
      const backupDir = join(testDir, "test-spec", ".backups");
      const backupFiles = await fs.readdir(backupDir);
      
      assert.ok(backupFiles.length > 0, "Backup should be created");
      assert.match(backupFiles[0], /requirement_abc123\.md\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it("should use artifactName when artifactId is not provided", async () => {
      const artifact = {
        specName: "test-spec",
        artifactType: "requirement" as ArtifactType,
        artifactName: "test-requirement",
        content: "# Test Content",
      };

      await fileManager.writeArtifactFile(artifact);

      const filePath = join(testDir, "test-spec", "requirement_test-requirement.md");
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      assert.strictEqual(exists, true);
    });

    it("should throw error for invalid file path with directory traversal", async () => {
      const artifact = {
        specName: "../../../etc",
        artifactType: "requirement" as ArtifactType,
        artifactName: "passwd",
        content: "malicious content",
        artifactId: "hack",
      };

      await assert.rejects(
        async () => fileManager.writeArtifactFile(artifact),
        /outside artifacts directory/
      );
    });
  });

  describe("renameArtifactFile", () => {
    it("should rename file successfully", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      
      const oldPath = join(specDir, "requirement_old-name.md");
      const newPath = join(specDir, "requirement_new-id.md");
      
      await fs.writeFile(oldPath, "# Test Content", "utf-8");

      await fileManager.renameArtifactFile(oldPath, newPath);

      const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
      const newExists = await fs.access(newPath).then(() => true).catch(() => false);
      
      assert.strictEqual(oldExists, false);
      assert.strictEqual(newExists, true);
    });

    it("should throw error if source file does not exist", async () => {
      const oldPath = join(testDir, "test-spec", "nonexistent.md");
      const newPath = join(testDir, "test-spec", "new.md");

      await assert.rejects(
        async () => fileManager.renameArtifactFile(oldPath, newPath),
        /Source file does not exist/
      );
    });

    it("should create backup if target file already exists", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      
      const oldPath = join(specDir, "requirement_old.md");
      const newPath = join(specDir, "requirement_new.md");
      
      await fs.writeFile(oldPath, "# Old Content", "utf-8");
      await fs.writeFile(newPath, "# Existing Content", "utf-8");

      await fileManager.renameArtifactFile(oldPath, newPath);

      const backupDir = join(specDir, ".backups");
      const backupFiles = await fs.readdir(backupDir);
      
      assert.ok(backupFiles.length > 0, "Backup should be created");
    });

    it("should validate file paths to prevent directory traversal", async () => {
      const oldPath = join(testDir, "test-spec", "test.md");
      const newPath = "../../../etc/passwd";

      await assert.rejects(
        async () => fileManager.renameArtifactFile(oldPath, newPath),
        /Invalid file path/
      );
    });
  });

  describe("generateFilename", () => {
    it("should generate filename with artifact type and ID", () => {
      const filename = fileManager.generateFilename("requirement", "abc123");
      assert.strictEqual(filename, "requirement_abc123.md");
    });

    it("should generate filename for different artifact types", () => {
      const types: ArtifactType[] = [
        "requirement",
        "context",
        "code_guideline",
        "lld",
        "hld",
        "wireframe_files",
        "flow_diagram",
        "tasks",
      ];

      types.forEach((type) => {
        const filename = fileManager.generateFilename(type, "test-id");
        assert.strictEqual(filename, `${type}_test-id.md`);
      });
    });

    it("should sanitize artifact ID to prevent path traversal", () => {
      const filename = fileManager.generateFilename("requirement", "../../../etc/passwd");
      // The exact number of underscores depends on how many characters are replaced
      assert.match(filename, /^requirement_+etc_passwd\.md$/);
    });

    it("should throw error if artifactType is missing", () => {
      assert.throws(
        () => fileManager.generateFilename("" as ArtifactType, "test-id"),
        /artifactType and id are required/
      );
    });

    it("should throw error if artifactId is missing", () => {
      assert.throws(
        () => fileManager.generateFilename("requirement", ""),
        /artifactType and id are required/
      );
    });
  });

  describe("extractArtifactIdFromFilename", () => {
    it("should extract artifact ID from valid filename", () => {
      const id = fileManager.extractArtifactIdFromFilename("requirement_abc123.md");
      assert.strictEqual(id, "abc123");
    });

    it("should extract artifact ID from name-based filename", () => {
      const id = fileManager.extractArtifactIdFromFilename("requirement_user-login.md");
      assert.strictEqual(id, "user-login");
    });

    it("should handle flow_diagram type", () => {
      const id = fileManager.extractArtifactIdFromFilename("flow_diagram_xyz789.md");
      assert.strictEqual(id, "xyz789");
    });

    it("should handle flow alias for flow_diagram", () => {
      const id = fileManager.extractArtifactIdFromFilename("flow_xyz789.md");
      assert.strictEqual(id, "xyz789");
    });

    it("should return null for invalid filename format", () => {
      const id = fileManager.extractArtifactIdFromFilename("invalid-filename.md");
      assert.strictEqual(id, null);
    });

    it("should return null for filename without .md extension", () => {
      const id = fileManager.extractArtifactIdFromFilename("requirement_abc123.txt");
      assert.strictEqual(id, null);
    });

    it("should return null for invalid artifact type", () => {
      const id = fileManager.extractArtifactIdFromFilename("invalid_type_abc123.md");
      assert.strictEqual(id, null);
    });

    it("should handle all valid artifact types", () => {
      const types = [
        "requirement",
        "context",
        "code_guideline",
        "lld",
        "hld",
        "wireframe_files",
        "flow_diagram",
        "tasks",
      ];

      types.forEach((type) => {
        const id = fileManager.extractArtifactIdFromFilename(`${type}_test-id.md`);
        assert.strictEqual(id, "test-id");
      });
    });
  });

  describe("scanLocalArtifacts", () => {
    it("should scan and return local artifacts", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      
      await fs.writeFile(
        join(specDir, "requirement_test1.md"),
        "# Requirement 1",
        "utf-8"
      );
      await fs.writeFile(
        join(specDir, "context_test2.md"),
        "# Context 1",
        "utf-8"
      );

      const artifacts = await fileManager.scanLocalArtifacts({});
      
      assert.strictEqual(artifacts.length, 2);
      assert.strictEqual(artifacts[0].specName, "test-spec");
      assert.match(artifacts[0].artifactType, /requirement|context/);
    });

    it("should filter artifacts by spec name", async () => {
      const spec1Dir = join(testDir, "spec1");
      const spec2Dir = join(testDir, "spec2");
      
      await fs.mkdir(spec1Dir, { recursive: true });
      await fs.mkdir(spec2Dir, { recursive: true });
      
      await fs.writeFile(join(spec1Dir, "requirement_test1.md"), "# Test 1", "utf-8");
      await fs.writeFile(join(spec2Dir, "requirement_test2.md"), "# Test 2", "utf-8");

      const artifacts = await fileManager.scanLocalArtifacts({ specName: "spec1" });
      
      assert.strictEqual(artifacts.length, 1);
      assert.strictEqual(artifacts[0].specName, "spec1");
    });

    it("should filter artifacts by artifact type", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      
      await fs.writeFile(join(specDir, "requirement_test1.md"), "# Req", "utf-8");
      await fs.writeFile(join(specDir, "context_test2.md"), "# Context", "utf-8");

      const artifacts = await fileManager.scanLocalArtifacts({
        artifactType: "requirement",
      });
      
      assert.strictEqual(artifacts.length, 1);
      assert.strictEqual(artifacts[0].artifactType, "requirement");
    });

    it("should return empty array if directory does not exist", async () => {
      const artifacts = await fileManager.scanLocalArtifacts({
        specName: "nonexistent-spec",
      });
      
      assert.deepStrictEqual(artifacts, []);
    });
  });

  describe("artifactExists", () => {
    it("should return true if artifact file exists", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(join(specDir, "requirement_test.md"), "# Test", "utf-8");

      const exists = await fileManager.artifactExists({
        specName: "test-spec",
        artifactType: "requirement",
        artifactName: "test",
        content: "",
      });
      
      assert.strictEqual(exists, true);
    });

    it("should return false if artifact file does not exist", async () => {
      const exists = await fileManager.artifactExists({
        specName: "test-spec",
        artifactType: "requirement",
        artifactName: "nonexistent",
        content: "",
      });
      
      assert.strictEqual(exists, false);
    });
  });

  describe("readArtifactFile", () => {
    it("should read artifact file content", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      
      const content = "# Test Requirement\n\nThis is a test.";
      await fs.writeFile(join(specDir, "requirement_test.md"), content, "utf-8");

      const result = await fileManager.readArtifactFile(
        "test-spec",
        "requirement",
        "test"
      );
      
      assert.strictEqual(result, content);
    });

    it("should return null if file does not exist", async () => {
      const result = await fileManager.readArtifactFile(
        "test-spec",
        "requirement",
        "nonexistent"
      );
      
      assert.strictEqual(result, null);
    });
  });

  describe("backup management", () => {
    it("should keep only last 5 backups", async () => {
      const artifact = {
        specName: "test-spec",
        artifactType: "requirement" as ArtifactType,
        artifactName: "test",
        content: "# Test",
        artifactId: "abc123",
      };

      // Write file 7 times to create 6 backups
      for (let i = 0; i < 7; i++) {
        artifact.content = `# Test ${i}`;
        await fileManager.writeArtifactFile(artifact);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const backupDir = join(testDir, "test-spec", ".backups");
      const backupFiles = await fs.readdir(backupDir);
      
      // Should have max 5 backups
      assert.ok(backupFiles.length <= 5, `Expected <= 5 backups, got ${backupFiles.length}`);
    });
  });
});
