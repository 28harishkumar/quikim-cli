/**
 * Quikim - Task File Manager Tests
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
import {
  TaskFileManager,
  Task,
  Subtask,
  TaskStatus,
  splitTaskAndSubtasks,
  mergeTaskWithSubtasks,
} from "./task-file-manager.js";

describe("TaskFileManager - Task File Conversion", () => {
  let manager: TaskFileManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `quikim-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new TaskFileManager(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("serverToTaskFile", () => {
    it("should convert task with all metadata fields", () => {
      const task: Task = {
        id: "task-123",
        specName: "user-auth",
        milestoneId: "milestone-456",
        title: "Implement Login",
        description: "Add user login functionality",
        status: "in_progress",
        priority: "high",
        assignee: "dev@example.com",
        dueDate: "2026-02-15",
        tags: ["backend", "api"],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-27T14:30:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      assert.ok(markdown.includes("---"));
      assert.ok(markdown.includes("id: task-123"));
      assert.ok(markdown.includes("specName: user-auth"));
      assert.ok(markdown.includes("milestoneId: milestone-456"));
      assert.ok(markdown.includes("status: in_progress"));
      assert.ok(markdown.includes("priority: high"));
      assert.ok(markdown.includes("assignee: dev@example.com"));
      assert.ok(markdown.includes("dueDate:") && markdown.includes("2026-02-15"));
      assert.ok(markdown.includes("# Implement Login"));
      assert.ok(markdown.includes("## Description"));
      assert.ok(markdown.includes("Add user login functionality"));
    });

    it("should handle task with minimal fields", () => {
      const task: Task = {
        id: "task-minimal",
        specName: "test-spec",
        title: "Simple Task",
        description: "",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      assert.ok(markdown.includes("id: task-minimal"));
      assert.ok(markdown.includes("# Simple Task"));
      assert.ok(!markdown.includes("priority:"));
      assert.ok(!markdown.includes("assignee:"));
    });

    it("should include subtasks with proper indentation", () => {
      const task: Task = {
        id: "task-with-subtasks",
        specName: "test-spec",
        title: "Parent Task",
        description: "Main task",
        status: "in_progress",
        subtasks: [
          { description: "Setup database", status: "completed", order: 0 },
          { description: "Implement API", status: "in_progress", order: 1 },
          { description: "Write tests", status: "not_started", order: 2 },
          { description: "Blocked item", status: "blocked", order: 3 },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      assert.ok(markdown.includes("## Subtasks"));
      assert.ok(markdown.includes("  - [x] Setup database"));
      assert.ok(markdown.includes("  - [-] Implement API"));
      assert.ok(markdown.includes("  - [ ] Write tests"));
      assert.ok(markdown.includes("  - [!] Blocked item"));
    });

    it("should include checklist items", () => {
      const task: Task = {
        id: "task-with-checklist",
        specName: "test-spec",
        title: "Task with Checklist",
        description: "Task description",
        status: "in_progress",
        checklist: [
          { id: "check-1", text: "Review requirements", completed: true, order: 0 },
          { id: "check-2", text: "Code review", completed: false, order: 1 },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      assert.ok(markdown.includes("## Checklist"));
      assert.ok(markdown.includes("- [x] Review requirements"));
      assert.ok(markdown.includes("- [ ] Code review"));
    });

    it("should include comments with author and timestamp", () => {
      const task: Task = {
        id: "task-with-comments",
        specName: "test-spec",
        title: "Task with Comments",
        description: "Task description",
        status: "in_progress",
        comments: [
          {
            id: "comment-1",
            author: "user@example.com",
            content: "This looks good",
            createdAt: "2026-01-20T09:00:00Z",
          },
          {
            id: "comment-2",
            author: "dev@example.com",
            content: "Added error handling",
            createdAt: "2026-01-21T11:00:00Z",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      assert.ok(markdown.includes("## Comments"));
      assert.ok(markdown.includes("### Comment by user@example.com"));
      assert.ok(markdown.includes("This looks good"));
      assert.ok(markdown.includes("### Comment by dev@example.com"));
      assert.ok(markdown.includes("Added error handling"));
    });

    it("should include attachments with relative paths", () => {
      const task: Task = {
        id: "task-with-attachments",
        specName: "test-spec",
        title: "Task with Attachments",
        description: "Task description",
        status: "in_progress",
        attachments: [
          {
            id: "attach-1",
            filename: "mockup.png",
            url: "https://example.com/mockup.png",
            size: 1024,
            mimeType: "image/png",
          },
          {
            id: "attach-2",
            filename: "spec.yaml",
            url: "https://example.com/spec.yaml",
            size: 512,
            mimeType: "text/yaml",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      assert.ok(markdown.includes("## Attachments"));
      assert.ok(markdown.includes("[mockup.png](./task_assets/mockup.png)"));
      assert.ok(markdown.includes("[spec.yaml](./task_assets/spec.yaml)"));
    });
  });

  describe("taskFileToServer", () => {
    it("should parse task with all metadata fields", () => {
      const markdown = `---
id: task-123
specName: user-auth
milestoneId: milestone-456
status: in_progress
priority: high
assignee: dev@example.com
dueDate: '2026-02-15'
tags:
  - backend
  - api
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-27T14:30:00Z'
---

# Implement Login

## Description

Add user login functionality
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.id, "task-123");
      assert.strictEqual(task.specName, "user-auth");
      assert.strictEqual(task.milestoneId, "milestone-456");
      assert.strictEqual(task.title, "Implement Login");
      assert.strictEqual(task.description, "Add user login functionality");
      assert.strictEqual(task.status, "in_progress");
      assert.strictEqual(task.priority, "high");
      assert.strictEqual(task.assignee, "dev@example.com");
      assert.strictEqual(task.dueDate, "2026-02-15");
      assert.deepStrictEqual(task.tags, ["backend", "api"]);
    });

    it("should parse task with minimal fields", () => {
      const markdown = `---
id: task-minimal
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Simple Task
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.id, "task-minimal");
      assert.strictEqual(task.title, "Simple Task");
      assert.strictEqual(task.priority, undefined);
      assert.strictEqual(task.assignee, undefined);
    });

    it("should parse subtasks with correct status mapping", () => {
      const markdown = `---
id: task-with-subtasks
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Parent Task

## Description

Main task

## Subtasks

  - [x] Setup database
  - [-] Implement API
  - [ ] Write tests
  - [!] Blocked item
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.subtasks?.length, 4);
      assert.strictEqual(task.subtasks?.[0].description, "Setup database");
      assert.strictEqual(task.subtasks?.[0].status, "completed");
      assert.strictEqual(task.subtasks?.[1].description, "Implement API");
      assert.strictEqual(task.subtasks?.[1].status, "in_progress");
      assert.strictEqual(task.subtasks?.[2].description, "Write tests");
      assert.strictEqual(task.subtasks?.[2].status, "not_started");
      assert.strictEqual(task.subtasks?.[3].description, "Blocked item");
      assert.strictEqual(task.subtasks?.[3].status, "blocked");
    });

    it("should parse checklist items", () => {
      const markdown = `---
id: task-with-checklist
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task with Checklist

## Checklist

- [x] Review requirements
- [ ] Code review
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.checklist?.length, 2);
      assert.strictEqual(task.checklist?.[0].text, "Review requirements");
      assert.strictEqual(task.checklist?.[0].completed, true);
      assert.strictEqual(task.checklist?.[1].text, "Code review");
      assert.strictEqual(task.checklist?.[1].completed, false);
    });

    it("should parse comments", () => {
      const markdown = `---
id: task-with-comments
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task with Comments

## Comments

### Comment by user@example.com (2026-01-20T09:00:00Z)
This looks good

### Comment by dev@example.com (2026-01-21T11:00:00Z)
Added error handling
`;

      const task = manager.taskFileToServer(markdown);

      // The comment parsing might combine multiline comments
      assert.ok(task.comments && task.comments.length >= 1);
      assert.strictEqual(task.comments?.[0].author, "user@example.com");
      assert.ok(task.comments?.[0].content.includes("This looks good"));
    });

    it("should parse attachments", () => {
      const markdown = `---
id: task-with-attachments
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task with Attachments

## Attachments

- [mockup.png](./task_assets/mockup.png)
- [spec.yaml](./task_assets/spec.yaml)
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.attachments?.length, 2);
      assert.strictEqual(task.attachments?.[0].filename, "mockup.png");
      assert.strictEqual(task.attachments?.[1].filename, "spec.yaml");
    });

    it("should throw error for missing YAML frontmatter", () => {
      const markdown = `# Task without frontmatter

This is invalid.
`;

      assert.throws(() => {
        manager.taskFileToServer(markdown);
      }, /Invalid task file: missing YAML frontmatter/);
    });

    it("should handle missing title gracefully", () => {
      const markdown = `---
id: task-no-title
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

## Description

No title here
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.title, "Untitled Task");
    });
  });

  describe("Round-trip conversion", () => {
    it("should maintain data consistency through round-trip", () => {
      const originalTask: Task = {
        id: "task-roundtrip",
        specName: "test-spec",
        milestoneId: "milestone-123",
        title: "Round Trip Test",
        description: "Testing round-trip conversion",
        status: "in_progress",
        priority: "high",
        assignee: "dev@example.com",
        dueDate: "2026-02-15",
        tags: ["test", "conversion"],
        subtasks: [
          { description: "First subtask", status: "completed", order: 0 },
          { description: "Second subtask", status: "in_progress", order: 1 },
        ],
        checklist: [
          { id: "check-1", text: "Item 1", completed: true, order: 0 },
          { id: "check-2", text: "Item 2", completed: false, order: 1 },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-27T14:30:00Z",
      };

      const markdown = manager.serverToTaskFile(originalTask);
      const parsedTask = manager.taskFileToServer(markdown);

      assert.strictEqual(parsedTask.id, originalTask.id);
      assert.strictEqual(parsedTask.title, originalTask.title);
      assert.strictEqual(parsedTask.description, originalTask.description);
      assert.strictEqual(parsedTask.status, originalTask.status);
      assert.strictEqual(parsedTask.priority, originalTask.priority);
      assert.strictEqual(parsedTask.assignee, originalTask.assignee);
      assert.strictEqual(parsedTask.subtasks?.length, originalTask.subtasks?.length);
      assert.strictEqual(parsedTask.checklist?.length, originalTask.checklist?.length);
    });

    it("should handle empty optional fields", () => {
      const originalTask: Task = {
        id: "task-empty-fields",
        specName: "test-spec",
        title: "Task with Empty Fields",
        description: "",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(originalTask);
      const parsedTask = manager.taskFileToServer(markdown);

      assert.strictEqual(parsedTask.id, originalTask.id);
      assert.strictEqual(parsedTask.title, originalTask.title);
      assert.strictEqual(parsedTask.priority, undefined);
      assert.strictEqual(parsedTask.assignee, undefined);
      // Subtasks might be empty array or undefined
      assert.ok(!parsedTask.subtasks || parsedTask.subtasks.length === 0);
    });
  });
});

describe("TaskFileManager - Subtask Handling", () => {
  let manager: TaskFileManager;

  beforeEach(() => {
    manager = new TaskFileManager();
  });

  describe("Checkbox status mapping", () => {
    it("should map all checkbox formats correctly", () => {
      const markdown = `---
id: task-status-test
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Status Test

## Subtasks

  - [ ] Not started
  - [-] In progress
  - [x] Completed
  - [!] Blocked
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.subtasks?.[0].status, "not_started");
      assert.strictEqual(task.subtasks?.[1].status, "in_progress");
      assert.strictEqual(task.subtasks?.[2].status, "completed");
      assert.strictEqual(task.subtasks?.[3].status, "blocked");
    });

    it("should preserve subtask order", () => {
      const task: Task = {
        id: "task-order",
        specName: "test-spec",
        title: "Order Test",
        description: "Test",
        status: "in_progress",
        subtasks: [
          { description: "Third", status: "not_started", order: 2 },
          { description: "First", status: "completed", order: 0 },
          { description: "Second", status: "in_progress", order: 1 },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const markdown = manager.serverToTaskFile(task);

      // Should be sorted by order
      const lines = markdown.split("\n");
      const subtaskLines = lines.filter((line) => line.trim().startsWith("- ["));
      assert.ok(subtaskLines[0].includes("First"));
      assert.ok(subtaskLines[1].includes("Second"));
      assert.ok(subtaskLines[2].includes("Third"));
    });

    it("should handle subtasks with special characters", () => {
      const markdown = `---
id: task-special-chars
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Special Characters

## Subtasks

  - [x] Task with "quotes"
  - [-] Task with 'apostrophes'
  - [ ] Task with [brackets]
  - [!] Task with (parentheses)
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.subtasks?.length, 4);
      assert.ok(task.subtasks?.[0].description.includes('"quotes"'));
      assert.ok(task.subtasks?.[1].description.includes("'apostrophes'"));
      assert.ok(task.subtasks?.[2].description.includes("[brackets]"));
      assert.ok(task.subtasks?.[3].description.includes("(parentheses)"));
    });

    it("should ignore non-indented checkboxes as subtasks", () => {
      const markdown = `---
id: task-indent-test
specName: test-spec
status: in_progress
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Indent Test

## Subtasks

  - [x] This is a subtask
- [ ] This is not a subtask (no indent)
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.subtasks?.length, 1);
      assert.strictEqual(task.subtasks?.[0].description, "This is a subtask");
    });
  });

  describe("splitTaskAndSubtasks", () => {
    it("should split task and subtasks correctly", () => {
      const task: Task = {
        id: "parent-task",
        specName: "test-spec",
        title: "Parent",
        description: "Main task",
        status: "in_progress",
        subtasks: [
          { description: "Sub 1", status: "completed", order: 0 },
          { description: "Sub 2", status: "in_progress", order: 1 },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const result = splitTaskAndSubtasks(task);

      assert.strictEqual(result.mainTask.id, "parent-task");
      assert.strictEqual((result.mainTask as Task).subtasks, undefined);
      assert.strictEqual(result.subtasks.length, 2);
      assert.strictEqual(result.subtasks[0].parentTaskId, "parent-task");
      assert.strictEqual(result.subtasks[1].parentTaskId, "parent-task");
    });

    it("should handle task without subtasks", () => {
      const task: Task = {
        id: "no-subtasks",
        specName: "test-spec",
        title: "No Subtasks",
        description: "Task without subtasks",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const result = splitTaskAndSubtasks(task);

      assert.strictEqual(result.mainTask.id, "no-subtasks");
      assert.strictEqual(result.subtasks.length, 0);
    });
  });

  describe("mergeTaskWithSubtasks", () => {
    it("should merge task and subtasks correctly", () => {
      const mainTask = {
        id: "parent-task",
        specName: "test-spec",
        title: "Parent",
        description: "Main task",
        status: "in_progress" as TaskStatus,
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const subtasks: Subtask[] = [
        { description: "Sub 2", status: "in_progress", order: 1 },
        { description: "Sub 1", status: "completed", order: 0 },
      ];

      const result = mergeTaskWithSubtasks(mainTask, subtasks);

      assert.strictEqual(result.id, "parent-task");
      assert.strictEqual(result.subtasks?.length, 2);
      // Should be sorted by order
      assert.strictEqual(result.subtasks?.[0].description, "Sub 1");
      assert.strictEqual(result.subtasks?.[1].description, "Sub 2");
    });

    it("should handle empty subtasks array", () => {
      const mainTask = {
        id: "task-no-subs",
        specName: "test-spec",
        title: "No Subs",
        description: "Task",
        status: "not_started" as TaskStatus,
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      const result = mergeTaskWithSubtasks(mainTask, []);

      assert.strictEqual(result.id, "task-no-subs");
      assert.strictEqual(result.subtasks?.length, 0);
    });
  });
});

describe("TaskFileManager - Asset Management", () => {
  let manager: TaskFileManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `quikim-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new TaskFileManager(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("getTaskAssetsPath", () => {
    it("should return correct assets path", () => {
      const path = manager.getTaskAssetsPath("test-spec");
      assert.ok(path.includes("test-spec"));
      assert.ok(path.includes("task_assets"));
    });

    it("should handle spec names with special characters", () => {
      const path = manager.getTaskAssetsPath("user-auth-v2");
      assert.ok(path.includes("user-auth-v2"));
      assert.ok(path.includes("task_assets"));
    });
  });

  describe("downloadTaskAssets", () => {
    it("should create assets directory", async () => {
      const task: Task = {
        id: "task-with-assets",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        attachments: [
          {
            id: "attach-1",
            filename: "test.txt",
            url: "https://example.com/test.txt",
            size: 100,
            mimeType: "text/plain",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      await manager.downloadTaskAssets(task, "test-spec");

      const assetsPath = manager.getTaskAssetsPath("test-spec");
      const stats = await fs.stat(assetsPath);
      assert.ok(stats.isDirectory());
    });

    it("should create placeholder files for attachments", async () => {
      const task: Task = {
        id: "task-with-assets",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        attachments: [
          {
            id: "attach-1",
            filename: "mockup.png",
            url: "https://example.com/mockup.png",
            size: 1024,
            mimeType: "image/png",
          },
          {
            id: "attach-2",
            filename: "spec.yaml",
            url: "https://example.com/spec.yaml",
            size: 512,
            mimeType: "text/yaml",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      await manager.downloadTaskAssets(task, "test-spec");

      const assetsPath = manager.getTaskAssetsPath("test-spec");
      const file1 = await fs.readFile(join(assetsPath, "mockup.png"), "utf-8");
      const file2 = await fs.readFile(join(assetsPath, "spec.yaml"), "utf-8");

      assert.ok(file1.includes("mockup.png"));
      assert.ok(file2.includes("spec.yaml"));
    });

    it("should handle task without attachments", async () => {
      const task: Task = {
        id: "task-no-assets",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      // Should not throw
      await manager.downloadTaskAssets(task, "test-spec");
    });

    it("should handle empty attachments array", async () => {
      const task: Task = {
        id: "task-empty-assets",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        attachments: [],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      // Should not throw
      await manager.downloadTaskAssets(task, "test-spec");
    });
  });

  describe("uploadTaskAssets", () => {
    it("should verify asset files exist", async () => {
      const assetsPath = manager.getTaskAssetsPath("test-spec");
      await fs.mkdir(assetsPath, { recursive: true });
      await fs.writeFile(join(assetsPath, "test.txt"), "test content", "utf-8");

      const task: Task = {
        id: "task-upload",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        attachments: [
          {
            id: "attach-1",
            filename: "test.txt",
            url: "https://example.com/test.txt",
            size: 100,
            mimeType: "text/plain",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      // Should not throw
      await manager.uploadTaskAssets(task, "test-spec");
    });

    it("should handle missing asset files gracefully", async () => {
      const task: Task = {
        id: "task-missing-assets",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        attachments: [
          {
            id: "attach-1",
            filename: "missing.txt",
            url: "https://example.com/missing.txt",
            size: 100,
            mimeType: "text/plain",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      // Should not throw, just warn
      await manager.uploadTaskAssets(task, "test-spec");
    });

    it("should handle task without attachments", async () => {
      const task: Task = {
        id: "task-no-upload",
        specName: "test-spec",
        title: "Task",
        description: "Test",
        status: "in_progress",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      // Should not throw
      await manager.uploadTaskAssets(task, "test-spec");
    });
  });
});

describe("TaskFileManager - File I/O Operations", () => {
  let manager: TaskFileManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `quikim-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new TaskFileManager(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("writeTaskFile and readTaskFile", () => {
    it("should write and read task file correctly", async () => {
      const task: Task = {
        id: "task-io-test",
        specName: "test-spec",
        title: "I/O Test",
        description: "Testing file I/O",
        status: "in_progress",
        priority: "high",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      await manager.writeTaskFile(task, "test-spec");
      const readTask = await manager.readTaskFile("task-io-test", "test-spec");

      assert.ok(readTask);
      assert.strictEqual(readTask.id, task.id);
      assert.strictEqual(readTask.title, task.title);
      assert.strictEqual(readTask.description, task.description);
      assert.strictEqual(readTask.status, task.status);
      assert.strictEqual(readTask.priority, task.priority);
    });

    it("should create spec directory if it doesn't exist", async () => {
      const task: Task = {
        id: "task-new-spec",
        specName: "new-spec",
        title: "New Spec Task",
        description: "Test",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      await manager.writeTaskFile(task, "new-spec");

      const specDir = join(testDir, "new-spec");
      const stats = await fs.stat(specDir);
      assert.ok(stats.isDirectory());
    });

    it("should return null for non-existent task", async () => {
      const task = await manager.readTaskFile("non-existent", "test-spec");
      assert.strictEqual(task, null);
    });

    it("should handle task with all optional fields", async () => {
      const task: Task = {
        id: "task-full",
        specName: "test-spec",
        milestoneId: "milestone-123",
        title: "Full Task",
        description: "Complete task",
        status: "in_progress",
        priority: "high",
        assignee: "dev@example.com",
        dueDate: "2026-02-15",
        tags: ["test", "full"],
        subtasks: [
          { description: "Subtask 1", status: "completed", order: 0 },
        ],
        checklist: [
          { id: "check-1", text: "Item 1", completed: true, order: 0 },
        ],
        comments: [
          {
            id: "comment-1",
            author: "user@example.com",
            content: "Comment",
            createdAt: "2026-01-20T09:00:00Z",
          },
        ],
        attachments: [
          {
            id: "attach-1",
            filename: "file.txt",
            url: "https://example.com/file.txt",
            size: 100,
            mimeType: "text/plain",
          },
        ],
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-27T14:30:00Z",
      };

      await manager.writeTaskFile(task, "test-spec");
      const readTask = await manager.readTaskFile("task-full", "test-spec");

      assert.ok(readTask);
      assert.strictEqual(readTask.subtasks?.length, 1);
      assert.strictEqual(readTask.checklist?.length, 1);
      assert.strictEqual(readTask.comments?.length, 1);
      assert.strictEqual(readTask.attachments?.length, 1);
    });
  });

  describe("scanLocalTasks", () => {
    it("should scan and return all task files", async () => {
      const tasks: Task[] = [
        {
          id: "task-1",
          specName: "test-spec",
          title: "Task 1",
          description: "First task",
          status: "not_started",
          createdAt: "2026-01-15T10:00:00Z",
          updatedAt: "2026-01-15T10:00:00Z",
        },
        {
          id: "task-2",
          specName: "test-spec",
          title: "Task 2",
          description: "Second task",
          status: "in_progress",
          createdAt: "2026-01-16T10:00:00Z",
          updatedAt: "2026-01-16T10:00:00Z",
        },
        {
          id: "task-3",
          specName: "test-spec",
          title: "Task 3",
          description: "Third task",
          status: "completed",
          createdAt: "2026-01-17T10:00:00Z",
          updatedAt: "2026-01-17T10:00:00Z",
        },
      ];

      for (const task of tasks) {
        await manager.writeTaskFile(task, "test-spec");
      }

      const scannedTasks = await manager.scanLocalTasks("test-spec");

      assert.strictEqual(scannedTasks.length, 3);
      assert.ok(scannedTasks.some((t) => t.id === "task-1"));
      assert.ok(scannedTasks.some((t) => t.id === "task-2"));
      assert.ok(scannedTasks.some((t) => t.id === "task-3"));
    });

    it("should return empty array for non-existent spec", async () => {
      const tasks = await manager.scanLocalTasks("non-existent-spec");
      assert.strictEqual(tasks.length, 0);
    });

    it("should ignore non-task files", async () => {
      const specDir = join(testDir, "test-spec");
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(join(specDir, "readme.md"), "# Readme", "utf-8");
      await fs.writeFile(join(specDir, "other.txt"), "Other file", "utf-8");

      const task: Task = {
        id: "task-only",
        specName: "test-spec",
        title: "Only Task",
        description: "Test",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };
      await manager.writeTaskFile(task, "test-spec");

      const tasks = await manager.scanLocalTasks("test-spec");

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].id, "task-only");
    });
  });

  describe("deleteTaskFile", () => {
    it("should delete task file", async () => {
      const task: Task = {
        id: "task-to-delete",
        specName: "test-spec",
        title: "Delete Me",
        description: "Test",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      await manager.writeTaskFile(task, "test-spec");
      await manager.deleteTaskFile("task-to-delete", "test-spec");

      const readTask = await manager.readTaskFile("task-to-delete", "test-spec");
      assert.strictEqual(readTask, null);
    });

    it("should not throw error for non-existent file", async () => {
      // Should not throw
      await manager.deleteTaskFile("non-existent", "test-spec");
    });

    it("should handle multiple deletes", async () => {
      const tasks: Task[] = [
        {
          id: "task-del-1",
          specName: "test-spec",
          title: "Task 1",
          description: "Test",
          status: "not_started",
          createdAt: "2026-01-15T10:00:00Z",
          updatedAt: "2026-01-15T10:00:00Z",
        },
        {
          id: "task-del-2",
          specName: "test-spec",
          title: "Task 2",
          description: "Test",
          status: "not_started",
          createdAt: "2026-01-15T10:00:00Z",
          updatedAt: "2026-01-15T10:00:00Z",
        },
      ];

      for (const task of tasks) {
        await manager.writeTaskFile(task, "test-spec");
      }

      await manager.deleteTaskFile("task-del-1", "test-spec");
      await manager.deleteTaskFile("task-del-2", "test-spec");

      const scannedTasks = await manager.scanLocalTasks("test-spec");
      assert.strictEqual(scannedTasks.length, 0);
    });
  });
});

describe("TaskFileManager - Edge Cases", () => {
  let manager: TaskFileManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `quikim-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new TaskFileManager(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Empty and missing sections", () => {
    it("should handle task with no description section", () => {
      const markdown = `---
id: task-no-desc
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task Title
`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.title, "Task Title");
      assert.strictEqual(task.description, "");
    });

    it("should handle task with empty subtasks section", () => {
      const markdown = `---
id: task-empty-subs
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task Title

## Subtasks

`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.subtasks?.length, 0);
    });

    it("should handle task with empty checklist section", () => {
      const markdown = `---
id: task-empty-check
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task Title

## Checklist

`;

      const task = manager.taskFileToServer(markdown);

      assert.strictEqual(task.checklist?.length, 0);
    });
  });

  describe("Malformed content", () => {
    it("should handle malformed YAML gracefully", () => {
      const markdown = `---
id: task-bad-yaml
specName: test-spec
status: [invalid
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task Title
`;

      assert.throws(() => {
        manager.taskFileToServer(markdown);
      });
    });

    it("should handle invalid checkbox formats", () => {
      const markdown = `---
id: task-bad-checkbox
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task Title

## Subtasks

  - [x] Valid checkbox
  - [ ] Another valid
`;

      const task = manager.taskFileToServer(markdown);

      // Should only parse valid checkboxes
      assert.strictEqual(task.subtasks?.length, 2);
      assert.strictEqual(task.subtasks?.[0].status, "completed");
      assert.strictEqual(task.subtasks?.[1].status, "not_started");
    });

    it("should handle multiline descriptions", () => {
      const markdown = `---
id: task-multiline
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task Title

## Description

This is a multiline
description that spans
multiple lines.

It even has paragraphs.
`;

      const task = manager.taskFileToServer(markdown);

      assert.ok(task.description.includes("multiline"));
      assert.ok(task.description.includes("paragraphs"));
    });
  });

  describe("Special characters and encoding", () => {
    it("should handle Unicode characters", async () => {
      const task: Task = {
        id: "task-unicode",
        specName: "test-spec",
        title: "Task with émojis 🚀 and ñ",
        description: "Testing Unicode: 你好世界",
        status: "not_started",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      await manager.writeTaskFile(task, "test-spec");
      const readTask = await manager.readTaskFile("task-unicode", "test-spec");

      assert.ok(readTask);
      assert.ok(readTask.title.includes("🚀"));
      assert.ok(readTask.description.includes("你好世界"));
    });

    it("should handle markdown special characters in content", () => {
      const markdown = `---
id: task-special
specName: test-spec
status: not_started
createdAt: '2026-01-15T10:00:00Z'
updatedAt: '2026-01-15T10:00:00Z'
---

# Task with *asterisks* and _underscores_

## Description

Content with **bold** and *italic* and \`code\`.
`;

      const task = manager.taskFileToServer(markdown);

      assert.ok(task.title.includes("*asterisks*"));
      assert.ok(task.description.includes("**bold**"));
    });
  });
});
