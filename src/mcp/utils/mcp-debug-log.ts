/**
 * Quikim - MCP debug log writer
 * Appends lines to .quikim/mcp-debug.log for tracing (e.g. requirements sync).
 *
 * Copyright (c) 2026 Quikim Inc.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getQuikimProjectRoot } from "../../config/project-root.js";

const LOG_FILE = "mcp-debug.log";

/**
 * Append a line to .quikim/mcp-debug.log. Safe to call; never throws.
 * @param line - Line to append (newline added automatically)
 */
export function appendMcpDebug(line: string): void {
  try {
    const root = getQuikimProjectRoot();
    const logPath = join(root, ".quikim", LOG_FILE);
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${line}\n`);
  } catch {
    // ignore
  }
}

/**
 * Append multiple lines with a section header for requirements sync debugging.
 */
export function appendRequirementsSyncDebug(
  section: string,
  details: Record<string, unknown>
): void {
  const ts = new Date().toISOString();
  appendMcpDebug(`[${ts}] [requirements] ${section}`);
  for (const [k, v] of Object.entries(details)) {
    const val = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
    appendMcpDebug(`  ${k}: ${val}`);
  }
}
