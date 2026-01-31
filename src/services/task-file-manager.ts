/**
 * Quikim - Task File Manager
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { promises as fs } from "fs";
import { join } from "path";
import YAML from "yaml";
import { getQuikimProjectRoot } from "../config/project-root.js";

/**
 * Task status types
 */
export type TaskStatus = "not_started" | "in_progress" | "completed" | "blocked";

/**
 * Task priority levels
 */
export type TaskPriority = "low" | "medium" | "high";

/**
 * Subtask within a task
 */
export interface Subtask {
  id?: string;
  description: string;
  status: TaskStatus;
  order: number;
}

/**
 * Checklist item within a task
 */
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

/**
 * Comment on a task
 */
export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

/**
 * Task attachment
 */
export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Complete task structure
 */
export interface Task {
  id: string;
  specName: string;
  milestoneId?: string; // Milestone for grouping tasks by spec
  title: string;
  description: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
  tags?: string[];
  subtasks?: Subtask[]; // Subtasks are stored within the task
  checklist?: ChecklistItem[];
  comments?: Comment[];
  attachments?: Attachment[];
  /** Versioned prompt (AI/LLM prompt for this task); latest only when syncing. */
  prompt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task metadata (YAML frontmatter)
 */
interface TaskMetadata {
  id: string;
  specName: string;
  milestoneId?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Task File Manager
 * Manages individual task files with full metadata and assets
 */
export class TaskFileManager {
  private artifactsRoot: string;

  constructor(artifactsRoot?: string) {
    this.artifactsRoot = artifactsRoot || join(getQuikimProjectRoot(), ".quikim", "artifacts");
  }

