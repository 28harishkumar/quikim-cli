#!/usr/bin/env node
/**
 * Quikim - CLI Entry Point
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import { CLI_VERSION, CLI_NAME } from "./config/constants.js";
import {
  createAuthCommands,
  createLoginCommand,
  createLogoutCommand,
  createWhoamiCommand,
} from "./commands/auth.js";
import {
  createProjectCommands,
  createConnectCommand,
  createInitCommand,
} from "./commands/project.js";
import { createConfigCommands } from "./commands/config.js";
import { createMCPCommands } from "./commands/mcp.js";
import { createIDERulesCommands } from "./commands/ide-rules.js";
import { createArtifactCommands } from "./commands/artifacts.js";
import * as output from "./utils/output.js";

/** Main CLI program */
const program = new Command();

program
  .name(CLI_NAME)
  .description("Quikim CLI - Manage Quikim projects from the command line")
  .version(CLI_VERSION, "-v, --version", "Show CLI version");

// Add shortcut commands at root level
program.addCommand(createLoginCommand());
program.addCommand(createLogoutCommand());
program.addCommand(createWhoamiCommand());
program.addCommand(createConnectCommand());
program.addCommand(createInitCommand());

// Add grouped commands
program.addCommand(createAuthCommands());
program.addCommand(createProjectCommands());
program.addCommand(createConfigCommands());
program.addCommand(createMCPCommands());
program.addCommand(createIDERulesCommands());

// Add artifact commands at root level
createArtifactCommands(program);

// Add status command at root level
program
  .command("status")
  .description("Show current session and project status")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    const { configManager } = await import("./config/manager.js");
    
    const auth = configManager.getAuth();
    const currentProject = configManager.getCurrentProject();
    const isAuthenticated = configManager.isAuthenticated();

    if (options.json) {
      output.json({
        authenticated: isAuthenticated,
        user: auth
          ? { id: auth.userId, email: auth.email }
          : null,
        organization: auth?.organizationId
          ? { id: auth.organizationId, name: auth.organizationName }
          : null,
        project: currentProject || null,
      });
      return;
    }

    output.header("Quikim CLI Status");
    output.separator();

    if (isAuthenticated && auth) {
      output.success(`Logged in as ${auth.email}`);
      if (auth.organizationName) {
        output.tableRow("Organization", auth.organizationName);
      }
    } else {
      output.warning("Not logged in");
      output.info('Run "quikim login" to authenticate');
    }

    output.separator();

    if (currentProject) {
      output.success(`Connected to project: ${currentProject.name}`);
      output.tableRow("Project ID", currentProject.projectId);
      output.tableRow("Slug", currentProject.slug);
    } else {
      output.warning("No project connected");
      output.info('Run "quikim connect" to connect to a project');
    }
  });

// Handle unknown commands
program.on("command:*", () => {
  output.error(`Invalid command: ${program.args.join(" ")}`);
  output.info(`Run "quikim --help" to see available commands`);
  process.exit(1);
});

// Parse and run
program.parseAsync(process.argv).catch((err: Error) => {
  output.error(err.message);
  process.exit(1);
});
