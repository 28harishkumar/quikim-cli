/**
 * Quikim - Tasks Format Converter Tests
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  serverToKiroFormat,
  kiroFormatToServer,
  parseKiroTask,
  formatKiroTask,
  type Milestone,
  type Task,
} from "./tasks-converter.js";

describe("parseKiroTask", () => {
  it("should parse a simple incomplete task", () => {
    const result = parseKiroTask("- [ ] 1. Task description");
    assert.deepStrictEqual(result, {
      description: "Task description",
      status: "not_started",
      isOptional: false,
      level: 0,
      numbering: "1",
    });
  });

  it("should parse a completed task", () => {
    const result = parseKiroTask("- [x] 2. Completed task");
    assert.deepStrictEqual(result, {
      description: "Completed task",
      status: "completed",
      isOptional: false,
      level: 0,
      numbering: "2",
    });
  });

  it("should parse an in-progress task", () => {
    const result = parseKiroTask("- [-] 3. In progress task");
    assert.deepStrictEqual(result, {
      description: "In progress task",
      status: "in_progress",
      isOptional: false,
      level: 0,
      numbering: "3",
    });
  });

  it("should parse a queued task", () => {
    const result = parseKiroTask("- [~] 4. Queued task");
    assert.deepStrictEqual(result, {
      description: "Queued task",
      status: "queued",
      isOptional: false,
      level: 0,
      numbering: "4",
    });
  });

  it("should parse an optional task", () => {
    const result = parseKiroTask("- [ ]* 5. Optional task");
    assert.deepStrictEqual(result, {
      description: "Optional task",
      status: "not_started",
      isOptional: true,
      level: 0,
      numbering: "5",
    });
  });

  it("should parse a subtask with indentation", () => {
    const result = parseKiroTask("  - [ ] 1.1 Subtask description");
    assert.deepStrictEqual(result, {
      description: "Subtask description",
      status: "not_started",
      isOptional: false,
      level: 1,
      numbering: "1.1",
    });
  });

  it("should parse a nested subtask", () => {
    const result = parseKiroTask("    - [x] 1.1.1 Nested subtask");
    assert.deepStrictEqual(result, {
      description: "Nested subtask",
      status: "completed",
      isOptional: false,
      level: 2,
      numbering: "1.1.1",
    });
  });

  it("should parse task without numbering", () => {
    const result = parseKiroTask("- [ ] Task without number");
    assert.deepStrictEqual(result, {
      description: "Task without number",
      status: "not_started",
      isOptional: false,
      level: 0,
      numbering: "",
    });
  });

  it("should return null for non-task lines", () => {
    assert.strictEqual(parseKiroTask("## Milestone Name"), null);
    assert.strictEqual(parseKiroTask("Some regular text"), null);
    assert.strictEqual(parseKiroTask(""), null);
  });

  it("should handle task with complex description", () => {
    const result = parseKiroTask("- [ ] 1. Implement feature with multiple words");
    assert.deepStrictEqual(result, {
      description: "Implement feature with multiple words",
      status: "not_started",
      isOptional: false,
      level: 0,
      numbering: "1",
    });
  });
});

describe("formatKiroTask", () => {
  it("should format a simple incomplete task", () => {
    const task: Task = {
      description: "Task description",
      status: "not_started",
      isOptional: false,
      order: 0,
    };
    const result = formatKiroTask(task, 0, "1", new Map());
    assert.strictEqual(result, "- [ ] 1. Task description\n");
  });

  it("should format a completed task", () => {
    const task: Task = {
      description: "Completed task",
      status: "completed",
      isOptional: false,
      order: 0,
    };
    const result = formatKiroTask(task, 0, "2", new Map());
    assert.strictEqual(result, "- [x] 2. Completed task\n");
  });

  it("should format an in-progress task", () => {
    const task: Task = {
      description: "In progress task",
      status: "in_progress",
      isOptional: false,
      order: 0,
    };
    const result = formatKiroTask(task, 0, "3", new Map());
    assert.strictEqual(result, "- [-] 3. In progress task\n");
  });

  it("should format a queued task", () => {
    const task: Task = {
      description: "Queued task",
      status: "queued",
      isOptional: false,
      order: 0,
    };
    const result = formatKiroTask(task, 0, "4", new Map());
    assert.strictEqual(result, "- [~] 4. Queued task\n");
  });

  it("should format an optional task", () => {
    const task: Task = {
      description: "Optional task",
      status: "not_started",
      isOptional: true,
      order: 0,
    };
    const result = formatKiroTask(task, 0, "5", new Map());
    assert.strictEqual(result, "- [ ]* 5. Optional task\n");
  });

  it("should format a subtask with indentation", () => {
    const task: Task = {
      description: "Subtask description",
      status: "not_started",
      isOptional: false,
      order: 0,
    };
    const result = formatKiroTask(task, 1, "1.1", new Map());
    assert.strictEqual(result, "  - [ ] 1.1. Subtask description\n");
  });

  it("should format task with subtasks", () => {
    const parentTask: Task = {
      id: "parent-1",
      description: "Parent task",
      status: "not_started",
      isOptional: false,
      order: 0,
    };

    const subtask1: Task = {
      id: "sub-1",
      description: "Subtask 1",
      status: "completed",
      isOptional: false,
      order: 1,
      parentTaskId: "parent-1",
    };

    const subtask2: Task = {
      id: "sub-2",
      description: "Subtask 2",
      status: "not_started",
      isOptional: true,
      order: 2,
      parentTaskId: "parent-1",
    };

    const taskMap = new Map<string, Task>([
      ["parent-1", parentTask],
      ["sub-1", subtask1],
      ["sub-2", subtask2],
    ]);

    const result = formatKiroTask(parentTask, 0, "1", taskMap);
    assert.strictEqual(
      result,
      "- [ ] 1. Parent task\n" +
      "  - [x] 1.1. Subtask 1\n" +
      "  - [ ]* 1.2. Subtask 2\n"
    );
  });
});

describe("serverToKiroFormat", () => {
  it("should convert empty milestones array", () => {
    const result = serverToKiroFormat([]);
    assert.strictEqual(result, "# Tasks\n\nNo tasks defined.\n");
  });

  it("should convert single milestone with one task", () => {
    const milestones: Milestone[] = [
      {
        name: "Phase 1",
        tasks: [
          {
            description: "Implement feature",
            status: "not_started",
            isOptional: false,
            order: 0,
          },
        ],
      },
    ];

    const result = serverToKiroFormat(milestones);
    assert.strictEqual(
      result,
      "# Tasks\n\n" +
      "## Phase 1\n\n" +
      "- [ ] 1. Implement feature\n"
    );
  });

  it("should convert milestone with description", () => {
    const milestones: Milestone[] = [
      {
        name: "Phase 1",
        description: "Initial setup phase",
        tasks: [
          {
            description: "Setup project",
            status: "completed",
            isOptional: false,
            order: 0,
          },
        ],
      },
    ];

    const result = serverToKiroFormat(milestones);
    assert.strictEqual(
      result,
      "# Tasks\n\n" +
      "## Phase 1\n\n" +
      "Initial setup phase\n\n" +
      "- [x] 1. Setup project\n"
    );
  });

  it("should convert milestone with multiple tasks", () => {
    const milestones: Milestone[] = [
      {
        name: "Development",
        tasks: [
          {
            description: "Write code",
            status: "completed",
            isOptional: false,
            order: 0,
          },
          {
            description: "Write tests",
            status: "in_progress",
            isOptional: false,
            order: 1,
          },
          {
            description: "Write docs",
            status: "not_started",
            isOptional: true,
            order: 2,
          },
        ],
      },
    ];

    const result = serverToKiroFormat(milestones);
    assert.strictEqual(
      result,
      "# Tasks\n\n" +
      "## Development\n\n" +
      "- [x] 1. Write code\n" +
      "- [-] 2. Write tests\n" +
      "- [ ]* 3. Write docs\n"
    );
  });

  it("should convert milestone with nested tasks", () => {
    const milestones: Milestone[] = [
      {
        name: "Implementation",
        tasks: [
          {
            id: "task-1",
            description: "Backend development",
            status: "in_progress",
            isOptional: false,
            order: 0,
          },
          {
            id: "task-1-1",
            description: "Setup database",
            status: "completed",
            isOptional: false,
            order: 1,
            parentTaskId: "task-1",
          },
          {
            id: "task-1-2",
            description: "Create API endpoints",
            status: "not_started",
            isOptional: false,
            order: 2,
            parentTaskId: "task-1",
          },
        ],
      },
    ];

    const result = serverToKiroFormat(milestones);
    assert.strictEqual(
      result,
      "# Tasks\n\n" +
      "## Implementation\n\n" +
      "- [-] 1. Backend development\n" +
      "  - [x] 1.1. Setup database\n" +
      "  - [ ] 1.2. Create API endpoints\n"
    );
  });

  it("should convert multiple milestones", () => {
    const milestones: Milestone[] = [
      {
        name: "Phase 1",
        tasks: [
          {
            description: "Task 1",
            status: "completed",
            isOptional: false,
            order: 0,
          },
        ],
      },
      {
        name: "Phase 2",
        tasks: [
          {
            description: "Task 2",
            status: "not_started",
            isOptional: false,
            order: 0,
          },
        ],
      },
    ];

    const result = serverToKiroFormat(milestones);
    assert.strictEqual(
      result,
      "# Tasks\n\n" +
      "## Phase 1\n\n" +
      "- [x] 1. Task 1\n\n" +
      "## Phase 2\n\n" +
      "- [ ] 1. Task 2\n"
    );
  });
});

describe("kiroFormatToServer", () => {
  it("should parse empty markdown", () => {
    const result = kiroFormatToServer("");
    assert.deepStrictEqual(result, []);
  });

  it("should parse single milestone with one task", () => {
    const markdown = 
      "# Tasks\n\n" +
      "## Phase 1\n\n" +
      "- [ ] 1. Implement feature\n";

    const result = kiroFormatToServer(markdown);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "Phase 1");
    assert.strictEqual(result[0].tasks.length, 1);
    assert.strictEqual(result[0].tasks[0].description, "Implement feature");
    assert.strictEqual(result[0].tasks[0].status, "not_started");
    assert.strictEqual(result[0].tasks[0].isOptional, false);
    assert.strictEqual(result[0].tasks[0].order, 0);
  });

  it("should parse milestone with description", () => {
    const markdown =
      "# Tasks\n\n" +
      "## Phase 1\n\n" +
      "Initial setup phase\n\n" +
      "- [x] 1. Setup project\n";

    const result = kiroFormatToServer(markdown);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].description, "Initial setup phase");
    assert.strictEqual(result[0].tasks[0].status, "completed");
  });

  it("should parse milestone with multiple tasks", () => {
    const markdown =
      "# Tasks\n\n" +
      "## Development\n\n" +
      "- [x] 1. Write code\n" +
      "- [-] 2. Write tests\n" +
      "- [ ]* 3. Write docs\n";

    const result = kiroFormatToServer(markdown);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].tasks.length, 3);
    assert.strictEqual(result[0].tasks[0].status, "completed");
    assert.strictEqual(result[0].tasks[1].status, "in_progress");
    assert.strictEqual(result[0].tasks[2].isOptional, true);
  });

  it("should parse milestone with nested tasks", () => {
    const markdown =
      "# Tasks\n\n" +
      "## Implementation\n\n" +
      "- [-] 1. Backend development\n" +
      "  - [x] 1.1 Setup database\n" +
      "  - [ ] 1.2 Create API endpoints\n";

    const result = kiroFormatToServer(markdown);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].tasks.length, 3);
    
    const parentTask = result[0].tasks[0];
    const subtask1 = result[0].tasks[1];
    const subtask2 = result[0].tasks[2];
    
    assert.strictEqual(parentTask.description, "Backend development");
    assert.strictEqual(subtask1.description, "Setup database");
    assert.strictEqual(subtask2.description, "Create API endpoints");
  });

  it("should parse multiple milestones", () => {
    const markdown =
      "# Tasks\n\n" +
      "## Phase 1\n\n" +
      "- [x] 1. Task 1\n\n" +
      "## Phase 2\n\n" +
      "- [ ] 1. Task 2\n";

    const result = kiroFormatToServer(markdown);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "Phase 1");
    assert.strictEqual(result[1].name, "Phase 2");
  });

  it("should handle tasks with various statuses", () => {
    const markdown =
      "# Tasks\n\n" +
      "## Testing\n\n" +
      "- [ ] 1. Not started\n" +
      "- [-] 2. In progress\n" +
      "- [~] 3. Queued\n" +
      "- [x] 4. Completed\n";

    const result = kiroFormatToServer(markdown);
    assert.strictEqual(result[0].tasks[0].status, "not_started");
    assert.strictEqual(result[0].tasks[1].status, "in_progress");
    assert.strictEqual(result[0].tasks[2].status, "queued");
    assert.strictEqual(result[0].tasks[3].status, "completed");
  });
});

describe("round-trip conversion", () => {
  it("should maintain data integrity for simple milestone", () => {
    const original: Milestone[] = [
      {
        name: "Phase 1",
        description: "Test phase",
        tasks: [
          {
            description: "Task 1",
            status: "completed",
            isOptional: false,
            order: 0,
          },
          {
            description: "Task 2",
            status: "not_started",
            isOptional: true,
            order: 1,
          },
        ],
      },
    ];

    const markdown = serverToKiroFormat(original);
    const parsed = kiroFormatToServer(markdown);

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].name, original[0].name);
    assert.strictEqual(parsed[0].description, original[0].description);
    assert.strictEqual(parsed[0].tasks.length, 2);
    assert.strictEqual(parsed[0].tasks[0].description, original[0].tasks[0].description);
    assert.strictEqual(parsed[0].tasks[0].status, original[0].tasks[0].status);
    assert.strictEqual(parsed[0].tasks[1].isOptional, original[0].tasks[1].isOptional);
  });

  it("should maintain data integrity for nested tasks", () => {
    const original: Milestone[] = [
      {
        name: "Development",
        tasks: [
          {
            id: "task-1",
            description: "Parent task",
            status: "in_progress",
            isOptional: false,
            order: 0,
          },
          {
            id: "task-1-1",
            description: "Subtask 1",
            status: "completed",
            isOptional: false,
            order: 1,
            parentTaskId: "task-1",
          },
          {
            id: "task-1-2",
            description: "Subtask 2",
            status: "not_started",
            isOptional: true,
            order: 2,
            parentTaskId: "task-1",
          },
        ],
      },
    ];

    const markdown = serverToKiroFormat(original);
    const parsed = kiroFormatToServer(markdown);

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].tasks.length, 3);
    assert.strictEqual(parsed[0].tasks[0].description, "Parent task");
    assert.strictEqual(parsed[0].tasks[1].description, "Subtask 1");
    assert.strictEqual(parsed[0].tasks[2].description, "Subtask 2");
  });

  it("should maintain data integrity for multiple milestones", () => {
    const original: Milestone[] = [
      {
        name: "Phase 1",
        tasks: [
          {
            description: "Task 1",
            status: "completed",
            isOptional: false,
            order: 0,
          },
        ],
      },
      {
        name: "Phase 2",
        tasks: [
          {
            description: "Task 2",
            status: "not_started",
            isOptional: false,
            order: 0,
          },
        ],
      },
    ];

    const markdown = serverToKiroFormat(original);
    const parsed = kiroFormatToServer(markdown);

    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].name, "Phase 1");
    assert.strictEqual(parsed[1].name, "Phase 2");
  });
});
