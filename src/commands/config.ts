/**
 * Quikim - CLI Configuration Commands
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import inquirer from "inquirer";
import { configManager } from "../config/manager.js";
import { createAPIClient } from "../api/client.js";
import {
  DEFAULT_API_URL,
  LOCAL_USER_SERVICE_URL,
  LOCAL_PROJECT_SERVICE_URL,
} from "../config/constants.js";
import * as output from "../utils/output.js";

/** Set config value */
async function setConfigHandler(key: string, value: string): Promise<void> {
  switch (key) {
    case "api-url":
      configManager.setApiUrl(value);
      output.success(`API URL set to: ${value}`);
      break;
    case "user-service-url":
      configManager.setUserServiceUrl(value);
      output.success(`User service URL set to: ${value}`);
      break;
    case "project-service-url":
      configManager.setProjectServiceUrl(value);
      output.success(`Project service URL set to: ${value}`);
      break;
    default:
      output.error(`Unknown config key: ${key}`);
      output.info("Available keys: api-url, user-service-url, project-service-url");
      process.exit(1);
  }
}

/** Get config value */
async function getConfigHandler(key: string): Promise<void> {
  switch (key) {
    case "api-url":
      output.info(configManager.getApiUrl());
      break;
    case "user-service-url":
      output.info(configManager.getUserServiceUrl());
      break;
    case "project-service-url":
      output.info(configManager.getProjectServiceUrl());
      break;
    default:
      output.error(`Unknown config key: ${key}`);
      output.info("Available keys: api-url, user-service-url, project-service-url");
      process.exit(1);
  }
}

/** Show all config */
async function showConfigHandler(options: { json?: boolean }): Promise<void> {
  const auth = configManager.getAuth();
  const currentProject = configManager.getCurrentProject();
  const isLocal = configManager.isLocalMode();

  const config = {
    mode: isLocal ? "local" : "production",
    userServiceUrl: configManager.getUserServiceUrl(),
    projectServiceUrl: configManager.getProjectServiceUrl(),
    authenticated: configManager.isAuthenticated(),
    user: auth
      ? {
          userId: auth.userId,
          email: auth.email,
          organizationId: auth.organizationId,
          organizationName: auth.organizationName,
        }
      : null,
    currentProject: currentProject || null,
    configPath: configManager.getConfigPath(),
  };

  if (options.json) {
    output.json(config);
    return;
  }

  output.header("CLI Configuration");
  output.separator();
  output.tableRow("Mode", isLocal ? "Local Development" : "Production");
  output.tableRow("User Service", configManager.getUserServiceUrl());
  output.tableRow("Project Service", configManager.getProjectServiceUrl());
  output.tableRow("Authenticated", auth ? "Yes" : "No");
  
  if (auth) {
    output.tableRow("User Email", auth.email);
    if (auth.organizationName) {
      output.tableRow("Organization", auth.organizationName);
    }
  }

  if (currentProject) {
    output.separator();
    output.tableRow("Current Project", currentProject.name);
    output.tableRow("Project ID", currentProject.projectId);
  }

  output.separator();
  output.tableRow("Config File", configManager.getConfigPath());
}

/** Reset config */
async function resetConfigHandler(): Promise<void> {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "This will reset all CLI configuration. Continue?",
      default: false,
    },
  ]);

  if (!confirm) {
    output.info("Reset cancelled");
    return;
  }

  configManager.reset();
  output.success("Configuration reset to defaults");
}

/** Use local development API */
async function useLocalHandler(): Promise<void> {
  configManager.setLocalMode();
  
  output.success("Switched to local development mode");
  output.tableRow("User Service", LOCAL_USER_SERVICE_URL);
  output.tableRow("Project Service", LOCAL_PROJECT_SERVICE_URL);
  output.separator();
  
  // Test connections
  const spinner = output.spinner("Testing connections...");
  spinner.start();
  
  const userClient = createAPIClient(LOCAL_USER_SERVICE_URL);
  const projectClient = createAPIClient(LOCAL_PROJECT_SERVICE_URL);
  
  const [userHealthy, projectHealthy] = await Promise.all([
    userClient.healthCheck(),
    projectClient.healthCheck(),
  ]);
  
  spinner.stop();
  
  if (userHealthy) {
    output.success("User service: Connected");
  } else {
    output.warning("User service: Not responding (port 8001)");
  }
  
  if (projectHealthy) {
    output.success("Project service: Connected");
  } else {
    output.warning("Project service: Not responding (port 8002)");
  }
  
  if (!userHealthy || !projectHealthy) {
    output.separator();
    output.info("Start services with: npm run dev (in respective service directories)");
  }
}

/** Use production API */
async function useProductionHandler(): Promise<void> {
  configManager.setProductionMode();
  output.success(`Switched to production mode: ${DEFAULT_API_URL}`);
}

/** Create config commands */
export function createConfigCommands(): Command {
  const config = new Command("config").description("CLI configuration commands");

  config
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action(setConfigHandler);

  config
    .command("get <key>")
    .description("Get a configuration value")
    .action(getConfigHandler);

  config
    .command("show")
    .description("Show all configuration")
    .option("--json", "Output as JSON")
    .action(showConfigHandler);

  config
    .command("reset")
    .description("Reset configuration to defaults")
    .action(resetConfigHandler);

  config
    .command("use-local")
    .description("Use local development services (user:8001, project:8002)")
    .action(useLocalHandler);

  config
    .command("use-production")
    .description("Use production API")
    .action(useProductionHandler);

  return config;
}
