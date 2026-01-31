/**
 * Quikim - CLI Output Utilities
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";

import { cliLogger } from "./logger.js";

/** Output success message */
export function success(message: string): void {
  cliLogger.info(`${chalk.green("✓")} ${message}`);
}

/** Output error message */
export function error(message: string): void {
  cliLogger.error(`${chalk.red("✗")} ${message}`);
}

/** Output warning message */
export function warning(message: string): void {
  cliLogger.warn(`${chalk.yellow("⚠")} ${message}`);
}

/** Output info message */
export function info(message: string): void {
  cliLogger.info(`${chalk.blue("ℹ")} ${message}`);
}

/** Output a table row */
export function tableRow(label: string, value: string): void {
  cliLogger.info(`  ${chalk.gray(label + ":")} ${value}`);
}

/** Output a header */
export function header(message: string): void {
  cliLogger.info("");
  cliLogger.info(chalk.bold.cyan(message));
  cliLogger.info(chalk.gray("─".repeat(message.length)));
}

/** Output a separator line */
export function separator(): void {
  cliLogger.info("");
}

/** Create a spinner */
export function spinner(text: string): Ora {
  return ora({
    text,
    color: "cyan",
  });
}

/** Format a date string */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format project status with color */
export function formatStatus(status: string): string {
  const statusColors: Record<string, typeof chalk> = {
    DRAFT: chalk.gray,
    ACTIVE: chalk.green,
    IN_PROGRESS: chalk.blue,
    COMPLETED: chalk.cyan,
    ARCHIVED: chalk.yellow,
    ON_HOLD: chalk.magenta,
  };

  const colorFn = statusColors[status] ?? chalk.white;
  return colorFn(status);
}

/** Print JSON formatted output */
export function json(data: unknown): void {
  cliLogger.info(JSON.stringify(data, null, 2));
}
