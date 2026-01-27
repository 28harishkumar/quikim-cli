/**
 * Quikim - Artifact Sync Service
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { ArtifactFileManager } from "./artifact-file-manager.js";
import { TaskFileManager, findOrCreateMilestone, splitTaskAndSubtasks, type Task, type Milestone, type TaskStatus } from "./task-file-manager.js";
import { 
  kiroFormatToServer,
  type Task as KiroTask
} from "./tasks-converter.js";
import { configManager } from "../config/manager.js";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import {
  ArtifactFilters,
  ArtifactMetadata,
  LocalArtifact,
  ServerArtifact,
  PushOptions,
  PullOptions,
  SyncOptions,
  PushResult,
  PullResult,
  SyncResult,
  ArtifactType,
} from "../types/artifacts.js";
import { extractTitleFromMarkdown } from "../utils/markdown-parser.js";
import { markdownToHtml, htmlToMarkdown, isHtmlContent } from "./content-converter.js";
import { normalizeForComparison, computeContentHash } from "../utils/content-normalizer.js";
import { findDuplicateArtifact, hasContentChanged, findDuplicateTask as detectDuplicateTask } from "./duplicate-detector.js";
import { MetadataManager } from "./metadata-manager.js";
import { VersionManager } from "./version-manager.js";
import { extractContent } from "../utils/content-extractor.js";
import { retryNetworkRequest } from "../utils/retry-helper.js";
import { ProgressReporter, displaySyncSummary } from "../utils/progress-reporter.js";

/** Minimal project context for push (projectId + organizationId) */
type PushProjectContext = { projectId: string; organizationId: string };

/** Extract list from API response: array as-is, or response.data if wrapped as { data: T[] } */
function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && "data" in raw) {
    const inner = (raw as { data: unknown }).data;
    return Array.isArray(inner) ? (inner as T[]) : [];
  }
  return [];
}

export class ArtifactSyncService {
  private fileManager: ArtifactFileManager;
  private taskFileManager: TaskFileManager;
  private metadataManager: MetadataManager;
  private versionManager: VersionManager;

  constructor() {
    this.fileManager = new ArtifactFileManager();
    this.taskFileManager = new TaskFileManager();
    this.metadataManager = new MetadataManager();
    this.versionManager = new VersionManager();
  }

  /**
   * Push local artifacts to server
   */
  async pushArtifacts(
    filters: ArtifactFilters,
    options: PushOptions = {}
  ): Promise<PushResult> {
    const startTime = Date.now();
    const result: PushResult = {
      success: true,
      pushed: 0,
      skipped: 0,
      errors: [],
      versions: [],
    };

    try {
      // Scan local artifacts (resolveArtifactsRoot finds .quikim/artifacts from cwd or parents)
      const localArtifacts = await this.fileManager.scanLocalArtifacts(filters);

      if (options.dryRun) {
        console.log(`[DRY RUN] Would push ${localArtifacts.length} artifacts`);
        return result;
      }

      if (localArtifacts.length === 0) {
        console.error(
          "[push] No local artifacts to push. Run from the project root (where .quikim/artifacts exists) or run \"artifacts pull\" first."
        );
        return result;
      }

      // Get current project
      const project = configManager.getCurrentProject();
      if (!project) {
        throw new Error("No project connected. Run 'quikim connect' first.");
      }

      // Initialize progress reporter
      const progress = new ProgressReporter("Pushing artifacts", localArtifacts.length, options.verbose);

      // Process each artifact
      for (let i = 0; i < localArtifacts.length; i++) {
        const artifact = localArtifacts[i];
        try {
          const shouldPush = await this.shouldPushArtifact(artifact, options);
          
          if (!shouldPush) {
            result.skipped++;
            if (options.verbose) {
              console.log(`Skipped: ${artifact.filePath} (no changes)`);
            }
            continue;
          }

          const projectContext: PushProjectContext = {
            projectId: project.projectId,
            organizationId: project.organizationId,
          };

          // Handle tasks differently - use TaskFileManager or TasksConverter based on file format
          if (artifact.artifactType === "tasks") {
            // Check if this is a Kiro format tasks.md file or individual task files
            const isKiroFormat = artifact.artifactName === "tasks" || artifact.filePath.endsWith("tasks.md");
            
            if (isKiroFormat) {
              // Use TasksConverter for Kiro format (single tasks.md file)
              await this.pushTasksAsMilestone(project.projectId, artifact, options);
            } else {
              // Use TaskFileManager for individual task files
              await this.pushTasksWithTaskFileManager(project.projectId, artifact);
            }
          } else {
            console.error(`[push] ${artifact.artifactType} ${artifact.filePath}`);
            const artifactId = await this.pushSingleArtifact(projectContext, artifact, options);
            // Rename file to use artifact ID
            if (artifactId) {
              await this.renameArtifactFile(artifact, artifactId);
              
              // Update local metadata with version information after push
              const artifactsRoot = this.fileManager.getArtifactsRoot();
              const serverArtifact = await this.fetchServerArtifact(
                project.projectId,
                artifact.specName,
                artifact.artifactType,
                artifact.artifactName
              );
              
              if (serverArtifact) {
                await this.metadataManager.updateAfterPull(
                  artifactsRoot,
                  artifact.specName,
                  artifactId,
                  artifact.artifactType,
                  artifact.artifactName,
                  serverArtifact.version,
                  artifact.content
                );
                
                // Track version in result
                result.versions?.push({
                  artifact: artifact.filePath,
                  version: serverArtifact.version,
                });
                
                if (options.verbose) {
                  console.log(`[VERBOSE] Updated local metadata after push (version ${serverArtifact.version})`);
                }
              }
            }
          }

          result.pushed++;
          
          // Update progress
          progress.increment(`Pushed: ${artifact.filePath}`);
        } catch (error) {
          // Collect error but continue processing other artifacts
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ 
            artifact: artifact.filePath, 
            error: errorMsg 
          });
          
          console.error(`[push] Error processing ${artifact.filePath}: ${errorMsg}`);
          
          if (options.verbose) {
            console.log(`[VERBOSE] Error details: ${errorMsg}`);
            console.log(`[VERBOSE] Continuing with next artifact...`);
          }
          
          // Update progress even on error
          progress.increment(`Error: ${artifact.filePath}`);
        }
      }

      // Complete progress reporting
      progress.complete();
      
      // Display summary
      const duration = Date.now() - startTime;
      displaySyncSummary({
        pushed: result.pushed,
        skipped: result.skipped,
        errors: result.errors.length,
        duration,
      }, "Push");
      
      // Mark as failed if there were any errors
      if (result.errors.length > 0) {
        result.success = false;
        console.log(`\n⚠ Push completed with ${result.errors.length} error(s). See details above.`);
      }

