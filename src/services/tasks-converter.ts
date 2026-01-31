/**
 * Quikim - Tasks Format Converter
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Tasks Format Converter Module
 * 
 * Converts between server task/milestone format and Kiro spec format.
 * 
 * Kiro Spec Format:
 * ```markdown
 * # Tasks
 * 
 * ## Milestone Name
 * 
 * - [ ] 1. Task description (incomplete, required)
 * - [x] 2. Task description (complete, required)
 * - [ ]* 3. Task description (incomplete, optional)
 * - [-] 4. Task description (in progress, required)
 * - [~] 5. Task description (queued, required)
 *   - [ ] 5.1 Subtask description
 *   - [x] 5.2 Subtask description
 * ```
 */

export type TaskStatus = "not_started" | "in_progress" | "completed" | "queued" | "blocked";

export interface Task {
  id?: string;
  description: string;
  status: TaskStatus;
  isOptional?: boolean;
  order: number;
  parentTaskId?: string;
}

export interface Milestone {
  id?: string;
  name: string;
  description?: string;
  tasks: Task[];
}

export interface ParsedTask {
  description: string;
  status: TaskStatus;
  isOptional: boolean;
  level: number;
  numbering: string;
}

/**
 * Convert server milestone/task format to Kiro spec format
 */
export function serverToKiroFormat(milestones: Milestone[]): string {
  if (!milestones || milestones.length === 0) {
    return "# Tasks\n\nNo tasks defined.\n";
  }

  let markdown = "# Tasks\n\n";

  for (const milestone of milestones) {
    markdown += `## ${milestone.name}\n\n`;

    if (milestone.description) {
      markdown += `${milestone.description}\n\n`;
    }

    // Sort tasks by order
    const sortedTasks = [...milestone.tasks].sort((a, b) => a.order - b.order);

    // Build task hierarchy
    const taskMap = new Map<string, Task>();
    const rootTasks: Task[] = [];

    for (const task of sortedTasks) {
      if (task.id) {
        taskMap.set(task.id, task);
      }
      if (!task.parentTaskId) {
        rootTasks.push(task);
      }
    }

    // Format tasks recursively
    let taskNumber = 1;
    for (const task of rootTasks) {
      markdown += formatKiroTask(task, 0, String(taskNumber), taskMap);
      taskNumber++;
    }

    markdown += "\n";
  }

  return markdown.trim() + "\n";
}

/**
 * Convert Kiro spec format to server milestone/task format
 */
