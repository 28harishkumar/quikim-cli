/**
 * Project context utilities for reading local .quikim/project.json
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getQuikimProjectRoot } from "../config/project-root.js";

export interface ProjectContext {
  projectId?: string;
  organizationId?: string;
  userId?: string;
  specName?: string;
}

/**
 * Get project context from .quikim/project.json in current directory.
 * Returns null if file doesn't exist or can't be parsed.
 */
export function getProjectContext(): ProjectContext | null {
  try {
    const projectRoot = getQuikimProjectRoot();
    const projectFilePath = join(projectRoot, ".quikim", "project.json");

    if (!existsSync(projectFilePath)) {
      return null;
    }

    const content = readFileSync(projectFilePath, "utf-8");
    const data = JSON.parse(content) as ProjectContext;

    return data;
  } catch (error) {
    // File doesn't exist or can't be parsed
    return null;
  }
}
