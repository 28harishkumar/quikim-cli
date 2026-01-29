/**
 * Quikim - Progress Reporter Utility
 *
 * Copyright (c) 2026 Quikim Inc.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import * as output from "./output.js";

/**
 * Progress reporter for sync operations
 */
export class ProgressReporter {
  private startTime: number;
  private total: number;
  private current: number;
  private operation: string;
  private verbose: boolean;

  constructor(operation: string, total: number, verbose = false) {
    this.operation = operation;
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.verbose = verbose;
  }

  /**
   * Update progress
   */
  update(current: number, message?: string): void {
    this.current = current;
    
    if (this.verbose && message) {
      output.info(`[${this.operation}] ${message}`);
    }
    
    this.displayProgress();
  }

  /**
   * Increment progress by 1
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * Display progress bar
   */
  private displayProgress(): void {
    if (this.total === 0) return;
    
    const percentage = Math.floor((this.current / this.total) * 100);
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    
    // Use \r to overwrite the same line
    process.stderr.write(`\r${this.operation}: [${bar}] ${this.current}/${this.total} (${percentage}%)`);
    
    // Add newline when complete
    if (this.current === this.total) {
      process.stderr.write("\n");
    }
  }

  /**
   * Complete the progress and show summary
   */
  complete(): void {
    const duration = Date.now() - this.startTime;
    const seconds = (duration / 1000).toFixed(1);
    
    if (this.verbose) {
      output.info(`[${this.operation}] Completed in ${seconds}s`);
    }
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
}

/**
 * Format sync result summary
 */
export interface SyncSummary {
  pushed?: number;
  pulled?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: number;
  duration: number;
}

/**
 * Display formatted sync summary
 */
export function displaySyncSummary(summary: SyncSummary, operation: string): void {
  output.separator();
  output.header(`${operation} Summary`);

  if (summary.pushed !== undefined) {
    output.info(`  ✓ ${summary.pushed} artifact${summary.pushed !== 1 ? "s" : ""} pushed`);
  }

  if (summary.pulled !== undefined) {
    output.info(`  ✓ ${summary.pulled} artifact${summary.pulled !== 1 ? "s" : ""} pulled`);
  }

  if (summary.created !== undefined) {
    output.info(`  ✓ ${summary.created} artifact${summary.created !== 1 ? "s" : ""} created`);
  }

  if (summary.updated !== undefined) {
    output.info(`  ✓ ${summary.updated} artifact${summary.updated !== 1 ? "s" : ""} updated`);
  }

  if (summary.skipped !== undefined && summary.skipped > 0) {
    output.info(`  ⊘ ${summary.skipped} artifact${summary.skipped !== 1 ? "s" : ""} skipped (no changes)`);
  }

  if (summary.errors !== undefined && summary.errors > 0) {
    output.warning(`  ✗ ${summary.errors} error${summary.errors !== 1 ? "s" : ""}`);
  }

  output.separator();
  output.info(`Duration: ${ProgressReporter.formatDuration(summary.duration)}`);
}
