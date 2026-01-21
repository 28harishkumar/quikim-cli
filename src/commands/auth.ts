/**
 * Quikim - CLI Authentication Commands
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
import { AuthenticationError } from "../api/errors.js";
import * as output from "../utils/output.js";
import type { AuthConfig } from "../types/index.js";

/** Parse JWT token to extract expiration */
function parseJwtExpiration(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    if (payload.exp) {
      return new Date(payload.exp * 1000).toISOString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Login command handler */
async function loginHandler(options: { email?: string }): Promise<void> {
  const spinner = output.spinner("Authenticating...");
  
  try {
    // Check if already logged in
    if (configManager.isAuthenticated()) {
      const auth = configManager.getAuth();
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `You are already logged in as ${auth?.email}. Continue to re-login?`,
          default: false,
        },
      ]);
      
      if (!confirm) {
        output.info("Login cancelled");
        return;
      }
    }

    // Prompt for credentials
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "email",
        message: "Email:",
        default: options.email,
        validate: (input: string) => {
          if (!input || !input.includes("@")) {
            return "Please enter a valid email address";
          }
          return true;
        },
      },
      {
        type: "password",
        name: "password",
        message: "Password:",
        mask: "*",
        validate: (input: string) => {
          if (!input || input.length < 6) {
            return "Password must be at least 6 characters";
          }
          return true;
        },
      },
    ]);

    spinner.start();

    const userServiceUrl = configManager.getUserServiceUrl();
    const client = createAPIClient(userServiceUrl);
    
    const response = await client.login(answers.email, answers.password);

    if (response.requiresOnboarding) {
      spinner.warn("Account requires onboarding");
      output.warning(
        "Your account requires onboarding. Please complete setup at the Quikim dashboard."
      );
      return;
    }

    // Store auth configuration
    const authConfig: AuthConfig = {
      token: response.token,
      userId: response.user.id,
      email: response.user.email,
      organizationId: response.organization?.id,
      organizationName: response.organization?.name,
      expiresAt: parseJwtExpiration(response.token),
    };

    configManager.setAuth(authConfig);

    spinner.succeed("Logged in successfully");
    output.separator();
    output.tableRow("Email", response.user.email);
    if (response.user.name) {
      output.tableRow("Name", response.user.name);
    }
    if (response.organization) {
      output.tableRow("Organization", response.organization.name);
    }
  } catch (err) {
    spinner.fail("Login failed");
    
    if (err instanceof AuthenticationError) {
      output.error("Invalid email or password");
    } else if (err instanceof Error) {
      output.error(err.message);
    }
    process.exit(1);
  }
}

/** Logout command handler */
async function logoutHandler(): Promise<void> {
  if (!configManager.isAuthenticated()) {
    output.info("You are not logged in");
    return;
  }

  const auth = configManager.getAuth();
  
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Logout from ${auth?.email}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    output.info("Logout cancelled");
    return;
  }

  configManager.clearAuth();
  configManager.clearCurrentProject();
  
  output.success("Logged out successfully");
}

/** Whoami command handler */
async function whoamiHandler(options: { json?: boolean }): Promise<void> {
  if (!configManager.isAuthenticated()) {
    output.error("Not logged in. Run 'quikim login' to authenticate.");
    process.exit(1);
  }

  const auth = configManager.getAuth();
  const currentProject = configManager.getCurrentProject();

  if (options.json) {
    output.json({
      authenticated: true,
      user: {
        id: auth?.userId,
        email: auth?.email,
      },
      organization: auth?.organizationId
        ? {
            id: auth.organizationId,
            name: auth.organizationName,
          }
        : null,
      currentProject: currentProject || null,
    });
    return;
  }

  output.header("Current Session");
  output.tableRow("Email", auth?.email ?? "Unknown");
  output.tableRow("User ID", auth?.userId ?? "Unknown");
  
  if (auth?.organizationName) {
    output.tableRow("Organization", auth.organizationName);
  }
  
  if (auth?.expiresAt) {
    output.tableRow("Token Expires", output.formatDate(auth.expiresAt));
  }

  if (currentProject) {
    output.separator();
    output.header("Connected Project");
    output.tableRow("Name", currentProject.name);
    output.tableRow("ID", currentProject.id);
    output.tableRow("Connected", output.formatDate(currentProject.connectedAt));
  }

  output.separator();
  output.tableRow("Config Path", configManager.getConfigPath());
}

/** Create auth commands */
export function createAuthCommands(): Command {
  const auth = new Command("auth").description("Authentication commands");

  auth
    .command("login")
    .description("Login to Quikim")
    .option("-e, --email <email>", "Email address")
    .action(loginHandler);

  auth
    .command("logout")
    .description("Logout from Quikim")
    .action(logoutHandler);

  auth
    .command("whoami")
    .description("Show current user information")
    .option("--json", "Output as JSON")
    .action(whoamiHandler);

  return auth;
}

/** Shortcut login command for root level */
export function createLoginCommand(): Command {
  return new Command("login")
    .description("Login to Quikim")
    .option("-e, --email <email>", "Email address")
    .action(loginHandler);
}

/** Shortcut logout command for root level */
export function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Logout from Quikim")
    .action(logoutHandler);
}

/** Shortcut whoami command for root level */
export function createWhoamiCommand(): Command {
  return new Command("whoami")
    .description("Show current user information")
    .option("--json", "Output as JSON")
    .action(whoamiHandler);
}
