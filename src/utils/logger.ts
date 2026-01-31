/**
 * Quikim - CLI Logger
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/** Thin wrapper over console for CLI output; use instead of console.log/error/warn */
export const cliLogger = {
  info(message: string): void {
    console.info(message);
  },
  error(message: string): void {
    console.error(message);
  },
  warn(message: string): void {
    console.warn(message);
  },
  debug(message: string): void {
    console.debug(message);
  },
};
