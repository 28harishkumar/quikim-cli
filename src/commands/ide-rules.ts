/**
 * Quikim - CLI IDE Rules Commands
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import { installIDERules, checkIDERules, listSupportedIDEs } from "../utils/ide-rules.js";

/** Install IDE rules command handler */
async function installRulesHandler(options: { all?: boolean; force?: boolean }): Promise<void> {
  const cwd = process.cwd();
  await installIDERules(cwd, { all: options.all, force: options.force });
}

/** Check IDE rules command handler */
async function checkRulesHandler(): Promise<void> {
  const cwd = process.cwd();
  await checkIDERules(cwd);
}

/** List supported IDEs command handler */
function listIDEsHandler(): void {
  listSupportedIDEs();
}

/** Create IDE rules commands */
export function createIDERulesCommands(): Command {
  const rules = new Command("rules").description("Manage IDE cursor rules");

  rules
    .command("install")
    .description("Install Quikim cursor rules for detected IDEs")
    .option("-a, --all", "Install rules for all supported IDEs (not just detected ones)")
    .option("-f, --force", "Force overwrite existing IDE rules")
    .action(installRulesHandler);

  rules
    .command("check")
    .alias("status")
    .description("Check which IDE rules are installed")
    .action(checkRulesHandler);

  rules
    .command("list")
    .alias("ls")
    .description("List all supported IDEs")
    .action(listIDEsHandler);

  return rules;
}
