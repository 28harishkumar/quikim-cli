/**
 * Quikim - CLI Project Commands
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import inquirer from "inquirer";
import { configManager, createProjectConfig } from "../config/manager.js";
import { createAPIClient } from "../api/client.js";
import { NotFoundError } from "../api/errors.js";
import * as output from "../utils/output.js";
import { installIDERules } from "../utils/ide-rules.js";
import { generateAPIStructureFile } from "../utils/api-structure.js";
import type { Project, ProjectConfig } from "../types/index.js";

/** Ensure user is authenticated */
function requireAuth(): void {
  if (!configManager.isAuthenticated()) {
    output.error("Not logged in. Run 'quikim login' to authenticate.");
    process.exit(1);
  }
}

/** Get authenticated API client for project service */
function getProjectServiceClient() {
  const auth = configManager.getAuth();
  const projectServiceUrl = configManager.getProjectServiceUrl();
  return createAPIClient(projectServiceUrl, auth?.token);
}

/** List projects command handler */
async function listProjectsHandler(options: {
  json?: boolean;
  all?: boolean;
}): Promise<void> {
  requireAuth();
  
  const spinner = output.spinner("Fetching projects...");
  spinner.start();

  try {
    const client = getProjectServiceClient();
    const projects = await client.listProjects();

    spinner.stop();

    if (projects.length === 0) {
      output.info("No projects found");
      output.separator();
      output.info('Create a new project at the Quikim dashboard or run "quikim init"');
      return;
    }

    // Filter active projects unless --all is specified
    const filteredProjects = options.all
      ? projects
      : projects.filter((p) => p.status !== "ARCHIVED");

    if (options.json) {
      output.json(filteredProjects);
      return;
    }

    output.header(`Projects (${filteredProjects.length})`);
    output.separator();

    const currentProject = configManager.getCurrentProject();

    for (const project of filteredProjects) {
      const isConnected = currentProject?.projectId === project.id;
      const prefix = isConnected ? "→ " : "  ";
      const connectedLabel = isConnected ? " (connected)" : "";
      
      console.log(
        `${prefix}${project.name}${connectedLabel}`
      );
      output.tableRow("    ID", project.id);
      output.tableRow("    Status", output.formatStatus(project.status));
      output.tableRow("    Slug", project.slug);
      output.separator();
    }
  } catch (err) {
    spinner.fail("Failed to fetch projects");
    if (err instanceof Error) {
      output.error(err.message);
    }
    process.exit(1);
  }
}

/** Connect to project command handler */
async function connectProjectHandler(
  projectIdOrSlug?: string,
  options?: { json?: boolean }
): Promise<void> {
  requireAuth();

  const spinner = output.spinner("Connecting to project...");

  try {
    const client = getProjectServiceClient();
    const auth = configManager.getAuth();

    let projectId = projectIdOrSlug;

    // If no project specified, show interactive selection
    if (!projectId) {
      spinner.text = "Fetching projects...";
      spinner.start();

      const projects = await client.listProjects();
      spinner.stop();

      if (projects.length === 0) {
        output.error("No projects available to connect");
        process.exit(1);
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedProject",
          message: "Select a project to connect:",
          choices: projects.map((p) => ({
            name: `${p.name} (${p.status})`,
            value: p.id,
          })),
        },
      ]);

      projectId = selectedProject;
    }

    spinner.text = "Connecting to project...";
    spinner.start();

    // Try to get project by ID first, then by slug
    let project: Project;
    try {
      project = await client.getProject(projectId!);
    } catch (err) {
      if (err instanceof NotFoundError && auth?.organizationId) {
        // Try by slug
        project = await client.getProjectBySlug(auth.organizationId, projectId!);
      } else {
        throw err;
      }
    }

    // Create project config (format expected by MCP server)
    const projectConfig: ProjectConfig = {
      projectId: project.id,
      organizationId: project.organizationId,
      userId: auth?.userId,
      name: project.name,
      slug: project.slug,
      latestVersion: 0,
      connectedAt: new Date().toISOString(),
    };

    // Save to global config
    configManager.setCurrentProject(projectConfig);

    // Save to local project config (.quikim/project.json for MCP server)
    const cwd = process.cwd();
    const projectConfigManager = createProjectConfig(cwd);
    await projectConfigManager.write(projectConfig);

    spinner.succeed("Connected to project");

    if (options?.json) {
      output.json(projectConfig);
      return;
    }

    output.separator();
    output.tableRow("Project", project.name);
    output.tableRow("ID", project.id);
    output.tableRow("Status", output.formatStatus(project.status));
    output.separator();
    output.success("Project configuration saved to .quikim/project.json");
  } catch (err) {
    spinner.fail("Failed to connect to project");
    if (err instanceof NotFoundError) {
      output.error("Project not found. Check the project ID or slug.");
    } else if (err instanceof Error) {
      output.error(err.message);
    }
    process.exit(1);
  }
}

