/**
 * Quikim - Project Root Resolver
 * Resolves the project directory for .quikim (env override for Claude Desktop etc.)
 *
 * Copyright (c) 2026 Quikim Inc.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Get the Quikim project root directory.
 * When running under Claude Desktop (or similar), set QUIKIM_PROJECT_DIR to your repo path
 * so .quikim is resolved there instead of the process cwd.
 */
export function getQuikimProjectRoot(): string {
  const dir = process.env.QUIKIM_PROJECT_DIR ?? process.env.PROJECT_PATH;
  if (dir) return dir;
  return process.cwd();
}