      return result;
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        artifact: "general",
        error: errorMsg,
      });
      
      console.error(`[push] Fatal error: ${errorMsg}`);
      
      // Display summary even on fatal error
      const duration = Date.now() - startTime;
      displaySyncSummary({
        pushed: result.pushed,
        skipped: result.skipped,
        errors: result.errors.length,
        duration,
      }, "Push");
      
      return result;
    }
  }

  /**
   * Pull artifacts from server to local
   */
  async pullArtifacts(
    filters: ArtifactFilters,
    options: PullOptions = {}
  ): Promise<PullResult> {
    const startTime = Date.now();
    const result: PullResult = {
      success: true,
      pulled: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      versions: [],
    };

    try {
      const project = configManager.getCurrentProject();
      if (!project) {
        throw new Error("No project connected. Run 'quikim connect' first.");
      }

      // Fetch artifacts from server with retry logic
      let serverArtifacts: ServerArtifact[] = [];
      try {
        serverArtifacts = await retryNetworkRequest(
          () => this.fetchServerArtifacts(project.projectId, filters),
          { verbose: options.verbose }
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.success = false;
        result.errors.push({
          artifact: "fetch-server-artifacts",
          error: `Failed to fetch artifacts from server: ${errorMsg}`,
        });
        
        // Display error summary and return
        const duration = Date.now() - startTime;
        displaySyncSummary({
          pulled: result.pulled,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
          duration,
        }, "Pull");
        
        return result;
      }

      if (options.dryRun) {
        console.log(`[DRY RUN] Would pull ${serverArtifacts.length} artifacts`);
        return result;
      }

      // Initialize progress reporter
      const progress = new ProgressReporter("Pulling artifacts", serverArtifacts.length, options.verbose);

      // Process each artifact
      for (let i = 0; i < serverArtifacts.length; i++) {
        const artifact = serverArtifacts[i];
        try {
          const exists = await this.fileManager.artifactExists(artifact);
          
          if (options.verbose) {
            console.log(`\n[VERBOSE] Processing artifact: ${this.getArtifactPath(artifact)}`);
            console.log(`[VERBOSE]   Spec: ${artifact.specName}`);
            console.log(`[VERBOSE]   Type: ${artifact.artifactType}`);
            console.log(`[VERBOSE]   Name: ${artifact.artifactName}`);
            console.log(`[VERBOSE]   Version: ${artifact.version}`);
            console.log(`[VERBOSE]   Content size: ${artifact.content.length} bytes`);
            console.log(`[VERBOSE]   Exists locally: ${exists ? "YES" : "NO"}`);
          }
          
          // Get artifacts root for metadata management
          const artifactsRoot = this.fileManager.getArtifactsRoot();
          
          // Check if content has changed using metadata
          const contentChanged = await this.metadataManager.hasContentChanged(
            artifactsRoot,
            artifact.specName,
            artifact.artifactId,
            artifact.content
          );
          
          if (!contentChanged && exists) {
            // Skip unchanged files
            result.skipped++;
            if (options.verbose) {
              console.log(`[VERBOSE] Skipped: ${this.getArtifactPath(artifact)} (content unchanged)`);
            }
            continue;
          }
          
          if (options.verbose && contentChanged) {
            console.log(`[VERBOSE] Content has changed, will update local file`);
          }
          
          // Handle tasks differently - use TaskFileManager
          if (artifact.artifactType === "tasks") {
            try {
              // Parse markdown back to task object
              const task = this.taskFileManager.taskFileToServer(artifact.content);
              
              // Write task file
              await this.taskFileManager.writeTaskFile(task, artifact.specName);
              
              // Download task assets
              await this.taskFileManager.downloadTaskAssets(task, artifact.specName);
              
              if (options.verbose) {
                console.log(`[VERBOSE] Task conversion successful for ${this.getArtifactPath(artifact)}`);
              }
            } catch (conversionError) {
              // Log conversion error and use fallback: write raw content
              const errorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
              console.warn(`[pull] Failed to convert task format for ${this.getArtifactPath(artifact)}: ${errorMsg}`);
              console.warn(`[pull] Fallback: Writing raw content to file`);
              
              if (options.verbose) {
                console.log(`[VERBOSE] Task conversion error details: ${errorMsg}`);
                console.log(`[VERBOSE] Fallback: Using raw content without conversion`);
              }
              
              // Fallback: write raw content as-is
              await this.fileManager.writeArtifactFile(artifact);
            }
          } else {
            // Convert HTML content to Markdown before writing
            let contentToWrite = artifact.content;
            const isHtml = isHtmlContent(artifact.content);
            
            if (options.verbose) {
              console.log(`[VERBOSE] Content format detection: ${isHtml ? "HTML" : "Markdown/Plain text"}`);
            }

            try {
              // Only convert if content is HTML
              if (isHtml) {
                const originalLength = artifact.content.length;
                contentToWrite = htmlToMarkdown(artifact.content);
                
                if (contentToWrite && contentToWrite !== artifact.content) {
                  console.error(`[pull] Converted HTML to Markdown for ${this.getArtifactPath(artifact)}`);
                  
                  if (options.verbose) {
                    console.log(`[VERBOSE] HTML → Markdown conversion successful`);
                    console.log(`[VERBOSE]   Original size: ${originalLength} bytes`);
                    console.log(`[VERBOSE]   Converted size: ${contentToWrite.length} bytes`);
                    console.log(`[VERBOSE]   Size change: ${contentToWrite.length - originalLength > 0 ? "+" : ""}${contentToWrite.length - originalLength} bytes`);
                  }
                } else {
                  // Content didn't change, might already be plain text
                  if (options.verbose) {
                    console.log(`[VERBOSE] No conversion needed - content unchanged`);
                  }
                }
              } else {
                console.error(`[pull] Content already in Markdown/plain text format for ${this.getArtifactPath(artifact)}`);
                
                if (options.verbose) {
                  console.log(`[VERBOSE] Skipping conversion - content already in Markdown/plain text format`);
                }
              }
            } catch (conversionError) {
              // Log conversion error but continue with original content
              const errorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
              console.warn(`[pull] Failed to convert HTML to Markdown for ${this.getArtifactPath(artifact)}: ${errorMsg}`);
              console.warn(`[pull] Fallback: Using original content without conversion`);
              
              if (options.verbose) {
                console.log(`[VERBOSE] Conversion error details: ${errorMsg}`);
                console.log(`[VERBOSE] Fallback: Writing original content as-is`);
              }
              
              // Fallback: use original content
              contentToWrite = artifact.content;
            }

            // Write artifact with converted content
            await this.fileManager.writeArtifactFile({
              ...artifact,
              content: contentToWrite,
            });
          }
          
          // Update local metadata after successful pull
          await this.metadataManager.updateAfterPull(
            artifactsRoot,
            artifact.specName,
            artifact.artifactId,
            artifact.artifactType,
            artifact.artifactName,
            artifact.version,
            artifact.content
          );
          
          // Track version in result
          result.versions?.push({
            artifact: this.getArtifactPath(artifact),
            version: artifact.version,
          });
          
          if (options.verbose) {
            console.log(`[VERBOSE] Updated local metadata for ${this.getArtifactPath(artifact)}`);
          }
          
          if (exists) {
            result.updated++;
            if (options.verbose) {
              console.log(`[VERBOSE] Updated: ${this.getArtifactPath(artifact)}`);
            }
          } else {
            result.created++;
            if (options.verbose) {
              console.log(`[VERBOSE] Created: ${this.getArtifactPath(artifact)}`);
            }
          }
          
          result.pulled++;
          
          // Update progress
          progress.increment(`Pulled: ${this.getArtifactPath(artifact)}`);
        } catch (error) {
          // Collect error but continue processing other artifacts
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({
            artifact: this.getArtifactPath(artifact),
            error: errorMsg,
          });
          
          console.error(`[pull] Error processing ${this.getArtifactPath(artifact)}: ${errorMsg}`);
          
          if (options.verbose) {
            console.log(`[VERBOSE] Error details: ${errorMsg}`);
            console.log(`[VERBOSE] Continuing with next artifact...`);
          }
          
          // Update progress even on error
          progress.increment(`Error: ${this.getArtifactPath(artifact)}`);
        }
      }

      // Complete progress reporting
      progress.complete();
      
      // Display summary
      const duration = Date.now() - startTime;
      displaySyncSummary({
        pulled: result.pulled,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        duration,
      }, "Pull");
      
      // Mark as failed if there were any errors
      if (result.errors.length > 0) {
        result.success = false;
        console.log(`\n⚠ Pull completed with ${result.errors.length} error(s). See details above.`);
      }

      return result;
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        artifact: "general",
        error: errorMsg,
      });
      
      console.error(`[pull] Fatal error: ${errorMsg}`);
      
      // Display summary even on fatal error
      const duration = Date.now() - startTime;
      displaySyncSummary({
        pulled: result.pulled,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        duration,
      }, "Pull");
      
      return result;
    }
  }

  /**
   * Sync artifacts (push then pull)
   */
  async syncArtifacts(
    filters: ArtifactFilters,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const pushResult = await this.pushArtifacts(filters, options);
    const pullResult = await this.pullArtifacts(filters, options);

    return {
      push: pushResult,
      pull: pullResult,
      success: pushResult.success && pullResult.success,
    };
  }

  /**
   * Check if artifact should be pushed (has changes)
   * Uses VersionManager for content comparison
   */
  private async shouldPushArtifact(
    artifact: LocalArtifact,
    options: PushOptions
  ): Promise<boolean> {
    if (options.force) {
      return true;
    }

    // Check if artifact exists on server
    const project = configManager.getCurrentProject();
    if (!project) {
      return true; // Push if no project (will fail later, but let it)
    }

    try {
      const serverArtifact = await this.fetchServerArtifact(
        project.projectId,
        artifact.specName,
        artifact.artifactType,
        artifact.artifactName
      );

      if (!serverArtifact) {
        return true; // New artifact, push it
      }

      // Use VersionManager to determine if content has changed
      const contentChanged = this.versionManager.shouldCreateNewVersion(
        artifact.content,
        serverArtifact.content
      );

      if (options.verbose && !contentChanged) {
        console.log(`[VERBOSE] Skipping ${artifact.filePath}: content unchanged (version ${serverArtifact.version})`);
      }

      return contentChanged;
    } catch (error) {
      // If we can't check, push it (server will handle)
      if (options.verbose) {
        console.log(`[VERBOSE] Error checking artifact version: ${error instanceof Error ? error.message : String(error)}`);
      }
      return true;
    }
  }

  /**
   * Push single artifact to server
   * Returns the artifact ID for file renaming
   */
  private async pushSingleArtifact(
    project: PushProjectContext,
    artifact: LocalArtifact,
    options: PushOptions = {}
  ): Promise<string | null> {
    const { projectId, organizationId } = project;
    let endpoint: string;
    let requestBody: Record<string, unknown>;
    let method: "PATCH" | "POST" = "POST";

    if (options.verbose) {
      console.log(`\n[VERBOSE] Processing artifact: ${artifact.filePath}`);
      console.log(`[VERBOSE]   Spec: ${artifact.specName}`);
      console.log(`[VERBOSE]   Type: ${artifact.artifactType}`);
      console.log(`[VERBOSE]   Name: ${artifact.artifactName}`);
      console.log(`[VERBOSE]   Content size: ${artifact.content.length} bytes`);
    }

    // Convert Markdown content to HTML before pushing
    let contentToPush = artifact.content;
    const isHtml = isHtmlContent(artifact.content);
    
    if (options.verbose) {
      console.log(`[VERBOSE] Content format detection: ${isHtml ? "HTML" : "Markdown"}`);
    }

    try {
      // Skip conversion if content is already HTML
      if (!isHtml) {
        const originalLength = artifact.content.length;
        contentToPush = await markdownToHtml(artifact.content);
        
        if (contentToPush && contentToPush !== artifact.content) {
          console.error(`[push] Converted Markdown to HTML for ${artifact.filePath}`);
          
          if (options.verbose) {
            console.log(`[VERBOSE] Markdown → HTML conversion successful`);
            console.log(`[VERBOSE]   Original size: ${originalLength} bytes`);
            console.log(`[VERBOSE]   Converted size: ${contentToPush.length} bytes`);
            console.log(`[VERBOSE]   Size change: ${contentToPush.length - originalLength > 0 ? "+" : ""}${contentToPush.length - originalLength} bytes`);
          }
        }
      } else {
        console.error(`[push] Content already in HTML format for ${artifact.filePath}`);
        
        if (options.verbose) {
          console.log(`[VERBOSE] Skipping conversion - content already in HTML format`);
        }
      }
    } catch (error) {
      // Log conversion error but continue with original content
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[push] Failed to convert Markdown to HTML for ${artifact.filePath}: ${errorMsg}`);
      console.warn(`[push] Continuing with original content`);
      
      if (options.verbose) {
        console.log(`[VERBOSE] Conversion error details: ${errorMsg}`);
        console.log(`[VERBOSE] Fallback: Using original content without conversion`);
      }
      
      contentToPush = artifact.content;
    }

    // Normalize content for duplicate checking and hash calculation
    const normalizedContent = normalizeForComparison(contentToPush);
    const contentHash = this.calculateHash(contentToPush);
    
    console.error(`[push] Content hash: ${contentHash.substring(0, 12)}... (normalized ${normalizedContent.length} chars) for ${artifact.filePath}`);
    
    if (options.verbose) {
      console.log(`[VERBOSE] Content normalization complete`);
      console.log(`[VERBOSE]   Original content: ${contentToPush.length} bytes`);
      console.log(`[VERBOSE]   Normalized content: ${normalizedContent.length} bytes`);
      console.log(`[VERBOSE]   Content hash: ${contentHash}`);
      console.log(`[VERBOSE]   Hash (short): ${contentHash.substring(0, 12)}...`);
    }

    // Check for duplicate artifacts on server
    let duplicate: ServerArtifact | null = null;
    try {
      if (options.verbose) {
        console.log(`[VERBOSE] Starting duplicate detection...`);
        console.log(`[VERBOSE]   Fetching server artifacts for spec: ${artifact.specName}`);
      }

      const serverArtifacts = await this.fetchServerArtifacts(projectId, {
        specName: artifact.specName,
        artifactType: artifact.artifactType,
      });

      if (options.verbose) {
        console.log(`[VERBOSE]   Found ${serverArtifacts.length} server artifact(s) of type "${artifact.artifactType}"`);
      }

      duplicate = findDuplicateArtifact(
        artifact.specName,
        artifact.artifactType,
        artifact.artifactName,
        contentToPush,
        serverArtifacts,
        { verbose: options.verbose }
      );

      if (duplicate) {
        if (options.verbose) {
          console.log(`[VERBOSE] Duplicate artifact found!`);
          console.log(`[VERBOSE]   Artifact ID: ${duplicate.artifactId}`);
          console.log(`[VERBOSE]   Artifact name: ${duplicate.artifactName}`);
          console.log(`[VERBOSE]   Version: ${duplicate.version}`);
          console.log(`[VERBOSE]   Last updated: ${duplicate.updatedAt.toISOString()}`);
          console.log(`[VERBOSE]   Comparing content to determine if update is needed...`);
        }

        // Check if content is identical
        const contentChanged = hasContentChanged(contentToPush, duplicate.content);
        
        if (options.verbose) {
          const duplicateHash = this.calculateHash(duplicate.content);
          console.log(`[VERBOSE] Content comparison results:`);
          console.log(`[VERBOSE]   Local hash:  ${contentHash}`);
          console.log(`[VERBOSE]   Server hash: ${duplicateHash}`);
          console.log(`[VERBOSE]   Content changed: ${contentChanged ? "YES" : "NO"}`);
        }
        
        if (!contentChanged) {
          // Duplicate with identical content - skip push
          console.log(`[push] Skipping ${artifact.filePath}: identical content already exists on server (ID: ${duplicate.artifactId})`);
          
          if (options.verbose) {
            console.log(`[VERBOSE] Decision: SKIP - Content is identical to server version`);
            console.log(`[VERBOSE] Returning existing artifact ID: ${duplicate.artifactId}`);
          }
          
          return duplicate.artifactId;
        } else {
          // Duplicate with different content - update existing artifact
          console.log(`[push] Updating existing artifact ${duplicate.artifactId} with new content for ${artifact.filePath}`);
          
          if (options.verbose) {
            console.log(`[VERBOSE] Decision: UPDATE - Content has changed`);
            console.log(`[VERBOSE] Will use PATCH method to update artifact ${duplicate.artifactId}`);
          }
          
          // Set method to PATCH and use existing artifact ID
          method = "PATCH";
          // Continue with push logic below, but use the duplicate's ID
        }
      } else {
        console.error(`[push] No duplicate found, creating new artifact for ${artifact.filePath}`);
        
        if (options.verbose) {
          console.log(`[VERBOSE] Duplicate detection result: No duplicate found`);
          console.log(`[VERBOSE] Decision: CREATE - Will create new artifact on server`);
          console.log(`[VERBOSE] Will use POST method to create new artifact`);
        }
      }
    } catch (error) {
      // If duplicate detection fails, log warning and continue with push
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[push] Duplicate detection failed for ${artifact.filePath}: ${errorMsg}`);
      console.warn(`[push] Continuing with push operation`);
      
      if (options.verbose) {
        console.log(`[VERBOSE] Duplicate detection error: ${errorMsg}`);
        console.log(`[VERBOSE] Fallback: Proceeding with push operation (server will handle duplicates)`);
      }
    }

    // Extract name from content for HLD/LLD if name is generic
    let artifactName = artifact.artifactName;
    if ((artifact.artifactType === "hld" || artifact.artifactType === "lld") &&
        (artifactName === "design" || artifactName === "hld" || artifactName === "lld")) {
      const extractedName = extractTitleFromMarkdown(artifact.content);
      if (extractedName) {
        artifactName = extractedName;
      }
    }

    const reqIdFromName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artifactName);

    switch (artifact.artifactType) {
      case "requirement": {
        // Use duplicate detection result if available
        if (duplicate && method === "PATCH") {
          endpoint = `/api/v1/requirements/${duplicate.artifactId}`;
          requestBody = {
            content: contentToPush,
            changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
            changeType: "minor",
          };
        } else {
          // Check if requirement exists by ID (for backward compatibility)
          const requirementExists =
            reqIdFromName &&
            (await this.fetchServerArtifact(
              projectId,
              artifact.specName,
              "requirement",
              artifactName
            ));
          if (requirementExists) {
            method = "PATCH";
            endpoint = `/api/v1/requirements/${artifactName}`;
            requestBody = {
              content: contentToPush,
              changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
              changeType: "minor",
            };
          } else {
            endpoint = "/api/v1/requirements";
            requestBody = {
              projectId,
              name: reqIdFromName
                ? extractTitleFromMarkdown(artifact.content) || artifactName
                : artifactName,
              content: contentToPush,
              changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
              changeType: "minor",
              specName: artifact.specName || "default",
            };
          }
        }
        break;
      }

      case "hld":
      case "lld": {
        // Use duplicate detection result if available
        if (duplicate && method === "PATCH") {
          endpoint = "/api/v1/designs";
          requestBody = {
            projectId,
            id: duplicate.artifactId,
            type: artifact.artifactType,
            content: contentToPush,
            changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
            specName: artifact.specName || "default",
          };
        } else {
          endpoint = "/api/v1/designs";
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artifactName);
          // Only send id when a non-deleted design exists; list excludes deleted so treat deleted as create-new
          const designExists =
            isUUID &&
            (await this.fetchServerArtifact(
              projectId,
              artifact.specName,
              artifact.artifactType,
              artifactName
            ));
          requestBody = {
            projectId,
            ...(designExists && { id: artifactName }),
            ...(!designExists && { name: artifactName }),
            type: artifact.artifactType,
            content: contentToPush,
            changeSummary: `Synced from CLI - spec: ${artifact.specName}`,
            specName: artifact.specName || "default",
          };
        }
        break;
      }

      case "flow_diagram":
        endpoint = "/api/v1/er-diagrams";
        requestBody = {
          projectId,
          name: artifactName,
          content: contentToPush,
          specName: artifact.specName || "default",
        };
        break;

      case "context":
        endpoint = `/api/v1/projects/${projectId}/contexts`;
        requestBody = {
          title: artifactName || extractTitleFromMarkdown(artifact.content) || "Context",
          content: contentToPush,
          description: "",
          isActive: true,
        };
        break;

      case "code_guideline":
        endpoint = "/api/v1/code-guidelines";
        requestBody = {
          scope: "project",
          projectId,
          title: artifactName || extractTitleFromMarkdown(artifact.content) || "Guideline",
          content: contentToPush,
          description: "",
        };
        break;

      case "wireframe_files":
        endpoint = `/api/v1/organizations/${organizationId}/projects/${projectId}/wireframes`;
        requestBody = {
          name: artifactName || extractTitleFromMarkdown(artifact.content) || "Wireframe",
          viewport: { width: 1280, height: 720, scale: 1 },
          elements: [],
        };
        break;

      default:
        throw new Error(`Unsupported artifact type: ${artifact.artifactType}`);
    }

    const response = await this.makeRequest<{
      success: boolean;
      id?: string;
      artifactId?: string;
      data?: { id?: string };
      version?: number;
    }>("project", endpoint, {
      method,
      body: JSON.stringify(requestBody),
    });

    if (!response.success || !response.data) {
      const errorMsg = response.error || "Unknown error";
      throw new Error(`Failed to push artifact to server: ${errorMsg}`);
    }

    const raw = response.data as {
      id?: string;
      artifactId?: string;
      data?: { id?: string };
    };
    const idFromResponse =
      raw.id ?? raw.artifactId ?? raw.data?.id ?? null;
    const artifactId =
      idFromResponse ?? (method === "PATCH" ? artifactName : null);
    return artifactId;
  }

  /**
   * Push tasks using new TaskFileManager format
   * Each task is stored in individual tasks_<task_id>.md files
   */
  private async pushTasksWithTaskFileManager(
    projectId: string,
    artifact: LocalArtifact
  ): Promise<void> {
    const specName = artifact.specName || "default";
    
    // Scan local task files for this spec
    const localTasks = await this.taskFileManager.scanLocalTasks(specName);
    
    if (localTasks.length === 0) {
      console.log(`No task files found for spec: ${specName}`);
      return;
    }

    // Create API client wrapper for milestone operations
    const apiClient = {
      getMilestones: async (specName: string): Promise<Milestone[]> => {
        const specFilter = specName ? `&specName=${encodeURIComponent(specName)}` : "";
        const response = await this.makeRequest<unknown>(
          "project",
          `/api/v1/milestones/?projectId=${projectId}${specFilter}`,
          { method: "GET" }
        );
        return asList<Milestone>(response.data);
      },
      createMilestone: async (milestone: Partial<Milestone>): Promise<Milestone> => {
        const response = await this.makeRequest<{ success: boolean; data?: unknown }>(
          "project",
          "/api/v1/milestones/",
          {
            method: "POST",
            body: JSON.stringify({
              projectId,
              name: milestone.name,
              description: milestone.description,
              specName: milestone.specName,
              order: 0,
              status: "pending",
            }),
          }
        );
        if (!response.success || !response.data) {
          throw new Error("Failed to create milestone");
        }
        // Extract data from response
        const responseData = response.data as Record<string, unknown>;
        return {
          id: responseData.id as string,
          specName: (responseData.specName as string) || (milestone.specName as string) || "default",
          name: (responseData.name as string) || (milestone.name as string) || "Milestone",
          description: responseData.description as string | undefined,
        };
      },
    };

    // Find or create milestone for this spec
    const milestoneId = await findOrCreateMilestone(specName, apiClient);

    // Process each task
    for (const task of localTasks) {
      try {
        // Set milestone ID
        task.milestoneId = milestoneId;

        // Split task and subtasks for server push
        const { mainTask, subtasks } = splitTaskAndSubtasks(task);

        // Check if task already exists on server
        const existingTask = await this.fetchTaskById(projectId, task.id);

        if (existingTask) {
          // Update existing task
          await this.updateTask(projectId, task.id, mainTask);
          console.log(`Updated task: ${task.title}`);
        } else {
          // Create new task
          const createdTask = await this.createTask(projectId, mainTask);
          console.log(`Created task: ${task.title}`);
          
          // Update local file with server ID if different
          if (createdTask.id !== task.id) {
            await this.taskFileManager.deleteTaskFile(task.id, specName);
            task.id = createdTask.id;
            await this.taskFileManager.writeTaskFile(task, specName);
          }
        }

        // Push subtasks
        for (const subtask of subtasks) {
          await this.createOrUpdateSubtask(projectId, subtask);
        }

        // Upload task assets
        await this.taskFileManager.uploadTaskAssets(task, specName);
      } catch (error) {
        console.error(`Failed to push task ${task.title}:`, error);
        throw error;
      }
    }
  }

  /**
   * Push tasks using TasksConverter (Kiro format)
   * Reads from tasks.md file with milestone structure
   */
  private async pushTasksAsMilestone(
    projectId: string,
    artifact: LocalArtifact,
    options: PushOptions = {}
  ): Promise<void> {
    const specName = artifact.specName || "default";
    
    if (options.verbose) {
      console.log(`[VERBOSE] Pushing tasks in Kiro format for spec: ${specName}`);
    }

    // Read tasks.md content
    const tasksContent = artifact.content;
    
    // Convert Kiro format to server format
    const milestones = kiroFormatToServer(tasksContent);
    
    if (options.verbose) {
      console.log(`[VERBOSE] Parsed ${milestones.length} milestone(s) from Kiro format`);
    }

    // Create API client wrapper for milestone operations
    const apiClient = {
      getMilestones: async (specName: string): Promise<Milestone[]> => {
        const specFilter = specName ? `&specName=${encodeURIComponent(specName)}` : "";
        const response = await this.makeRequest<unknown>(
          "project",
          `/api/v1/milestones/?projectId=${projectId}${specFilter}`,
          { method: "GET" }
        );
        return asList<Milestone>(response.data);
      },
      createMilestone: async (milestone: Partial<Milestone>): Promise<Milestone> => {
        const response = await this.makeRequest<{ success: boolean; data?: unknown }>(
          "project",
          "/api/v1/milestones/",
          {
            method: "POST",
            body: JSON.stringify({
              projectId,
              name: milestone.name,
              description: milestone.description,
              specName: milestone.specName,
              order: 0,
              status: "pending",
            }),
          }
        );
        if (!response.success || !response.data) {
          throw new Error("Failed to create milestone");
        }
        const responseData = response.data as Record<string, unknown>;
        return {
          id: responseData.id as string,
          specName: (responseData.specName as string) || (milestone.specName as string) || "default",
          name: (responseData.name as string) || (milestone.name as string) || "Milestone",
          description: responseData.description as string | undefined,
        };
      },
    };

    // Get existing milestones and tasks for duplicate detection
    const existingMilestones = await apiClient.getMilestones(specName);
    
    // Process each milestone
    for (const kiroMilestone of milestones) {
      try {
        // Find or create milestone
        let milestoneId: string;
        const existingMilestone = existingMilestones.find(m => m.name === kiroMilestone.name);
        
        if (existingMilestone) {
          milestoneId = existingMilestone.id;
          if (options.verbose) {
            console.log(`[VERBOSE] Using existing milestone: ${kiroMilestone.name} (ID: ${milestoneId})`);
          }
        } else {
          const newMilestone = await apiClient.createMilestone({
            specName,
            name: kiroMilestone.name,
            description: kiroMilestone.description,
          });
          milestoneId = newMilestone.id;
          if (options.verbose) {
            console.log(`[VERBOSE] Created new milestone: ${kiroMilestone.name} (ID: ${milestoneId})`);
          }
        }

        // Fetch existing tasks for this milestone for duplicate detection
        const existingTasksResponse = await this.makeRequest<unknown>(
          "project",
          `/api/v1/tasks/?projectId=${projectId}&milestoneId=${milestoneId}`,
          { method: "GET" }
        );
        const existingTasks = asList<{ id: string; title?: string; description?: string; status?: string }>(existingTasksResponse.data);

        // Convert existing tasks to KiroTask format for duplicate detection
        const existingKiroTasks: KiroTask[] = existingTasks.map(t => ({
          id: t.id,
          description: t.description || t.title || "",
          status: (t.status as TaskStatus) || "not_started",
          isOptional: false,
          order: 0,
        }));

        // Process each task in the milestone
        let taskOrder = 0;
        for (const kiroTask of kiroMilestone.tasks) {
          // Check for duplicate task using normalized description
          const duplicate = detectDuplicateTask(
            kiroTask.description,
            existingKiroTasks,
            { verbose: options.verbose }
          );

          if (duplicate) {
            if (options.verbose) {
              console.log(`[VERBOSE] Skipping duplicate task: "${kiroTask.description.substring(0, 50)}..."`);
            }
            continue;
          }

          // Create task on server
          const taskData = {
            projectId,
            milestoneId,
            title: kiroTask.description,
            description: kiroTask.description,
            status: kiroTask.status,
            order: taskOrder++,
            specName,
            parentTaskId: kiroTask.parentTaskId,
          };

          const response = await this.makeRequest<{ success: boolean; data?: unknown }>(
            "project",
            "/api/v1/tasks/",
            {
              method: "POST",
              body: JSON.stringify(taskData),
            }
          );

          if (response.success && response.data) {
            const responseData = response.data as Record<string, unknown>;
            const createdTask = { id: responseData.id as string };
            if (options.verbose) {
              console.log(`[VERBOSE] Created task: "${kiroTask.description.substring(0, 50)}..." (ID: ${createdTask.id})`);
            }
            
            // Store task ID for subtask parent references
            kiroTask.id = createdTask.id;
          } else {
            console.warn(`[push] Failed to create task: ${kiroTask.description}`);
          }
        }
      } catch (error) {
        console.error(`Failed to push milestone ${kiroMilestone.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * TODO: Reconstruct tasks.md from server milestones and tasks
   * Uses TasksConverter to convert to Kiro format
   * 
   * This method will be used in the future when we add support for pulling
   * tasks in Kiro format (single tasks.md file) instead of individual task files.
   * 
   * Implementation is ready but commented out to avoid unused code warnings.
   * Uncomment when needed for Kiro format pull support.
   */
  /*
  private async _reconstructTasksMarkdown(
    projectId: string,
    specName: string,
    options: PullOptions = {}
  ): Promise<string> {
    if (options.verbose) {
      console.log(`[VERBOSE] Reconstructing tasks.md in Kiro format for spec: ${specName}`);
    }

    // Fetch milestones for this spec
    const specFilter = specName ? `&specName=${encodeURIComponent(specName)}` : "";
    const milestoneResponse = await this.makeRequest<unknown>(
      "project",
      `/api/v1/milestones/?projectId=${projectId}${specFilter}`,
      { method: "GET" }
    );
    const serverMilestones = asList<{ id: string; name: string; description?: string; specName?: string }>(milestoneResponse.data);

    if (options.verbose) {
      console.log(`[VERBOSE] Found ${serverMilestones.length} milestone(s) for spec: ${specName}`);
    }

    // Convert to Kiro milestone format
    const kiroMilestones: KiroMilestone[] = [];

    for (const milestone of serverMilestones) {
      // Fetch tasks for this milestone
      const tasksResponse = await this.makeRequest<unknown>(
        "project",
        `/api/v1/tasks/?projectId=${projectId}&milestoneId=${milestone.id}`,
        { method: "GET" }
      );
      const serverTasks = asList<{
        id: string;
        title?: string;
        description?: string;
        status?: string;
        order?: number;
        parentTaskId?: string;
      }>(tasksResponse.data);

      if (options.verbose) {
        console.log(`[VERBOSE] Found ${serverTasks.length} task(s) for milestone: ${milestone.name}`);
      }

      // Convert tasks to Kiro format
      const kiroTasks: KiroTask[] = serverTasks.map((task, index) => ({
        id: task.id,
        description: task.description || task.title || "Untitled Task",
        status: (task.status as TaskStatus) || "not_started",
        isOptional: false,
        order: task.order !== undefined ? task.order : index,
        parentTaskId: task.parentTaskId,
      }));

      kiroMilestones.push({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        tasks: kiroTasks,
      });
    }

    // Convert to Kiro format markdown
    const markdown = serverToKiroFormat(kiroMilestones);

    if (options.verbose) {
      console.log(`[VERBOSE] Generated tasks.md with ${markdown.split('\n').length} lines`);
    }

    return markdown;
  }
  */

  /**
   * Fetch task by ID from server
   */
  private async fetchTaskById(_projectId: string, taskId: string): Promise<Task | null> {
    try {
      const response = await this.makeRequest<{ success: boolean; data?: any }>(
        "project",
        `/api/v1/tasks/${taskId}`,
        { method: "GET" }
      );
      if (!response.success || !response.data) {
        return null;
      }
      const data = response.data as any;
      return {
        id: data.id,
        specName: data.specName || "default",
        milestoneId: data.milestoneId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignee: data.assignee,
        dueDate: data.dueDate,
        tags: data.tags,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create task on server
   */
  private async createTask(_projectId: string, task: Omit<Task, "subtasks">): Promise<Task> {
    const response = await this.makeRequest<{ success: boolean; data?: any }>(
      "project",
      "/api/v1/tasks/",
      {
        method: "POST",
        body: JSON.stringify({
          projectId: _projectId,
          milestoneId: task.milestoneId,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee: task.assignee,
          dueDate: task.dueDate,
          tags: task.tags,
          specName: task.specName || "default",
        }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(`Failed to create task: ${task.title}`);
    }

    // Map server response to Task type
    const serverTask = response.data as any;
    return {
      id: serverTask.id || task.id,
      specName: task.specName,
      milestoneId: task.milestoneId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      tags: task.tags,
      createdAt: serverTask.createdAt || new Date().toISOString(),
      updatedAt: serverTask.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Update task on server
   */
  private async updateTask(_projectId: string, taskId: string, task: Omit<Task, "subtasks">): Promise<void> {
    const response = await this.makeRequest<{ success: boolean }>(
      "project",
      `/api/v1/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee: task.assignee,
          dueDate: task.dueDate,
          tags: task.tags,
        }),
      }
    );

    if (!response.success) {
      throw new Error(`Failed to update task: ${task.title}`);
    }
  }

  /**
   * Create or update subtask on server
   */
  private async createOrUpdateSubtask(
    _projectId: string,
    subtask: { id?: string; description: string; status: TaskStatus; order: number; parentTaskId: string }
  ): Promise<void> {
    if (subtask.id) {
      // Update existing subtask
      await this.makeRequest<{ success: boolean }>(
        "project",
        `/api/v1/tasks/${subtask.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: subtask.description,
            description: subtask.description,
            status: subtask.status,
            order: subtask.order,
            parentTaskId: subtask.parentTaskId,
          }),
        }
      );
    } else {
      // Create new subtask
      await this.makeRequest<{ success: boolean }>(
        "project",
        "/api/v1/tasks/",
        {
          method: "POST",
          body: JSON.stringify({
            projectId: _projectId,
            title: subtask.description,
            description: subtask.description,
            status: subtask.status,
            order: subtask.order,
            parentTaskId: subtask.parentTaskId,
            type: "subtask",
          }),
        }
      );
    }
  }

  /**
   * Rename artifact file to use server ID
   */
  private async renameArtifactFile(
    artifact: LocalArtifact,
    artifactId: string
  ): Promise<void> {
    const oldPath = artifact.filePath;
    const dir = dirname(oldPath);
    const newFileName = `${artifact.artifactType}_${artifactId}.md`;
    const newPath = join(dir, newFileName);

    try {
      await fs.rename(oldPath, newPath);
    } catch (error) {
      // If rename fails, log but don't throw (file might already be renamed)
      console.warn(`Failed to rename file ${oldPath} to ${newPath}: ${error}`);
    }
  }

  /**
   * Make HTTP request using ServiceAwareAPIClient pattern
   * Includes retry logic for network errors
   */
  private async makeRequest<T>(
    serviceType: "user" | "project",
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const baseURL = serviceType === "user"
      ? configManager.getUserServiceUrl()
      : configManager.getProjectServiceUrl();
    const base = baseURL.replace(/\/$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;
    const method = (options.method ?? "GET").toUpperCase();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(configManager.getAuth()?.token && {
        Authorization: `Bearer ${configManager.getAuth()!.token}`,
      }),
      ...((options.headers as Record<string, string>) || {}),
    };

    console.error(`[${method}] ${url}`);

    // Wrap fetch in retry logic for network errors
    try {
      const response = await retryNetworkRequest(
        async () => {
          const res = await fetch(url, {
            ...options,
            headers,
          });
          
          // Don't retry on 4xx errors (client errors)
          if (!res.ok && res.status >= 400 && res.status < 500) {
            const errorData = await res.json().catch(() => ({}));
            const msg = (errorData as Record<string, unknown>)?.message ?? `HTTP ${res.status}`;
            throw new Error(`Client error: ${String(msg)}`);
          }
          
          return res;
        },
        { verbose: false }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = (errorData as Record<string, unknown>)?.message ?? `HTTP ${response.status}`;
        const bodySnippet = JSON.stringify(errorData).slice(0, 200);
        console.error(`[${method}] FAILED ${response.status} ${url}`, bodySnippet);
        return {
          success: false,
          error: `${String(msg)} (${url})`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${method}] REQUEST ERROR ${url}:`, errorMsg);
      return {
        success: false,
        error: `${errorMsg} (${url})`,
      };
    }
  }

  /**
   * Fetch artifacts from server
   * Filters to only return the latest version of each artifact
   */
  private async fetchServerArtifacts(
    projectId: string,
    filters: ArtifactFilters
  ): Promise<ServerArtifact[]> {
    const artifacts: ServerArtifact[] = [];

    // Fetch from appropriate endpoints based on artifact type
    if (!filters.artifactType || filters.artifactType === "requirement") {
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/requirements/?projectId=${projectId}${filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : ""}`,
        { method: "GET" }
      );
      const list = asList<{ id: string; specName?: string; name: string; content: unknown; version: number; createdAt: string; updatedAt: string }>(response.data);
      for (const req of list) {
        if (filters.specName && req.specName !== filters.specName) continue;
        if (filters.artifactName && req.name !== filters.artifactName) continue;
        const createdAt = req.createdAt;
        
        // Use extractContent to handle different content formats
        const content = extractContent({ content: req.content });
        
        artifacts.push({
          artifactId: req.id,
          specName: req.specName || "default",
          artifactType: "requirement",
          artifactName: req.name,
          content,
          version: req.version,
          createdAt: new Date(createdAt),
          updatedAt: new Date(req.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "hld" || filters.artifactType === "lld") {
      const typeFilter = filters.artifactType === "hld" ? "hld" : filters.artifactType === "lld" ? "lld" : undefined;
      const specFilter = filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : "";
      const endpoint = typeFilter 
        ? `/api/v1/designs/?projectId=${projectId}&type=${typeFilter}${specFilter}`
        : `/api/v1/designs/?projectId=${projectId}${specFilter}`;
      
      const response = await this.makeRequest<unknown>(
        "project",
        endpoint,
        { method: "GET" }
      );
      const list = asList<{ id: string; specName?: string; type: string; name: string; content: unknown; version: number; createdAt: string; updatedAt: string }>(response.data);
      for (const design of list) {
        if (filters.specName && design.specName !== filters.specName) continue;
        if (filters.artifactName && design.name !== filters.artifactName) continue;
        
        // Use extractContent to handle different content formats
        const content = extractContent({ content: design.content });
        
        artifacts.push({
          artifactId: design.id,
          specName: design.specName || "default",
          artifactType: design.type as ArtifactType,
          artifactName: design.name,
          content,
          version: design.version,
          createdAt: new Date(design.createdAt),
          updatedAt: new Date(design.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "tasks") {
      const specFilter = filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : "";
      const milestoneResponse = await this.makeRequest<unknown>(
        "project",
        `/api/v1/milestones/?projectId=${projectId}${specFilter}`,
        { method: "GET" }
      );
      const milestones = asList<{ id: string; name: string; description?: string; specName?: string; createdAt: string; updatedAt: string }>(milestoneResponse.data);
      
      for (const milestone of milestones) {
        const tasksResponse = await this.makeRequest<unknown>(
          "project",
          `/api/v1/tasks/?projectId=${projectId}&milestoneId=${milestone.id}${specFilter}`,
          { method: "GET" }
        );
        
        type TaskRecord = {
          id: string;
          title?: string;
          description?: string;
          status?: string;
          priority?: string;
          assignee?: string;
          dueDate?: string;
          tags?: string[];
          order?: number;
          locked?: boolean;
          specName?: string;
          subtasks?: Array<{
            id: string;
            description: string;
            status: string;
            order: number;
          }>;
          checklist?: Array<{
            id: string;
            text: string;
            completed: boolean;
            order: number;
          }>;
          comments?: Array<{
            id: string;
            author: string;
            content: string;
            createdAt: string;
          }>;
          attachments?: Array<{
            id: string;
            filename: string;
            url: string;
            size: number;
            mimeType: string;
          }>;
          createdAt: string;
          updatedAt: string;
        };
        
        const tasks = asList<TaskRecord>(tasksResponse.data);
        const specName = milestone.specName || (tasks.length > 0 && tasks[0].specName) || "default";
        
        // Convert each task to individual task file format
        for (const taskData of tasks) {
          // Skip subtasks (they will be included in parent task)
          if (taskData.order !== undefined && tasks.some(t => t.id === taskData.id && t.subtasks?.some(st => st.id === taskData.id))) {
            continue;
          }
          
          const task: Task = {
            id: taskData.id,
            specName,
            milestoneId: milestone.id,
            title: taskData.title || "Untitled Task",
            description: taskData.description || "",
            status: (taskData.status as TaskStatus) || "not_started",
            priority: (taskData.priority as any),
            assignee: taskData.assignee,
            dueDate: taskData.dueDate,
            tags: taskData.tags,
            subtasks: (taskData.subtasks || []).map(st => ({
              id: st.id,
              description: st.description,
              status: st.status as TaskStatus,
              order: st.order,
            })),
            checklist: taskData.checklist || [],
            comments: taskData.comments || [],
            attachments: taskData.attachments || [],
            createdAt: taskData.createdAt,
            updatedAt: taskData.updatedAt,
          };
          
          // Convert task to markdown content with error handling
          let markdown: string;
          try {
            markdown = this.taskFileManager.serverToTaskFile(task);
          } catch (conversionError) {
            // Log conversion error and use fallback: JSON stringify
            const errorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
            console.warn(`[fetch] Failed to convert task to markdown format for task ${task.id}: ${errorMsg}`);
            console.warn(`[fetch] Fallback: Using JSON representation`);
            
            // Fallback: use JSON representation of task
            markdown = JSON.stringify(task, null, 2);
          }
          
          artifacts.push({
            artifactId: task.id,
            specName,
            artifactType: "tasks",
            artifactName: task.title,
            content: markdown,
            version: 1,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
          });
        }
      }
    }

    if (!filters.artifactType || filters.artifactType === "flow_diagram") {
      const specFilter = filters.specName ? `&specName=${encodeURIComponent(filters.specName)}` : "";
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/er-diagrams/?projectId=${projectId}${specFilter}`,
        { method: "GET" }
      );
      const list = asList<{ id: string; specName?: string; name: string; content: unknown; version?: number; createdAt: string; updatedAt: string }>(response.data);
      for (const diagram of list) {
        if (filters.specName && diagram.specName !== filters.specName) continue;
        if (filters.artifactName && diagram.name !== filters.artifactName) continue;
        
        // Use extractContent to handle different content formats
        const content = extractContent({ content: diagram.content });
        
        artifacts.push({
          artifactId: diagram.id,
          specName: diagram.specName || "default",
          artifactType: "flow_diagram",
          artifactName: diagram.name,
          content,
          version: diagram.version || 1,
          createdAt: new Date(diagram.createdAt),
          updatedAt: new Date(diagram.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "context") {
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/projects/${projectId}/contexts`,
        { method: "GET" }
      );
      const list = asList<{ id: string; title: string; content: unknown; createdAt: string; updatedAt: string }>(response.data);
      for (const ctx of list) {
        if (filters.artifactName && ctx.title !== filters.artifactName) continue;
        
        // Use extractContent to handle different content formats
        const content = extractContent({ content: ctx.content });
        
        artifacts.push({
          artifactId: ctx.id,
          specName: "default",
          artifactType: "context",
          artifactName: ctx.title,
          content,
          version: 1,
          createdAt: new Date(ctx.createdAt),
          updatedAt: new Date(ctx.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "code_guideline") {
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/projects/${projectId}/code-guidelines`,
        { method: "GET" }
      );
      const raw = response.data as { data?: { guidelines?: Array<{ id: string; title: string; content: unknown; scope: string; scopeId: string | null; createdAt: string; updatedAt: string }> } } | undefined;
      const guidelines = raw?.data?.guidelines ?? [];
      const projectOnly = guidelines.filter((g: { scope: string }) => g.scope === "project");
      for (const g of projectOnly) {
        if (filters.artifactName && g.title !== filters.artifactName) continue;
        
        // Use extractContent to handle different content formats
        const content = extractContent({ content: g.content });
        
        artifacts.push({
          artifactId: g.id,
          specName: "default",
          artifactType: "code_guideline",
          artifactName: g.title,
          content,
          version: 1,
          createdAt: new Date(g.createdAt),
          updatedAt: new Date(g.updatedAt),
        });
      }
    }

    if (!filters.artifactType || filters.artifactType === "wireframe_files") {
      const response = await this.makeRequest<unknown>(
        "project",
        `/api/v1/projects/${projectId}/wireframes`,
        { method: "GET" }
      );
      const list = asList<{ id: string; name: string; elements?: unknown; createdAt: string; updatedAt: string }>(response.data);
      for (const wf of list) {
        if (filters.artifactName && wf.name !== filters.artifactName) continue;
        
        // Use extractContent to handle different content formats
        const content = extractContent({ content: wf.elements });
        
        artifacts.push({
          artifactId: wf.id,
          specName: "default",
          artifactType: "wireframe_files",
          artifactName: wf.name,
          content,
          version: 1,
          createdAt: new Date(wf.createdAt),
          updatedAt: new Date(wf.updatedAt),
        });
      }
    }

    // Filter to only latest version of each artifact
    // Group by artifactId and keep only the highest version
    const latestVersions = this.filterToLatestVersions(artifacts);
    
    return latestVersions;
  }

  /**
   * Filter artifacts to only return the latest version of each artifact
   * Groups by artifactId and returns the artifact with the highest version number
   */
  private filterToLatestVersions(artifacts: ServerArtifact[]): ServerArtifact[] {
    const artifactMap = new Map<string, ServerArtifact>();
    
    for (const artifact of artifacts) {
      const existing = artifactMap.get(artifact.artifactId);
      
      if (!existing || artifact.version > existing.version) {
        artifactMap.set(artifact.artifactId, artifact);
      }
    }
    
    return Array.from(artifactMap.values());
  }

  /**
   * Fetch single artifact from server (non-deleted only).
   * Uses list endpoints which exclude soft-deleted (deletedAt: null on server);
   * deleted artifacts are treated as non-existing so push will create new.
   * Returns the latest version if multiple versions exist.
   */
  private async fetchServerArtifact(
    projectId: string,
    specName: string,
    artifactType: ArtifactType,
    artifactName: string
  ): Promise<ServerArtifact | null> {
    const artifacts = await this.fetchServerArtifacts(projectId, {
      specName,
      artifactType,
      artifactName,
    });

    if (artifacts.length === 0) {
      return null;
    }

    // Return the artifact with the highest version (latest)
    return artifacts.reduce((latest, current) => {
      return current.version > latest.version ? current : latest;
    });
  }

  /**
   * Calculate content hash using normalized content
   */
  private calculateHash(content: string): string {
    return computeContentHash(content);
  }

  /**
   * Get artifact file path
   */
  private getArtifactPath(artifact: ArtifactMetadata & { artifactId?: string }): string {
    if (artifact.artifactType === "tasks") {
      // Tasks use individual files: tasks_<task_id>.md
      return `.quikim/artifacts/${artifact.specName}/tasks_${artifact.artifactId}.md`;
    }
    
    const fileName = artifact.artifactId 
      ? `${artifact.artifactType}_${artifact.artifactId}.md`
      : `${artifact.artifactType}_${artifact.artifactName}.md`;
    return `.quikim/artifacts/${artifact.specName}/${fileName}`;
  }

  /**
   * Update artifact metadata (name and specName)
   */
  async updateArtifactMetadata(
    artifactType: string,
    identifier: string,
    updates: { name?: string; specName?: string }
  ): Promise<void> {
    const project = configManager.getCurrentProject();
    if (!project) {
      throw new Error("No project connected. Run 'quikim connect' first.");
    }

    // Determine if identifier is an ID (UUID) or name
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    let endpoint: string;
    let method = "PATCH";

    switch (artifactType) {
      case "requirement":
        endpoint = isId 
          ? `/api/v1/requirements/${identifier}`
          : `/api/v1/requirements/?projectId=${project.projectId}&name=${encodeURIComponent(identifier)}`;
        break;

      case "hld":
      case "lld":
        endpoint = isId
          ? `/api/v1/designs/${identifier}`
          : `/api/v1/designs/?projectId=${project.projectId}&type=${artifactType}&name=${encodeURIComponent(identifier)}`;
        break;

      case "context":
      case "code_guideline":
      case "wireframe_files":
        endpoint = `/api/v1/projects/${project.projectId}/artifacts/${identifier}`;
        break;

      case "tasks":
        // For tasks, update milestone
        endpoint = isId
          ? `/api/v1/milestones/${identifier}`
          : `/api/v1/milestones/?projectId=${project.projectId}&name=${encodeURIComponent(identifier)}`;
        break;

      default:
        throw new Error(`Cannot edit ${artifactType}`);
    }

    const requestBody: any = {};
    if (updates.name) {
      if (artifactType === "tasks") {
        requestBody.name = updates.name;
      } else {
        requestBody.name = updates.name;
      }
    }

    // Note: specName updates may require different endpoints or may not be supported
    // This is a simplified implementation
    if (updates.specName && artifactType !== "tasks") {
      // For most artifacts, specName is set on creation and may not be updatable
      // This would require checking the API documentation
    }

    const response = await this.makeRequest<{
      success: boolean;
      data?: any;
    }>("project", endpoint, {
      method,
      body: JSON.stringify(requestBody),
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to update artifact");
    }
  }
}
