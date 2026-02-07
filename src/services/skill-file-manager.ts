/**
 * Quikim - Skill File Manager
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 *
 * Manages local .quikim/skills/ directory for workflow skill files.
 * Skills guide LLM artifact generation for each workflow step.
 * Follows the same pattern as ArtifactFileManager for artifacts.
 */

import { promises as fs } from "fs";
import { join } from "path";
import { getQuikimProjectRoot } from "../config/project-root.js";

export interface LocalSkill {
  nodeId: string;
  specName: string;
  label: string;
  content: string;
  filePath: string;
  metadata?: Record<string, unknown>;
}

export interface SkillSyncItem {
  nodeId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class SkillFileManager {
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir =
      skillsDir || join(getQuikimProjectRoot(), ".quikim", "skills");
  }

  /** Get the skills root directory */
  getSkillsRoot(): string {
    return this.skillsDir;
  }

  /** Ensure skills directory exists */
  async ensureSkillsDir(): Promise<void> {
    await fs.mkdir(this.skillsDir, { recursive: true });
  }

  /** Get file path for a skill: .quikim/skills/{nodeId}_{specName}.md */
  getSkillFilePath(nodeId: string, specName: string): string {
    return join(this.skillsDir, `${nodeId}_${specName}.md`);
  }

  /** Write a single skill file with atomic write */
  async writeSkillFile(
    nodeId: string,
    specName: string,
    content: string,
  ): Promise<string> {
    await this.ensureSkillsDir();
    const filePath = this.getSkillFilePath(nodeId, specName);
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, content, "utf-8");
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        /* ignore cleanup errors */
      }
      throw error;
    }
    return filePath;
  }

  /** Read a single skill file, returns null if not found */
  async readSkillFile(
    nodeId: string,
    specName: string,
  ): Promise<string | null> {
    const filePath = this.getSkillFilePath(nodeId, specName);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /** List all locally cached skill files */
  async listLocalSkills(): Promise<LocalSkill[]> {
    const skills: LocalSkill[] = [];
    try {
      await this.ensureSkillsDir();
      const files = await fs.readdir(this.skillsDir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        // Parse: {nodeId}_{specName}.md
        const base = file.slice(0, -3);
        const underscoreIdx = base.indexOf("_");
        if (underscoreIdx < 0) continue;
        const nodeId = base.slice(0, underscoreIdx);
        const specName = base.slice(underscoreIdx + 1);
        const filePath = join(this.skillsDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        skills.push({ nodeId, specName, label: "", content, filePath });
      }
    } catch {
      /* directory may not exist */
    }
    return skills;
  }

  /** Write all skills from a bulk fetch response */
  async writeAllSkills(skills: SkillSyncItem[]): Promise<number> {
    await this.ensureSkillsDir();
    let count = 0;
    for (const skill of skills) {
      const specName =
        (skill.metadata?.specName as string) || "default";
      await this.writeSkillFile(skill.nodeId, specName, skill.content);
      count++;
    }
    return count;
  }
}
