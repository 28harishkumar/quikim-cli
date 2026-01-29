/**
 * Quikim - Artifact Commands
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { Command } from "commander";
import { ArtifactSyncService } from "../services/artifact-sync.js";
import {
  ArtifactType,
  ArtifactFilters,
  SyncOperation,
} from "../types/artifacts.js";
import * as output from "../utils/output.js";

/**
 * Create artifact commands at root level
 */
export function createArtifactCommands(program: Command): void {
  const artifactTypes: ArtifactType[] = [
    "requirement",
    "context",
    "code_guideline",
    "lld",
    "hld",
    "wireframe_files",
    "flow_diagram",
    "er_diagram",
    "tasks",
  ];

  // Single artifact type commands: quikim <artifact_type> <push|pull|sync>
  for (const type of artifactTypes) {
    program
      .command(`${type} <operation>`)
      .description(`Manage ${type} artifacts`)
      .option("--spec <name>", "Filter by spec name")
      .option("--name <name>", "Filter by artifact name")
      .option("--dry-run", "Show what would be done without making changes")
      .option("--force", "Force operation even if no changes detected")
      .option("--verbose", "Show detailed output")
      .action(async (operation: SyncOperation, options) => {
        await handleArtifactOperation(type, operation, options);
      });
  }

  // All artifacts command: quikim artifacts <push|pull|sync>
  program
    .command("artifacts <operation>")
    .description("Manage all artifacts")
    .option("--spec <name>", "Filter by spec name")
    .option("--dry-run", "Show what would be done without making changes")
    .option("--force", "Force operation even if no changes detected")
    .option("--verbose", "Show detailed output")
    .action(async (operation: SyncOperation, options) => {
      await handleArtifactOperation(undefined, operation, options);
    });

  // Spec command: quikim spec <spec_name> <push|pull|sync>
  program
    .command("spec <specName> <operation>")
    .description("Manage artifacts for a specific spec")
    .option("--type <type>", "Filter by artifact type")
    .option("--name <name>", "Filter by artifact name")
    .option("--dry-run", "Show what would be done without making changes")
    .option("--force", "Force operation even if no changes detected")
    .option("--verbose", "Show detailed output")
    .action(async (specName: string, operation: SyncOperation, options) => {
      await handleArtifactOperation(options.type, operation, {
        ...options,
        spec: specName,
      });
    });

  // Edit command: quikim edit <type> <id_or_name> --name <new_name> --spec <new_spec>
  program
    .command("edit <type> <identifier>")
    .description("Edit artifact name and spec name (requirements, context, designs, wireframes, milestones)")
    .option("--name <name>", "New artifact name")
    .option("--spec <spec>", "New spec name")
    .action(async (type: string, identifier: string, options) => {
      await handleEditArtifact(type, identifier, options);
    });
}

/**
 * Handle edit artifact metadata
 */
async function handleEditArtifact(
  type: string,
  identifier: string,
  options: {
    name?: string;
    spec?: string;
  }
): Promise<void> {
  const editableTypes = ["requirement", "context", "hld", "lld", "wireframe_files", "flow_diagram", "er_diagram", "tasks"];
  
  if (!editableTypes.includes(type)) {
    output.error(`Cannot edit ${type}. Only ${editableTypes.join(", ")} can be edited.`);
    process.exit(1);
  }

  if (!options.name && !options.spec) {
    output.error("Please specify --name and/or --spec to update");
    process.exit(1);
  }

  try {
    const { ArtifactSyncService } = await import("../services/artifact-sync.js");
    const service = new ArtifactSyncService();
    
    await service.updateArtifactMetadata(type, identifier, {
      name: options.name,
      specName: options.spec,
    });

    output.success("Artifact updated successfully");
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Handle artifact operation
 */
async function handleArtifactOperation(
  artifactType: ArtifactType | undefined,
  operation: SyncOperation,
  options: {
    spec?: string;
    name?: string;
    dryRun?: boolean;
    force?: boolean;
    verbose?: boolean;
  }
): Promise<void> {
  try {
    const service = new ArtifactSyncService();
    const filters: ArtifactFilters = {
      artifactType,
      specName: options.spec,
      artifactName: options.name,
    };

    switch (operation) {
      case "push":
        await handlePush(service, filters, options);
        break;
      case "pull":
        await handlePull(service, filters, options);
        break;
      case "sync":
        await handleSync(service, filters, options);
        break;
      default:
        output.error(`Unknown operation: ${operation}`);
        output.info("Valid operations: push, pull, sync");
        process.exit(1);
    }
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Handle push operation
 */
async function handlePush(
  service: ArtifactSyncService,
  filters: ArtifactFilters,
  options: any
): Promise<void> {
  output.header("Pushing artifacts to server...");
  
  const result = await service.pushArtifacts(filters, {
    dryRun: options.dryRun,
    force: options.force,
    verbose: options.verbose,
  });

  output.separator();
  output.success(`Pushed: ${result.pushed}`);
  output.info(`Skipped: ${result.skipped}`);
  
  if (result.errors.length > 0) {
    output.error(`Errors: ${result.errors.length}`);
    result.errors.forEach((err) => {
      output.error(`  ${err.artifact}: ${err.error}`);
    });
  }

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Handle pull operation
 */
async function handlePull(
  service: ArtifactSyncService,
  filters: ArtifactFilters,
  options: any
): Promise<void> {
  output.header("Pulling artifacts from server...");
  
  const result = await service.pullArtifacts(filters, {
    dryRun: options.dryRun,
    force: options.force,
    verbose: options.verbose,
  });

  output.separator();
  output.success(`Pulled: ${result.pulled}`);
  output.info(`Created: ${result.created}`);
  output.info(`Updated: ${result.updated}`);
  
  if (result.errors.length > 0) {
    output.error(`Errors: ${result.errors.length}`);
    result.errors.forEach((err) => {
      output.error(`  ${err.artifact}: ${err.error}`);
    });
  }

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Handle sync operation
 */
async function handleSync(
  service: ArtifactSyncService,
  filters: ArtifactFilters,
  options: any
): Promise<void> {
  output.header("Syncing artifacts...");
  
  const result = await service.syncArtifacts(filters, {
    dryRun: options.dryRun,
    force: options.force,
    verbose: options.verbose,
  });

  output.separator();
  output.header("Push Results:");
  output.success(`Pushed: ${result.push.pushed}`);
  output.info(`Skipped: ${result.push.skipped}`);
  
  output.separator();
  output.header("Pull Results:");
  output.success(`Pulled: ${result.pull.pulled}`);
  output.info(`Created: ${result.pull.created}`);
  output.info(`Updated: ${result.pull.updated}`);
  
  if (!result.success) {
    process.exit(1);
  }
}

