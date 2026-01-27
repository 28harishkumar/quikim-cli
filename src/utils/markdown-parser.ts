/**
 * Quikim - Markdown Parser Utilities
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Extract title/name from markdown content
 */
export function extractTitleFromMarkdown(content: string): string | null {
  // Try to find first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Try to find first H2 heading
  const h2Match = content.match(/^##\s+(.+)$/m);
  if (h2Match) {
    return h2Match[1].trim();
  }

  // Try to find title in frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  return null;
}

/**
 * Parse tasks from markdown content
 * Returns milestone info and array of tasks
 */
export interface ParsedTask {
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "completed" | "cancelled";
  required: boolean;
  order: number;
  parentTaskId?: string;
}

export interface ParsedMilestone {
  name: string;
  description: string;
  tasks: ParsedTask[];
}

export function parseTasksFromMarkdown(content: string, milestoneName: string): ParsedMilestone {
  const lines = content.split("\n");
  const tasks: ParsedTask[] = [];
  let description = "";
  let inTasksSection = false;
  let taskOrder = 0;
  let currentParentTask: ParsedTask | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if we're entering the tasks section
    if (line.match(/^##\s+Tasks?$/i) || line.match(/^#\s+Tasks?$/i)) {
      inTasksSection = true;
      continue;
    }

    // Collect description before tasks section
    if (!inTasksSection && line && !line.startsWith("#")) {
      if (description) description += "\n";
      description += line;
    }

    // Parse task lines: - [x] or - [ ] or - [ ]*
    if (inTasksSection && line.match(/^-\s+\[([ x])\](.*)$/)) {
      const match = line.match(/^-\s+\[([ x])\](.*)$/);
      if (!match) continue;

      const isChecked = match[1] === "x";
      const taskText = match[2].trim();
      const isOptional = taskText.endsWith("*");
      const cleanTaskText = isOptional ? taskText.slice(0, -1).trim() : taskText;

      // Determine status
      let status: ParsedTask["status"] = "todo";
      if (isChecked) {
        status = "completed";
      }

      // Check for status indicators in text
      if (cleanTaskText.match(/\b(in progress|running)\b/i)) {
        status = "in_progress";
      } else if (cleanTaskText.match(/\b(review|in queue)\b/i)) {
        status = "review";
      } else if (cleanTaskText.match(/\b(cancelled|canceled)\b/i)) {
        status = "cancelled";
      }

      // Extract title and description
      const parts = cleanTaskText.split("\n");
      const title = parts[0].trim();
      const taskDescription = parts.slice(1).join("\n").trim();

      // Determine if this is a subtask (indented)
      const indentLevel = (line.match(/^(\s*)/)?.[1] || "").length;
      const isSubtask = indentLevel > 2;

      if (isSubtask && currentParentTask) {
        // This is a subtask
        const subtask: ParsedTask = {
          title,
          description: taskDescription,
          status,
          required: !isOptional,
          order: taskOrder++,
        };
        tasks.push(subtask);
        // Note: parentTaskId will be set after we have the parent's index
      } else {
        // This is a top-level task
        currentParentTask = {
          title,
          description: taskDescription,
          status,
          required: !isOptional,
          order: taskOrder++,
        };
        tasks.push(currentParentTask);
      }
    } else if (inTasksSection && line.startsWith("-") && !line.match(/^-\s+\[/)) {
      // Continuation line for task description
      if (currentParentTask && tasks.length > 0) {
        const lastTask = tasks[tasks.length - 1];
        if (lastTask.description) {
          lastTask.description += "\n" + line.substring(1).trim();
        } else {
          lastTask.description = line.substring(1).trim();
        }
      }
    }
  }

  // Set parent task IDs for subtasks
  // For now, we'll handle this on the server side when creating tasks
  // as we need the actual parent task IDs from the database

  return {
    name: milestoneName,
    description: description.trim() || `Milestone: ${milestoneName}`,
    tasks,
  };
}