/** Disconnect from project command handler */
async function disconnectProjectHandler(): Promise<void> {
  const currentProject = configManager.getCurrentProject();

  if (!currentProject) {
    output.info("No project is currently connected");
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Disconnect from "${currentProject.name}"?`,
      default: true,
    },
  ]);

  if (!confirm) {
    output.info("Disconnect cancelled");
    return;
  }

  // Clear global config
  configManager.clearCurrentProject();

  // Remove local project config
  const cwd = process.cwd();
  const projectConfigManager = createProjectConfig(cwd);
  await projectConfigManager.delete();

  output.success(`Disconnected from "${currentProject.name}"`);
}

/** Get project info command handler */
async function projectInfoHandler(options: { json?: boolean }): Promise<void> {
  requireAuth();

  const currentProject = configManager.getCurrentProject();

  if (!currentProject) {
    output.error("No project connected. Run 'quikim connect' to connect to a project.");
    process.exit(1);
  }

  const spinner = output.spinner("Fetching project details...");
  spinner.start();

  try {
    const client = getProjectServiceClient();
    const project = await client.getProject(currentProject.projectId);

    spinner.stop();

    if (options.json) {
      output.json(project);
      return;
    }

    output.header(`Project: ${project.name}`);
    output.separator();
    output.tableRow("ID", project.id);
    output.tableRow("Slug", project.slug);
    output.tableRow("Status", output.formatStatus(project.status));
    
    if (project.description) {
      output.tableRow("Description", project.description);
    }

    output.tableRow("Created", output.formatDate(project.createdAt));
    output.tableRow("Updated", output.formatDate(project.updatedAt));

    if (project.components && project.components.length > 0) {
      output.separator();
      output.header("Components");
      for (const component of project.components) {
        console.log(`  - ${component.name} (${component.type})`);
      }
    }

    if (project.team && project.team.length > 0) {
      output.separator();
      output.header("Team");
      for (const member of project.team) {
        console.log(`  - ${member.user.name || member.user.email} (${member.role})`);
      }
    }
  } catch (err) {
    spinner.fail("Failed to fetch project details");
    if (err instanceof Error) {
      output.error(err.message);
    }
    process.exit(1);
  }
}

/** Initialize project from local config */
async function initProjectHandler(options: { all?: boolean; force?: boolean }): Promise<void> {
  requireAuth();

  const cwd = process.cwd();
  
  output.header("Quikim Project Initialization");
  output.separator();

  // Step 1: Install IDE rules
  output.info("Step 1: Installing IDE rules...");
  output.separator();
  await installIDERules(cwd, { all: options.all, force: options.force });
  output.separator();

  // Step 2: Generate API structure file
  output.info("Step 2: Generating API structure cache...");
  output.separator();
  try {
    const apiStructureFile = await generateAPIStructureFile(cwd);
    output.success(`API structure file created: ${apiStructureFile}`);
    output.info("This file contains all API endpoints and schemas for faster MCP operations");
  } catch (err) {
    output.warning("Failed to generate API structure file (non-critical)");
    if (err instanceof Error) {
      output.info(`  ${err.message}`);
    }
  }
  output.separator();

  // Step 3: Connect to project
  output.info("Step 3: Connecting to project...");
  output.separator();

  const projectConfigManager = createProjectConfig(cwd);

  // Check if already initialized
  if (await projectConfigManager.exists()) {
    const config = await projectConfigManager.read();
    if (config) {
      output.info(`Already connected to project: ${config.name}`);
      
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Keep current connection", value: "keep" },
            { name: "Connect to a different project", value: "reconnect" },
          ],
        },
      ]);

      if (action === "keep") {
        output.separator();
        output.success("Initialization complete!");
        return;
      }
    }
  }

  // Connect to a project
  await connectProjectHandler();
  
  output.separator();
  output.success("Initialization complete!");
  output.separator();
  output.info("Next steps:");
  output.info("  1. Open your project in Cursor/VSCode");
  output.info("  2. MCP will use .quikim/api_structure.json for fast API operations");
  output.info("  3. Run 'quikim project info' to view project details");
}

/** Create project commands */
export function createProjectCommands(): Command {
  const project = new Command("project").description("Project management commands");

  project
    .command("list")
    .alias("ls")
    .description("List all projects")
    .option("--json", "Output as JSON")
    .option("-a, --all", "Include archived projects")
    .action(listProjectsHandler);

  project
    .command("connect [projectIdOrSlug]")
    .description("Connect to a project")
    .option("--json", "Output as JSON")
    .action(connectProjectHandler);

  project
    .command("disconnect")
    .description("Disconnect from current project")
    .action(disconnectProjectHandler);

  project
    .command("info")
    .description("Show current project information")
    .option("--json", "Output as JSON")
    .action(projectInfoHandler);

  return project;
}

/** Shortcut connect command for root level */
export function createConnectCommand(): Command {
  return new Command("connect")
    .argument("[projectIdOrSlug]", "Project ID or slug")
    .description("Connect to a project")
    .option("--json", "Output as JSON")
    .action(connectProjectHandler);
}

/** Shortcut init command for root level */
export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize Quikim in the current directory")
    .option("-a, --all", "Install rules for all supported IDEs (not just detected ones)")
    .option("-f, --force", "Force overwrite existing IDE rules")
    .action(initProjectHandler);
}