export function kiroFormatToServer(markdown: string): Milestone[] {
  const milestones: Milestone[] = [];
  const lines = markdown.split("\n");
  
  let currentMilestone: Milestone | null = null;
  let currentDescription = "";
  let inTasksSection = false;
  let taskOrder = 0;
  const taskStack: Array<{ task: Task; level: number; numbering: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines and main title
    if (!trimmedLine || trimmedLine === "# Tasks") {
      continue;
    }

    // Check for milestone heading (## Milestone Name)
    const milestoneMatch = trimmedLine.match(/^##\s+(.+)$/);
    if (milestoneMatch) {
      // Save previous milestone if exists
      if (currentMilestone) {
        milestones.push(currentMilestone);
      }

      // Start new milestone
      currentMilestone = {
        name: milestoneMatch[1].trim(),
        description: "",
        tasks: [],
      };
      currentDescription = "";
      inTasksSection = false;
      taskOrder = 0;
      taskStack.length = 0;
      continue;
    }

    // If we have a current milestone
    if (currentMilestone) {
      // Try to parse as task
      const parsedTask = parseKiroTask(line);
      
      if (parsedTask) {
        inTasksSection = true;
        
        // Create task object
        const task: Task = {
          description: parsedTask.description,
          status: parsedTask.status,
          isOptional: parsedTask.isOptional,
          order: taskOrder++,
        };

        // Handle task hierarchy
        if (parsedTask.level === 0) {
          // Root level task
          currentMilestone.tasks.push(task);
          taskStack.length = 0;
          taskStack.push({ task, level: 0, numbering: parsedTask.numbering });
        } else {
          // Subtask - find parent
          while (taskStack.length > 0 && taskStack[taskStack.length - 1].level >= parsedTask.level) {
            taskStack.pop();
          }

          if (taskStack.length > 0) {
            const parent = taskStack[taskStack.length - 1].task;
            // Note: parentTaskId will be set after tasks are created on server
            // For now, we'll track the relationship through order and level
            task.parentTaskId = parent.id;
          }

          currentMilestone.tasks.push(task);
          taskStack.push({ task, level: parsedTask.level, numbering: parsedTask.numbering });
        }
      } else if (!inTasksSection && trimmedLine && !trimmedLine.startsWith("#")) {
        // Collect milestone description before tasks section
        if (currentDescription) {
          currentDescription += "\n";
        }
        currentDescription += trimmedLine;
        currentMilestone.description = currentDescription;
      }
    }
  }

  // Save last milestone
  if (currentMilestone) {
    milestones.push(currentMilestone);
  }

  return milestones;
}

/**
 * Parse a single Kiro format task line
 * Returns null if line is not a valid task
 */
export function parseKiroTask(line: string): ParsedTask | null {
  // Match task pattern: - [status] description or - [status]* description
  // With optional indentation for subtasks
  const taskRegex = /^(\s*)-\s+\[([ x\-~!])\](\*)?\s+(.+)$/;
  const match = line.match(taskRegex);

  if (!match) {
    return null;
  }

  const indent = match[1];
  const statusChar = match[2];
  const optionalMarker = match[3];
  const description = match[4].trim();

  // Calculate level based on indentation (2 spaces per level)
  const level = Math.floor(indent.length / 2);

  // Map checkbox status to task status
  let status: TaskStatus;
  switch (statusChar) {
    case "x":
      status = "completed";
      break;
    case "-":
      status = "in_progress";
      break;
    case "~":
      status = "queued";
      break;
    case "!":
      status = "blocked";
      break;
    case " ":
    default:
      status = "not_started";
      break;
  }

  // Extract numbering if present (e.g., "1.", "1.1", "2.3.4")
  const numberingMatch = description.match(/^([\d.]+)\.?\s+(.+)$/);
  let numbering = "";
  let cleanDescription = description;

  if (numberingMatch) {
    numbering = numberingMatch[1].replace(/\.$/, ""); // Remove trailing period
    cleanDescription = numberingMatch[2];
  }

  return {
    description: cleanDescription,
    status,
    isOptional: !!optionalMarker,
    level,
    numbering,
  };
}

/**
 * Format a task in Kiro format
 */
export function formatKiroTask(
  task: Task,
  level: number,
  numbering: string,
  taskMap: Map<string, Task>
): string {
  const indent = "  ".repeat(level);
  
  // Map status to checkbox
  let checkbox: string;
  switch (task.status) {
    case "completed":
      checkbox = "[x]";
      break;
    case "in_progress":
      checkbox = "[-]";
      break;
    case "queued":
      checkbox = "[~]";
      break;
    case "blocked":
      checkbox = "[!]";
      break;
    case "not_started":
    default:
      checkbox = "[ ]";
      break;
  }

  // Add optional marker if needed
  const optionalMarker = task.isOptional ? "*" : "";

  // Format the task line
  let line = `${indent}- ${checkbox}${optionalMarker} ${numbering}. ${task.description}\n`;

  // Find and format subtasks
  if (task.id) {
    const subtasks = Array.from(taskMap.values()).filter(
      (t) => t.parentTaskId === task.id
    );
    
    if (subtasks.length > 0) {
      const sortedSubtasks = [...subtasks].sort((a, b) => a.order - b.order);
      let subtaskNumber = 1;
      
      for (const subtask of sortedSubtasks) {
        const subNumbering = `${numbering}.${subtaskNumber}`;
        line += formatKiroTask(subtask, level + 1, subNumbering, taskMap);
        subtaskNumber++;
      }
    }
  }

  return line;
}
