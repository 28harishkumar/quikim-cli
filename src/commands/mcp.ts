/**
 * Quikim - CLI MCP Server Commands
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import { configManager } from "../config/manager.js";
import * as output from "../utils/output.js";
import { homedir, platform } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";

/** Cursor MCP config file path based on OS */
function getCursorMcpConfigPath(): string {
  const home = homedir();
  const os = platform();
  
  if (os === "win32") {
    return join(home, "AppData", "Roaming", "Cursor", "User", "globalStorage", "mcp.json");
  } else if (os === "darwin") {
    return join(home, ".cursor", "mcp.json");
  } else {
    // Linux
    return join(home, ".config", "cursor", "mcp.json");
  }
}

/** MCP server configuration for Cursor */
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface CursorMCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/** Start MCP server handler (called by Cursor) */
async function serveHandler(): Promise<void> {
  // Import and start the MCP server
  const { MCPCursorProtocolServer } = await import("../mcp/server.js");
  
  const server = new MCPCursorProtocolServer();
  await server.start();
}

/** Install MCP server configuration for Cursor */
async function installCursorHandler(options: { force?: boolean }): Promise<void> {
  const configPath = getCursorMcpConfigPath();
  const configDir = join(configPath, "..");
  
  output.header("Installing Quikim MCP Server for Cursor");
  output.separator();
  
  // Check authentication status
  if (!configManager.isAuthenticated()) {
    output.warning("Not logged in. MCP server will have limited functionality.");
    output.info('Run "quikim login" first for full server sync capabilities.');
    output.separator();
  }
  
  // Ensure config directory exists
  try {
    await mkdir(configDir, { recursive: true });
  } catch {
    // Directory may already exist
  }
  
  // Read existing config or create new one
  let config: CursorMCPConfig = { mcpServers: {} };
  try {
    const existingContent = await readFile(configPath, "utf-8");
    config = JSON.parse(existingContent) as CursorMCPConfig;
  } catch {
    // File doesn't exist or is invalid, use default
  }
  
  // Check if quikim already configured
  if (config.mcpServers.quikim && !options.force) {
    output.info("Quikim MCP server is already configured in Cursor.");
    output.info('Use --force to overwrite the existing configuration.');
    return;
  }
  
  // Build environment variables for MCP server
  const env: Record<string, string> = {};
  
  // Pass API URLs based on current CLI config
  if (configManager.isLocalMode()) {
    env.QUIKIM_API_BASE_URL = configManager.getProjectServiceUrl();
  } else {
    env.QUIKIM_API_BASE_URL = configManager.getApiUrl();
  }
  
  // Add quikim MCP server configuration
  config.mcpServers.quikim = {
    command: "quikim",
    args: ["mcp", "serve"],
    env: Object.keys(env).length > 0 ? env : undefined,
  };
  
  // Write config
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    output.success("Quikim MCP server configured for Cursor!");
    output.separator();
    output.tableRow("Config file", configPath);
    output.tableRow("Command", "quikim mcp serve");
    output.separator();
    output.info("Restart Cursor to activate the MCP server.");
    output.info('After restart, Quikim tools will be available in Cursor\'s AI assistant.');
  } catch (err) {
    output.error(`Failed to write config: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}

/** Uninstall MCP server configuration from Cursor */
async function uninstallCursorHandler(): Promise<void> {
  const configPath = getCursorMcpConfigPath();
  
  output.header("Uninstalling Quikim MCP Server from Cursor");
  output.separator();
  
  // Read existing config
  let config: CursorMCPConfig;
  try {
    const existingContent = await readFile(configPath, "utf-8");
    config = JSON.parse(existingContent) as CursorMCPConfig;
  } catch {
    output.info("No Cursor MCP configuration found.");
    return;
  }
  
  // Check if quikim is configured
  if (!config.mcpServers.quikim) {
    output.info("Quikim MCP server is not configured in Cursor.");
    return;
  }
  
  // Remove quikim configuration
  delete config.mcpServers.quikim;
  
  // Write config
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    output.success("Quikim MCP server removed from Cursor configuration.");
    output.info("Restart Cursor to apply changes.");
  } catch (err) {
    output.error(`Failed to write config: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}

/** Show MCP server status */
async function statusHandler(): Promise<void> {
  const configPath = getCursorMcpConfigPath();
  
  output.header("Quikim MCP Server Status");
  output.separator();
  
  // Check Cursor configuration
  let cursorConfigured = false;
  try {
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content) as CursorMCPConfig;
    cursorConfigured = !!config.mcpServers?.quikim;
  } catch {
    // Config doesn't exist
  }
  
  output.tableRow("Cursor configured", cursorConfigured ? "Yes" : "No");
  output.tableRow("Config path", configPath);
  output.separator();
  
  // Check authentication
  const isAuthenticated = configManager.isAuthenticated();
  const auth = configManager.getAuth();
  
  output.tableRow("Authenticated", isAuthenticated ? "Yes" : "No");
  if (isAuthenticated && auth) {
    output.tableRow("User", auth.email);
  }
  output.separator();
  
  // Check current project
  const project = configManager.getCurrentProject();
  if (project) {
    output.tableRow("Connected project", project.name);
    output.tableRow("Project ID", project.projectId);
  } else {
    output.tableRow("Connected project", "None");
  }
  output.separator();
  
  // API configuration
  output.tableRow("API URL", configManager.getApiUrl());
  output.tableRow("Local mode", configManager.isLocalMode() ? "Yes" : "No");
  
  if (!cursorConfigured) {
    output.separator();
    output.info('Run "quikim mcp install-cursor" to configure Cursor.');
  }
  
  if (!isAuthenticated) {
    output.separator();
    output.info('Run "quikim login" to authenticate with Quikim.');
  }
  
  if (!project) {
    output.separator();
    output.info('Run "quikim connect" to connect to a project.');
  }
}

/** Create MCP commands */
export function createMCPCommands(): Command {
  const mcp = new Command("mcp").description("MCP server management commands");

  mcp
    .command("serve")
    .description("Start the MCP server (used by Cursor)")
    .action(serveHandler);

  mcp
    .command("install-cursor")
    .description("Configure Quikim MCP server in Cursor IDE")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installCursorHandler);

  mcp
    .command("uninstall-cursor")
    .description("Remove Quikim MCP server from Cursor IDE")
    .action(uninstallCursorHandler);

  mcp
    .command("status")
    .description("Show MCP server status and configuration")
    .action(statusHandler);

  return mcp;
}
