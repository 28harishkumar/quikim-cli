/**
 * Quikim - IDE Rules Management
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import * as output from "./output.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Supported IDE configurations */
interface IDEConfig {
  name: string;
  rulesDir: string;
  fileName: string;
  sourceFile: string;
}

const IDE_CONFIGS: IDEConfig[] = [
  {
    name: "Cursor",
    rulesDir: ".cursor/rules",
    fileName: "quikim.mdc",
    sourceFile: "quikim.mdc",
  },
  {
    name: "Windsurf (Codeium)",
    rulesDir: ".windsurfrules",
    fileName: "quikim.md",
    sourceFile: "quikim.md",
  },
  {
    name: "Kiro",
    rulesDir: ".kiro/steering",
    fileName: "quikim.md",
    sourceFile: "quikim.md",
  },
  {
    name: "VS Code",
    rulesDir: ".vscode/rules",
    fileName: "quikim.md",
    sourceFile: "quikim.md",
  },
  {
    name: "Zed",
    rulesDir: ".zed/rules",
    fileName: "quikim.md",
    sourceFile: "quikim.md",
  },
  {
    name: "Claude Code",
    rulesDir: ".claude/rules",
    fileName: "quikim.md",
    sourceFile: "quikim.md",
  },
];

/** Detect which IDEs are present in the current directory */
async function detectIDEs(cwd: string): Promise<IDEConfig[]> {
  const detectedIDEs: IDEConfig[] = [];

  for (const config of IDE_CONFIGS) {
    const ideRulesPath = path.join(cwd, config.rulesDir);
    try {
      const stats = await fs.stat(ideRulesPath);
      if (stats.isDirectory()) {
        detectedIDEs.push(config);
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return detectedIDEs;
}

/** Get source rules directory from CLI package */
function getSourceRulesDir(): string {
  // From cli/src/utils/ide-rules.ts -> cli/cursorrules/
  return path.resolve(__dirname, "..", "..", "cursorrules");
}

/** Copy cursor rules to IDE-specific location */
async function copyRulesToIDE(
  cwd: string,
  config: IDEConfig,
  force: boolean = false
): Promise<boolean> {
  const sourceDir = getSourceRulesDir();
  const sourcePath = path.join(sourceDir, config.sourceFile);
  const targetDir = path.join(cwd, config.rulesDir);
  const targetPath = path.join(targetDir, config.fileName);

  try {
    // Check if source file exists
    await fs.access(sourcePath);

    // Create target directory if it doesn't exist
    await fs.mkdir(targetDir, { recursive: true });

    // Check if target file already exists
    try {
      await fs.access(targetPath);
      if (!force) {
        output.warning(
          `${config.name} rules already exist at ${path.relative(cwd, targetPath)}`
        );
        return false;
      }
    } catch {
      // File doesn't exist, proceed with copy
    }

    // Copy the file
    await fs.copyFile(sourcePath, targetPath);
    output.success(
      `Installed ${config.name} rules: ${path.relative(cwd, targetPath)}`
    );
    return true;
  } catch (error) {
    output.error(
      `Failed to copy ${config.name} rules: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/** Install cursor rules for all detected IDEs */
export async function installIDERules(
  cwd: string,
  options: { force?: boolean; all?: boolean } = {}
): Promise<void> {
  const { force = false, all = false } = options;

  output.info("Detecting IDEs in current directory...");
  
  let ideConfigs: IDEConfig[];
  
  if (all) {
    // Install rules for all supported IDEs
    ideConfigs = IDE_CONFIGS;
    output.info(`Installing rules for all supported IDEs: ${ideConfigs.map((c) => c.name).join(", ")}`);
  } else {
    // Detect and install only for existing IDEs
    ideConfigs = await detectIDEs(cwd);
    
    if (ideConfigs.length === 0) {
      output.warning("No supported IDE detected in current directory");
      output.info(`Supported IDEs: ${IDE_CONFIGS.map((c) => `${c.name} (${c.rulesDir})`).join(", ")}`);
      output.info("Run with --all flag to install rules for all supported IDEs");
      return;
    }
    
    output.success(`Detected ${ideConfigs.length} IDE(s): ${ideConfigs.map((c) => c.name).join(", ")}`);
  }

  output.separator();

  let successCount = 0;
  for (const config of ideConfigs) {
    const success = await copyRulesToIDE(cwd, config, force);
    if (success) {
      successCount++;
    }
  }

  output.separator();
  if (successCount > 0) {
    output.success(`Successfully installed rules for ${successCount} IDE(s)`);
  } else {
    output.info("No new rules were installed");
  }
}

/** Check if cursor rules are installed for detected IDEs */
export async function checkIDERules(cwd: string): Promise<void> {
  const detectedIDEs = await detectIDEs(cwd);

  if (detectedIDEs.length === 0) {
    output.warning("No supported IDE detected in current directory");
    output.info(`Supported IDEs: ${IDE_CONFIGS.map((c) => `${c.name} (${c.rulesDir})`).join(", ")}`);
    return;
  }

  output.header("IDE Rules Status");
  output.separator();

  for (const config of detectedIDEs) {
    const targetPath = path.join(cwd, config.rulesDir, config.fileName);
    try {
      await fs.access(targetPath);
      output.tableRow(config.name, "✓ Installed");
    } catch {
      output.tableRow(config.name, "✗ Not installed");
    }
  }

  output.separator();
}

/** List all supported IDEs */
export function listSupportedIDEs(): void {
  output.header("Supported IDEs");
  output.separator();

  for (const config of IDE_CONFIGS) {
    output.tableRow(config.name, `${config.rulesDir}/${config.fileName}`);
  }

  output.separator();
  output.info("Run 'quikim init' to install rules for detected IDEs");
  output.info("Run 'quikim init --all' to install rules for all supported IDEs");
}