  /**
   * Convert server task format to markdown file content
   * Includes subtasks in the same file
   */
  serverToTaskFile(task: Task): string {
    // Create YAML frontmatter
    const metadata: TaskMetadata = {
      id: task.id,
      specName: task.specName,
      milestoneId: task.milestoneId,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      tags: task.tags,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    const frontmatter = YAML.stringify(metadata);
    let markdown = `---\n${frontmatter}---\n\n`;

    // Add title
    markdown += `# ${task.title}\n\n`;

    // Add description
    if (task.description) {
      markdown += `## Description\n\n${task.description}\n\n`;
    }

    // Add subtasks (indented with 2 spaces, using checkbox format)
    if (task.subtasks && task.subtasks.length > 0) {
      markdown += `## Subtasks\n\n`;
      const sortedSubtasks = [...task.subtasks].sort((a, b) => a.order - b.order);
      for (const subtask of sortedSubtasks) {
        const checkbox = this.statusToCheckbox(subtask.status);
        markdown += `  - ${checkbox} ${subtask.description}\n`;
      }
      markdown += `\n`;
    }

    // Add checklist
    if (task.checklist && task.checklist.length > 0) {
      markdown += `## Checklist\n\n`;
      const sortedChecklist = [...task.checklist].sort((a, b) => a.order - b.order);
      for (const item of sortedChecklist) {
        const checkbox = item.completed ? "[x]" : "[ ]";
        markdown += `- ${checkbox} ${item.text}\n`;
      }
      markdown += `\n`;
    }

    // Add comments
    if (task.comments && task.comments.length > 0) {
      markdown += `## Comments\n\n`;
      for (const comment of task.comments) {
        const date = new Date(comment.createdAt).toISOString();
        markdown += `### Comment by ${comment.author} (${date})\n${comment.content}\n\n`;
      }
    }

    // Add attachments
    if (task.attachments && task.attachments.length > 0) {
      markdown += `## Attachments\n\n`;
      for (const attachment of task.attachments) {
        const relativePath = `./task_assets/${attachment.filename}`;
        markdown += `- [${attachment.filename}](${relativePath})\n`;
      }
      markdown += `\n`;
    }

    // Add prompt (versioned on server; local file stores latest only)
    if (task.prompt) {
      markdown += `## Prompt\n\n${task.prompt}\n\n`;
    }

    return markdown.trim() + "\n";
  }

  /**
   * Convert task status to checkbox format
   */
  private statusToCheckbox(status: TaskStatus): string {
    switch (status) {
      case "completed":
        return "[x]";
      case "in_progress":
        return "[-]";
      case "blocked":
        return "[!]";
      case "not_started":
      default:
        return "[ ]";
    }
  }

  /**
   * Convert checkbox format to task status
   */
  private checkboxToStatus(checkbox: string): TaskStatus {
    switch (checkbox) {
      case "x":
        return "completed";
      case "-":
        return "in_progress";
      case "!":
        return "blocked";
      case " ":
      default:
        return "not_started";
    }
  }

  /**
   * Parse task markdown file to server format
   * Extracts subtasks from the same file
   */
  taskFileToServer(markdown: string): Task {
    // Extract YAML frontmatter
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatterMatch) {
      throw new Error("Invalid task file: missing YAML frontmatter");
    }

    const metadata = YAML.parse(frontmatterMatch[1]) as TaskMetadata;
    const content = markdown.slice(frontmatterMatch[0].length);

    // Extract title (first H1)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Task";

    // Extract description
    const descMatch = content.match(/##\s+Description\n\n([\s\S]*?)(?=\n##|$)/);
    const description = descMatch ? descMatch[1].trim() : "";

    // Extract subtasks (indented with 2 spaces)
    const subtasksMatch = content.match(/##\s+Subtasks\n\n([\s\S]*?)(?=\n##|$)/);
    const subtasks: Subtask[] = [];
    if (subtasksMatch) {
      const lines = subtasksMatch[1].split("\n");
      let order = 0;
      for (const line of lines) {
        // Match indented subtasks: "  - [status] description"
        const subtaskMatch = line.match(/^\s{2}-\s+\[([ x\-!])\]\s+(.+)$/);
        if (subtaskMatch) {
          subtasks.push({
            description: subtaskMatch[2].trim(),
            status: this.checkboxToStatus(subtaskMatch[1]),
            order: order++,
          });
        }
      }
    }

    // Extract checklist
    const checklistMatch = content.match(/##\s+Checklist\n\n([\s\S]*?)(?=\n##|$)/);
    const checklist: ChecklistItem[] = [];
    if (checklistMatch) {
      const lines = checklistMatch[1].split("\n");
      let order = 0;
      for (const line of lines) {
        const itemMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
        if (itemMatch) {
          checklist.push({
            id: `checklist-${order}`,
            text: itemMatch[2].trim(),
            completed: itemMatch[1] === "x",
            order: order++,
          });
        }
      }
    }

    // Extract comments
    const commentsMatch = content.match(/##\s+Comments\n\n([\s\S]*?)(?=\n##|$)/);
    const comments: Comment[] = [];
    if (commentsMatch) {
      const commentBlocks = commentsMatch[1].split(/###\s+Comment by\s+/);
      for (const block of commentBlocks) {
        if (!block.trim()) continue;
        const match = block.match(/^(.+?)\s+\((.+?)\)\n([\s\S]*?)$/);
        if (match) {
          comments.push({
            id: `comment-${comments.length}`,
            author: match[1].trim(),
            content: match[3].trim(),
            createdAt: match[2].trim(),
          });
        }
      }
    }

    // Extract attachments
    const attachmentsMatch = content.match(/##\s+Attachments\n\n([\s\S]*?)(?=\n##|$)/);
    const attachments: Attachment[] = [];
    if (attachmentsMatch) {
      const lines = attachmentsMatch[1].split("\n");
      for (const line of lines) {
        const match = line.match(/^-\s+\[(.+?)\]\((.+?)\)$/);
        if (match) {
          attachments.push({
            id: `attachment-${attachments.length}`,
            filename: match[1].trim(),
            url: match[2].trim(),
            size: 0,
            mimeType: "application/octet-stream",
          });
        }
      }
    }

    // Extract prompt (versioned on server; local file stores latest only)
    const promptMatch = content.match(/##\s+Prompt\n\n([\s\S]*?)(?=\n##|$)/);
    const prompt = promptMatch ? promptMatch[1].trim() : undefined;

    return {
      id: metadata.id,
      specName: metadata.specName,
      milestoneId: metadata.milestoneId,
      title,
      description,
      status: metadata.status,
      priority: metadata.priority,
      assignee: metadata.assignee,
      dueDate: metadata.dueDate,
      tags: metadata.tags,
      subtasks,
      checklist,
      comments,
      attachments,
      prompt,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
    };
  }

  /**
   * Get task assets directory path
   */
  getTaskAssetsPath(specName: string): string {
    return join(this.artifactsRoot, specName, "task_assets");
  }

  /**
   * Download task assets from server
   */
  async downloadTaskAssets(task: Task, specName: string): Promise<void> {
    if (!task.attachments || task.attachments.length === 0) {
      return;
    }

    const assetsDir = this.getTaskAssetsPath(specName);
    await fs.mkdir(assetsDir, { recursive: true });

    for (const attachment of task.attachments) {
      const localPath = join(assetsDir, attachment.filename);
      // TODO: Implement actual download from attachment.url
      // For now, just create placeholder
      await fs.writeFile(localPath, `Placeholder for ${attachment.filename}`, "utf-8");
    }
  }

  /**
   * Upload task assets to server
   */
  async uploadTaskAssets(task: Task, specName: string): Promise<void> {
    if (!task.attachments || task.attachments.length === 0) {
      return;
    }

    const assetsDir = this.getTaskAssetsPath(specName);

    for (const attachment of task.attachments) {
      const localPath = join(assetsDir, attachment.filename);
      try {
        await fs.access(localPath);
        // TODO: Implement actual upload to server
        // For now, just verify file exists
      } catch (error) {
        console.warn(`Warning: Asset not found: ${localPath}`);
      }
    }
  }

  /**
   * Write task file to disk
   */
  async writeTaskFile(task: Task, specName: string): Promise<void> {
    const taskDir = join(this.artifactsRoot, specName);
    await fs.mkdir(taskDir, { recursive: true });

    const filename = `tasks_${task.id}.md`;
    const filePath = join(taskDir, filename);
    const content = this.serverToTaskFile(task);

    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * Read task file from disk
   */
  async readTaskFile(taskId: string, specName: string): Promise<Task | null> {
    const filename = `tasks_${taskId}.md`;
    const filePath = join(this.artifactsRoot, specName, filename);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return this.taskFileToServer(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Scan local task files for a spec
   */
  async scanLocalTasks(specName: string): Promise<Task[]> {
    const tasks: Task[] = [];
    const specDir = join(this.artifactsRoot, specName);

    try {
      const files = await fs.readdir(specDir);
      for (const file of files) {
        if (file.startsWith("tasks_") && file.endsWith(".md")) {
          const taskId = file.slice(6, -3); // Remove "tasks_" and ".md"
          const task = await this.readTaskFile(taskId, specName);
          if (task) {
            tasks.push(task);
          }
        }
      }
    } catch (error) {
      // Directory might not exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    return tasks;
  }

  /**
   * Delete task file
   */
  async deleteTaskFile(taskId: string, specName: string): Promise<void> {
    const filename = `tasks_${taskId}.md`;
    const filePath = join(this.artifactsRoot, specName, filename);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

/**
 * Milestone helper functions
 */
export interface Milestone {
  id: string;
  specName: string;
  name: string;
  description?: string;
}

/**
 * Find or create milestone for a spec
 * Milestones are used only for grouping tasks by spec
 * 
 * @param specName - The spec name
 * @param apiClient - API client for server communication
 * @returns Milestone ID
 */
export async function findOrCreateMilestone(
  specName: string,
  apiClient: { getMilestones: (specName: string) => Promise<Milestone[]>; createMilestone: (milestone: Partial<Milestone>) => Promise<Milestone> }
): Promise<string> {
  // Check if milestone exists for this spec
  const milestones = await apiClient.getMilestones(specName);
  
  if (milestones.length > 0) {
    // Return first milestone for this spec
    return milestones[0].id;
  }

  // Create new milestone for this spec
  const newMilestone = await apiClient.createMilestone({
    specName,
    name: `${specName} Tasks`,
    description: `Tasks for ${specName} spec`,
  });

  return newMilestone.id;
}

/**
 * Split task into main task and subtasks for server push
 * 
 * @param task - Task with subtasks
 * @returns Object with main task and separate subtasks array
 */
export function splitTaskAndSubtasks(task: Task): {
  mainTask: Omit<Task, "subtasks">;
  subtasks: Array<Subtask & { parentTaskId: string }>;
} {
  const { subtasks, ...mainTask } = task;
  
  const subtasksWithParent = (subtasks || []).map((subtask) => ({
    ...subtask,
    parentTaskId: task.id,
  }));

  return {
    mainTask,
    subtasks: subtasksWithParent,
  };
}

/**
 * Merge subtasks back into task for local storage
 * 
 * @param mainTask - Main task without subtasks
 * @param subtasks - Array of subtasks
 * @returns Complete task with subtasks
 */
export function mergeTaskWithSubtasks(
  mainTask: Omit<Task, "subtasks">,
  subtasks: Subtask[]
): Task {
  return {
    ...mainTask,
    subtasks: subtasks.sort((a, b) => a.order - b.order),
  };
}
