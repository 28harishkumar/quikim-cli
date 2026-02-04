/**
 * Quikim - CLI MCP Server Commands
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import { configManager } from "../config/manager.js";
import * as output from "../utils/output.js";
import { homedir, platform } from "os";
import { join, dirname, resolve } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { cwd } from "process";
import chalk from "chalk";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

/** Supported editor types */
type EditorType = "cursor" | "kiro" | "windsurf" | "zed" | "vscode" | "claude-code" | "claude-desktop";

/** MCP server configuration */
interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** Editor configuration interface */
interface EditorConfig {
  name: string;
  getConfigPath: () => string;
  getConfigDir: () => string;
  readConfig: (path: string) => Promise<unknown>;
  writeConfig: (path: string, config: unknown) => Promise<void>;
  isProjectLevel?: boolean;
}

/** Cursor MCP config structure */
interface CursorMCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/** VS Code MCP config structure */
interface VSCodeMCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/** Zed settings structure */
interface ZedSettings {
  mcp?: {
    servers?: Record<string, MCPServerConfig>;
  };
  [key: string]: unknown;
}

/** Windsurf MCP config structure */
interface WindsurfMCPConfig {
  servers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

/** Kiro MCP config structure */
interface KiroMCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

/** Claude Code config structure */
interface ClaudeCodeConfig {
  mcp?: {
    servers?: Record<string, MCPServerConfig>;
  };
  [key: string]: unknown;
}

/** Claude Desktop config structure (claude_desktop_config.json) */
interface ClaudeDesktopConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

/** Server key used in Claude Desktop config for Quikim MCP */
const CLAUDE_DESKTOP_QUIKIM_SERVER_KEY = "quikim-mcp-server";

/** Get editor configuration based on editor type */
function getEditorConfig(editor: EditorType): EditorConfig {
  const home = homedir();
  const os = platform();
  const projectRoot = cwd();

  const configs: Record<EditorType, EditorConfig> = {
    cursor: {
      name: "Cursor",
      getConfigPath: () => {
        if (os === "win32") {
          return join(home, "AppData", "Roaming", "Cursor", "User", "globalStorage", "mcp.json");
        } else if (os === "darwin") {
          return join(home, ".cursor", "mcp.json");
        } else {
          return join(home, ".config", "cursor", "mcp.json");
        }
      },
      getConfigDir: () => {
        const path = configs.cursor.getConfigPath();
        return join(path, "..");
      },
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as CursorMCPConfig;
        } catch {
          return { mcpServers: {} } as CursorMCPConfig;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: false,
    },
    kiro: {
      name: "Kiro",
      getConfigPath: () => join(projectRoot, ".kiro", "settings", "mcp.json"),
      getConfigDir: () => join(projectRoot, ".kiro", "settings"),
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as KiroMCPConfig;
        } catch {
          return { mcpServers: {} } as KiroMCPConfig;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: true,
    },
    windsurf: {
      name: "Windsurf",
      getConfigPath: () => {
        if (os === "win32") {
          return join(home, ".codeium", "windsurf", "mcp_config.json");
        } else {
          return join(home, ".codeium", "windsurf", "mcp_config.json");
        }
      },
      getConfigDir: () => {
        const path = configs.windsurf.getConfigPath();
        return join(path, "..");
      },
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as WindsurfMCPConfig;
        } catch {
          return { servers: {} } as WindsurfMCPConfig;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: false,
    },
    zed: {
      name: "Zed",
      getConfigPath: () => {
        if (os === "win32") {
          return join(home, "AppData", "Roaming", "Zed", "settings.json");
        } else {
          return join(home, ".config", "zed", "settings.json");
        }
      },
      getConfigDir: () => {
        const path = configs.zed.getConfigPath();
        return join(path, "..");
      },
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as ZedSettings;
        } catch {
          return {} as ZedSettings;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: false,
    },
    vscode: {
      name: "VS Code",
      getConfigPath: () => {
        if (os === "win32") {
          return join(home, "AppData", "Roaming", "Code", "User", "mcp.json");
        } else if (os === "darwin") {
          return join(home, "Library", "Application Support", "Code", "User", "mcp.json");
        } else {
          return join(home, ".config", "Code", "User", "mcp.json");
        }
      },
      getConfigDir: () => {
        const path = configs.vscode.getConfigPath();
        return join(path, "..");
      },
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as VSCodeMCPConfig;
        } catch {
          return { mcpServers: {} } as VSCodeMCPConfig;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: false,
    },
    "claude-code": {
      name: "Claude Code",
      getConfigPath: () => join(home, ".claude.json"),
      getConfigDir: () => home,
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as ClaudeCodeConfig;
        } catch {
          return {} as ClaudeCodeConfig;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: false,
    },
    "claude-desktop": {
      name: "Claude Desktop",
      getConfigPath: () => {
        if (os === "win32") {
          return join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
        }
        if (os === "darwin") {
          return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
        }
        return join(home, ".config", "Claude", "claude_desktop_config.json");
      },
      getConfigDir: () => {
        if (os === "win32") {
          return join(home, "AppData", "Roaming", "Claude");
        }
        if (os === "darwin") {
          return join(home, "Library", "Application Support", "Claude");
        }
        return join(home, ".config", "Claude");
      },
      readConfig: async (path: string) => {
        try {
          const content = await readFile(path, "utf-8");
          return JSON.parse(content) as ClaudeDesktopConfig;
        } catch {
          return { mcpServers: {} } as ClaudeDesktopConfig;
        }
      },
      writeConfig: async (path: string, config: unknown) => {
        await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
      },
      isProjectLevel: false,
    },
  };

  return configs[editor];
}

/** Find the quikim binary path */
function findQuikimBinary(): { command: string; args: string[] } {
  try {
    // Try to find quikim in PATH
    if (platform() === "win32") {
      const result = execSync("where quikim", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      const path = result.trim().split("\n")[0];
      if (path && existsSync(path)) {
        return { command: path, args: ["mcp", "serve"] };
      }
    } else {
      const result = execSync("which quikim", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      const path = result.trim();
      if (path && existsSync(path)) {
        return { command: path, args: ["mcp", "serve"] };
      }
    }
  } catch {
    // which/where command failed, try alternative methods
  }

  // Try npm's global bin directory
  try {
    const npmPrefix = execSync("npm config get prefix", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (npmPrefix) {
      const globalBin = platform() === "win32" 
        ? join(npmPrefix, "quikim.cmd")
        : join(npmPrefix, "bin", "quikim");
      if (existsSync(globalBin)) {
        return { command: globalBin, args: ["mcp", "serve"] };
      }
    }
  } catch {
    // npm config failed
  }

  // Fallback: try to use node with the current script
  // This works when quikim is installed via npm link or in development
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const cliDir = dirname(dirname(dirname(currentFile)));
    const distIndex = join(cliDir, "dist", "index.js");
    // Check if the file exists synchronously
    if (existsSync(distIndex)) {
      return { command: process.execPath, args: [distIndex, "mcp", "serve"] };
    }
  } catch {
    // Fallback failed
  }

  // Last resort: return "quikim" and hope it's in PATH
  // The user will need to ensure quikim is in their PATH
  return { command: "quikim", args: ["mcp", "serve"] };
}

/**
 * Get absolute path to CLI dist/index.js for Claude Desktop (node + path).
 * @returns Absolute path to cli/dist/index.js or empty string if not found
 */
function getClaudeDesktopCliPath(): string {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const cliDir = dirname(dirname(dirname(currentFile)));
    const distIndex = join(cliDir, "dist", "index.js");
    if (existsSync(distIndex)) {
      return distIndex;
    }
  } catch {
    // Fallback failed
  }
  return "";
}

/**
 * Get MCP server config for Claude Desktop with auth token and project dir in env.
 * @param projectDir - Absolute path to project root (where .quikim lives)
 * @param apiKey - Quikim API token from auth
 * @returns MCPServerConfig for claude_desktop_config.json
 */
function getClaudeDesktopMCPServerConfig(projectDir: string, apiKey: string): MCPServerConfig {
  const cliPath = getClaudeDesktopCliPath();
  const command = cliPath ? process.execPath : "node";
  const args = cliPath ? [cliPath, "mcp", "serve"] : ["mcp", "serve"];
  if (!cliPath) {
    // If no dist path, use quikim from PATH
    const { command: cmd, args: a } = findQuikimBinary();
    return getClaudeDesktopMCPServerConfigFromCommand(projectDir, apiKey, cmd, a);
  }
  return getClaudeDesktopMCPServerConfigFromCommand(projectDir, apiKey, command, args);
}

/**
 * Build Claude Desktop MCP env and config from command/args.
 */
function getClaudeDesktopMCPServerConfigFromCommand(
  projectDir: string,
  apiKey: string,
  command: string,
  args: string[]
): MCPServerConfig {
  const env: Record<string, string> = {
    QUIKIM_MCP_SILENT: "1",
    QUIKIM_PROJECT_DIR: projectDir,
    QUIKIM_API_KEY: apiKey,
  };
  if (configManager.isLocalMode()) {
    env.QUIKIM_API_BASE_URL = configManager.getProjectServiceUrl();
    env.QUIKIM_WORKFLOW_SERVICE_URL = configManager.getWorkflowServiceUrl();
  } else {
    env.QUIKIM_API_BASE_URL = configManager.getApiUrl();
  }
  return { command, args, env };
}

/** Get MCP server configuration */
function getMCPServerConfig(): MCPServerConfig {
  const env: Record<string, string> = {};

  // Pass API URLs based on current CLI config
  if (configManager.isLocalMode()) {
    env.QUIKIM_API_BASE_URL = configManager.getProjectServiceUrl();
    env.QUIKIM_WORKFLOW_SERVICE_URL = configManager.getWorkflowServiceUrl();
  } else {
    env.QUIKIM_API_BASE_URL = configManager.getApiUrl();
  }

  // Find the quikim binary path
  const { command, args } = findQuikimBinary();

  return {
    command,
    args,
    env: Object.keys(env).length > 0 ? env : undefined,
  };
}

/** Check if Quikim is configured in editor config */
function isQuikimConfigured(config: unknown, editor: EditorType): boolean {
  if (editor === "cursor" || editor === "vscode" || editor === "kiro") {
    const c = config as CursorMCPConfig | VSCodeMCPConfig | KiroMCPConfig;
    return !!(c.mcpServers && c.mcpServers.quikim);
  } else if (editor === "windsurf") {
    const c = config as WindsurfMCPConfig;
    return !!(c.servers && c.servers.quikim);
  } else if (editor === "zed") {
    const c = config as ZedSettings;
    return !!(c.mcp && c.mcp.servers && c.mcp.servers.quikim);
  } else if (editor === "claude-code") {
    const c = config as ClaudeCodeConfig;
    return !!(c.mcp && c.mcp.servers && c.mcp.servers.quikim);
  } else if (editor === "claude-desktop") {
    const c = config as ClaudeDesktopConfig;
    return !!(c.mcpServers && c.mcpServers[CLAUDE_DESKTOP_QUIKIM_SERVER_KEY]);
  }
  return false;
}

/** Add Quikim to editor config */
function addQuikimToConfig(
  config: unknown,
  editor: EditorType,
  options?: { projectDir?: string; apiKey?: string }
): unknown {
  if (editor === "claude-desktop" && options?.projectDir && options?.apiKey) {
    const c = config as ClaudeDesktopConfig;
    if (!c.mcpServers) {
      c.mcpServers = {};
    }
    c.mcpServers[CLAUDE_DESKTOP_QUIKIM_SERVER_KEY] = getClaudeDesktopMCPServerConfig(
      options.projectDir,
      options.apiKey
    );
    return c;
  }

  const serverConfig = getMCPServerConfig();

  if (editor === "cursor" || editor === "vscode" || editor === "kiro") {
    const c = config as CursorMCPConfig | VSCodeMCPConfig | KiroMCPConfig;
    if (!c.mcpServers) {
      c.mcpServers = {};
    }
    c.mcpServers.quikim = serverConfig;
    return c;
  } else if (editor === "windsurf") {
    const c = config as WindsurfMCPConfig;
    if (!c.servers) {
      c.servers = {};
    }
    c.servers.quikim = serverConfig;
    return c;
  } else if (editor === "zed") {
    const c = config as ZedSettings;
    if (!c.mcp) {
      c.mcp = {};
    }
    if (!c.mcp.servers) {
      c.mcp.servers = {};
    }
    c.mcp.servers.quikim = serverConfig;
    return c;
  } else if (editor === "claude-code") {
    const c = config as ClaudeCodeConfig;
    if (!c.mcp) {
      c.mcp = {};
    }
    if (!c.mcp.servers) {
      c.mcp.servers = {};
    }
    c.mcp.servers.quikim = serverConfig;
    return c;
  }
  return config;
}

/** Remove Quikim from editor config */
function removeQuikimFromConfig(config: unknown, editor: EditorType): unknown {
  if (editor === "cursor" || editor === "vscode" || editor === "kiro") {
    const c = config as CursorMCPConfig | VSCodeMCPConfig | KiroMCPConfig;
    if (c.mcpServers && c.mcpServers.quikim) {
      delete c.mcpServers.quikim;
    }
    return c;
  } else if (editor === "windsurf") {
    const c = config as WindsurfMCPConfig;
    if (c.servers && c.servers.quikim) {
      delete c.servers.quikim;
    }
    return c;
  } else if (editor === "zed") {
    const c = config as ZedSettings;
    if (c.mcp && c.mcp.servers && c.mcp.servers.quikim) {
      delete c.mcp.servers.quikim;
    }
    return c;
  } else if (editor === "claude-code") {
    const c = config as ClaudeCodeConfig;
    if (c.mcp && c.mcp.servers && c.mcp.servers.quikim) {
      delete c.mcp.servers.quikim;
    }
    return c;
  } else if (editor === "claude-desktop") {
    const c = config as ClaudeDesktopConfig;
    if (c.mcpServers && c.mcpServers[CLAUDE_DESKTOP_QUIKIM_SERVER_KEY]) {
      delete c.mcpServers[CLAUDE_DESKTOP_QUIKIM_SERVER_KEY];
    }
    return c;
  }
  return config;
}

/** Start MCP server handler (called by any editor) */
async function serveHandler(): Promise<void> {
  // Import and start the MCP server
  const { MCPCursorProtocolServer } = await import("../mcp/server.js");
  
  const server = new MCPCursorProtocolServer();
  await server.start();
}

/** Install MCP server configuration for an editor */
async function installEditorHandler(
  editor: EditorType,
  options: { force?: boolean; projectDir?: string }
): Promise<void> {
  const editorConfig = getEditorConfig(editor);
  const configPath = editorConfig.getConfigPath();
  const configDir = editorConfig.getConfigDir();

  output.header(`Installing Quikim MCP Server for ${editorConfig.name}`);
  output.separator();

  // Claude Desktop requires auth and project dir (written into config env)
  if (editor === "claude-desktop") {
    if (!configManager.isAuthenticated()) {
      output.error("Not logged in. Claude Desktop needs your API token in config.");
      output.info('Run "quikim login" first, then run this command from your project root.');
      process.exit(1);
    }
    const auth = configManager.getAuth();
    if (!auth?.token) {
      output.error("No auth token found. Run \"quikim login\" first.");
      process.exit(1);
    }
  } else {
    // Check authentication status for other editors
    if (!configManager.isAuthenticated()) {
      output.warning("Not logged in. MCP server will have limited functionality.");
      output.info('Run "quikim login" first for full server sync capabilities.');
      output.separator();
    }
  }

  // Ensure config directory exists
  try {
    await mkdir(configDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Read existing config or create new one
  let config = await editorConfig.readConfig(configPath);

  // Check if quikim already configured
  if (isQuikimConfigured(config, editor) && !options.force) {
    output.info(`Quikim MCP server is already configured in ${editorConfig.name}.`);
    output.info('Use --force to overwrite the existing configuration.');
    return;
  }

  // Add quikim MCP server configuration (with auth/projectDir for Claude Desktop)
  const rawProjectDir = (options as { force?: boolean; projectDir?: string }).projectDir;
  const projectDirForClaude = rawProjectDir ? resolve(rawProjectDir) : cwd();
  const addOptions =
    editor === "claude-desktop" && configManager.getAuth()?.token
      ? { projectDir: projectDirForClaude, apiKey: configManager.getAuth()!.token }
      : undefined;
  config = addQuikimToConfig(config, editor, addOptions);
  
  // Write config
  try {
    await editorConfig.writeConfig(configPath, config);
    output.success(`Quikim MCP server configured for ${editorConfig.name}!`);
    output.separator();
    output.tableRow("Config file", configPath);
    output.tableRow("Command", "quikim mcp serve");
    if (editor === "claude-desktop" && addOptions?.projectDir) {
      output.tableRow("Project dir", addOptions.projectDir);
      output.tableRow("Auth", "Token written to config env");
    }
    output.separator();
    output.info(`Restart ${editorConfig.name} to activate the MCP server.`);
    output.info(`After restart, Quikim tools will be available in ${editorConfig.name}'s AI assistant.`);
    if (editorConfig.isProjectLevel) {
      output.warning(`Note: This is a project-level configuration. The config file is in your project directory.`);
    }
  } catch (err) {
    output.error(`Failed to write config: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}

/** Uninstall MCP server configuration from an editor */
async function uninstallEditorHandler(editor: EditorType): Promise<void> {
  const editorConfig = getEditorConfig(editor);
  const configPath = editorConfig.getConfigPath();
  
  output.header(`Uninstalling Quikim MCP Server from ${editorConfig.name}`);
  output.separator();
  
  // Read existing config
  let config;
  try {
    config = await editorConfig.readConfig(configPath);
  } catch {
    output.info(`No ${editorConfig.name} MCP configuration found.`);
    return;
  }
  
  // Check if quikim is configured
  if (!isQuikimConfigured(config, editor)) {
    output.info(`Quikim MCP server is not configured in ${editorConfig.name}.`);
    return;
  }
  
  // Remove quikim configuration
  config = removeQuikimFromConfig(config, editor);
  
  // Write config
  try {
    await editorConfig.writeConfig(configPath, config);
    output.success(`Quikim MCP server removed from ${editorConfig.name} configuration.`);
    output.info(`Restart ${editorConfig.name} to apply changes.`);
  } catch (err) {
    output.error(`Failed to write config: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}

/** Install handler for specific editor */
async function installCursorHandler(options: { force?: boolean }): Promise<void> {
  return installEditorHandler("cursor", options);
}

async function installKiroHandler(options: { force?: boolean }): Promise<void> {
  return installEditorHandler("kiro", options);
}

async function installWindsurfHandler(options: { force?: boolean }): Promise<void> {
  return installEditorHandler("windsurf", options);
}

async function installZedHandler(options: { force?: boolean }): Promise<void> {
  return installEditorHandler("zed", options);
}

async function installVSCodeHandler(options: { force?: boolean }): Promise<void> {
  return installEditorHandler("vscode", options);
}

async function installClaudeCodeHandler(options: { force?: boolean }): Promise<void> {
  return installEditorHandler("claude-code", options);
}

/** Install Claude Desktop config (requires auth; uses cwd or --project-dir as project dir) */
async function installClaudeDesktopHandler(options: {
  force?: boolean;
  projectDir?: string;
}): Promise<void> {
  return installEditorHandler("claude-desktop", options);
}

/** Uninstall handler for specific editor */
async function uninstallCursorHandler(): Promise<void> {
  return uninstallEditorHandler("cursor");
}

async function uninstallKiroHandler(): Promise<void> {
  return uninstallEditorHandler("kiro");
}

async function uninstallWindsurfHandler(): Promise<void> {
  return uninstallEditorHandler("windsurf");
}

async function uninstallZedHandler(): Promise<void> {
  return uninstallEditorHandler("zed");
}

async function uninstallVSCodeHandler(): Promise<void> {
  return uninstallEditorHandler("vscode");
}

async function uninstallClaudeCodeHandler(): Promise<void> {
  return uninstallEditorHandler("claude-code");
}

async function uninstallClaudeDesktopHandler(): Promise<void> {
  return uninstallEditorHandler("claude-desktop");
}

/** Show MCP server status */
async function statusHandler(): Promise<void> {
  output.header("Quikim MCP Server Status");
  output.separator();
  
  // Check all editor configurations
  const editors: EditorType[] = [
    "cursor",
    "kiro",
    "windsurf",
    "zed",
    "vscode",
    "claude-code",
    "claude-desktop",
  ];
  const editorStatus: Array<{ name: string; configured: boolean; path: string }> = [];
  
  for (const editor of editors) {
    const editorConfig = getEditorConfig(editor);
    const configPath = editorConfig.getConfigPath();
    let configured = false;
    
    try {
      const config = await editorConfig.readConfig(configPath);
      configured = isQuikimConfigured(config, editor);
    } catch {
      // Config doesn't exist
    }
    
    editorStatus.push({
      name: editorConfig.name,
      configured,
      path: configPath,
    });
  }
  
  output.info("Editor Configurations:");
  for (const status of editorStatus) {
    const statusText = status.configured ? chalk.green("Yes") : chalk.gray("No");
    output.tableRow(`${status.name}`, statusText);
    if (status.configured) {
      output.tableRow(`  Config path`, status.path);
    }
  }
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
  output.separator();
  
  // Show installation suggestions
  const configuredEditors = editorStatus.filter(e => e.configured);
  if (configuredEditors.length === 0) {
    output.info("No editors configured. Install for your editor:");
    output.info('  quikim mcp install-cursor     - Install for Cursor');
    output.info('  quikim mcp install-kiro       - Install for Kiro');
    output.info('  quikim mcp install-windsurf   - Install for Windsurf');
    output.info('  quikim mcp install-zed        - Install for Zed');
    output.info('  quikim mcp install-vscode      - Install for VS Code');
    output.info('  quikim mcp install-claude-code - Install for Claude Code');
    output.info('  quikim mcp install-claude-desktop - Install for Claude Desktop app');
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
    .description("Start the MCP server (used by supported editors)")
    .action(serveHandler);

  // Install commands for each editor
  mcp
    .command("install-cursor")
    .description("Configure Quikim MCP server in Cursor IDE")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installCursorHandler);

  mcp
    .command("install-kiro")
    .description("Configure Quikim MCP server in Kiro IDE")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installKiroHandler);

  mcp
    .command("install-windsurf")
    .description("Configure Quikim MCP server in Windsurf IDE")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installWindsurfHandler);

  mcp
    .command("install-zed")
    .description("Configure Quikim MCP server in Zed Editor")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installZedHandler);

  mcp
    .command("install-vscode")
    .description("Configure Quikim MCP server in VS Code")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installVSCodeHandler);

  mcp
    .command("install-claude-code")
    .description("Configure Quikim MCP server in Claude Code")
    .option("-f, --force", "Overwrite existing configuration")
    .action(installClaudeCodeHandler);

  mcp
    .command("install-claude-desktop")
    .description(
      "Configure Quikim MCP server in Claude Desktop app (writes auth token and project dir to config)"
    )
    .option("-f, --force", "Overwrite existing configuration")
    .option(
      "--project-dir <path>",
      "Project root path (default: current directory). Use if not running from project root."
    )
    .action(installClaudeDesktopHandler);

  // Uninstall commands for each editor
  mcp
    .command("uninstall-cursor")
    .description("Remove Quikim MCP server from Cursor IDE")
    .action(uninstallCursorHandler);

  mcp
    .command("uninstall-kiro")
    .description("Remove Quikim MCP server from Kiro IDE")
    .action(uninstallKiroHandler);

  mcp
    .command("uninstall-windsurf")
    .description("Remove Quikim MCP server from Windsurf IDE")
    .action(uninstallWindsurfHandler);

  mcp
    .command("uninstall-zed")
    .description("Remove Quikim MCP server from Zed Editor")
    .action(uninstallZedHandler);

  mcp
    .command("uninstall-vscode")
    .description("Remove Quikim MCP server from VS Code")
    .action(uninstallVSCodeHandler);

  mcp
    .command("uninstall-claude-code")
    .description("Remove Quikim MCP server from Claude Code")
    .action(uninstallClaudeCodeHandler);

  mcp
    .command("uninstall-claude-desktop")
    .description("Remove Quikim MCP server from Claude Desktop app")
    .action(uninstallClaudeDesktopHandler);

  mcp
    .command("status")
    .description("Show MCP server status and configuration for all editors")
    .action(statusHandler);

  return mcp;
}
