/**
 * Quikim - Tool Response Instructions
 * All instructions for tool handlers - NO hardcoded instructions in handlers
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { generateMissingArtifactsInstructions, generateProjectContextInstructions, generateSyncFailureInstructions } from './missing-artifacts.js';

export function generateRequirementsMissingInstructions(): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: ['requirements'],
    projectName: 'your project',
    nextStep: 'pushing requirements'
  });
}

export function generateHLDMissingInstructions(): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: ['hld'],
    projectName: 'your project',
    nextStep: 'pushing HLD'
  });
}

export function generateLLDMissingInstructions(): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: ['lld'],
    projectName: 'your project',
    nextStep: 'pushing LLD'
  });
}

export function generateWireframesMissingInstructions(): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: ['wireframes'],
    projectName: 'your project',
    nextStep: 'pushing wireframes'
  });
}

export function generateTasksMissingInstructions(): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: ['tasks'],
    projectName: 'your project',
    nextStep: 'pushing tasks'
  });
}

export function generateERDiagramMissingInstructions(missing: string[]): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: missing,
    projectName: 'your project',
    nextStep: 'generating ER diagram'
  });
}

export function generatePrismaSchemaMissingInstructions(missing: string[]): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: missing,
    projectName: 'your project',
    nextStep: 'generating Prisma schema'
  });
}

export function generateCodeImplementationMissingInstructions(missing: string[]): string {
  return generateMissingArtifactsInstructions({
    missingArtifacts: missing,
    projectName: 'your project',
    nextStep: 'implementing code'
  });
}

export function generateArtifactSyncedInstructions(artifactType: string, filePath: string): string {
  return `${artifactType} successfully synced to Quikim platform.

**Synced File:** ${filePath}

**Next Steps:**
Continue with your workflow. The ${artifactType} is now available in the Quikim platform.`;
}

export function generateArtifactPulledInstructions(artifactType: string, version: number, filePath: string): string {
  return `Update ${artifactType} from platform (v${version}). Review and update if needed.

**File Location:** ${filePath}

**Action Required:**
1. Review the ${artifactType} content
2. Update if needed based on your requirements
3. Save changes and proceed with next steps

**Next Steps:**
After reviewing, you can update the ${artifactType} further or proceed to the next artifact.`;
}

export function generateContextExtractionFailedInstructions(artifactType: string): string {
  return `Unable to extract ${artifactType} context. Please ensure prerequisite files are properly formatted.

**Action Required:**
1. Check that all prerequisite files exist and are properly formatted
2. Verify file structure matches expected format
3. Ensure files contain valid content

**Next Steps:**
After fixing file formatting, retry the operation.`;
}

export function generateFileCreatedInstructions(artifactType: string, filePath: string): string {
  return `${artifactType} file will be created at ${filePath}. Please review and update if needed, or proceed to the next step.

**File Location:** ${filePath}

**Next Steps:**
After creating the ${artifactType}, you can update it further or proceed to the next artifact.`;
}

export function generateGatherFilesInstruction(filePattern: string): string {
  return `Read the file(s) matching pattern: ${filePattern}

**Action Required:**
1. Use Read tool to get the file content
2. Include the file in codebase.files array
3. Call the MCP tool again with the file content

This is a standard workflow - the MCP server needs the file content to process your request.`;
}

export function generateRequirementsUploadInstructions(existingVersions: number[]): string {
  const latestVersion = Math.max(...existingVersions, 0);
  const nextVersion = latestVersion > 0 ? latestVersion : 1;
  
  return `To upload requirements to the MCP server:

**Step 1:** Read the existing requirements file
- File location: .quikim/v${nextVersion}/requirements.md

**Step 2:** Include the file content in your tool call
- Use the push_requirements tool with codebase.files array containing the requirements file

**Example:**
Call push_requirements with:
{
  "codebase": {
    "files": [
      {
        "path": ".quikim/v${nextVersion}/requirements.md",
        "content": "[content from the file you read]"
      }
    ]
  },
  "user_prompt": "Upload cursor rules as requirements to MCP server"
}

The requirements file already exists locally - you just need to read it and include it in the tool call.`;
}

export function generateInvalidCodebaseStructureError(userPrompt: string): string {
  return `ERROR: Invalid request format for MCP tool.

Expected format:
{
  "codebase": {
    "files": [
      {
        "path": ".quikim/v1/requirements.md",
        "content": "# Requirements\\n\\n[your content]"
      }
    ]
  },
  "user_prompt": "${userPrompt}"
}

Current issue: codebase.files is missing or not an array.

If you're trying to upload content, you need to:
1. Read the required files first
2. Include those files in codebase.files array when calling this tool`;
}

export function generateRequirementsFileNotFoundError(filesInRequest: string[]): string {
  return `Requirements file not found in request.

Current files in request: ${filesInRequest.join(', ') || 'none'}

Expected: .quikim/v*/requirements.md file in codebase.files array`;
}

// Re-export from missing-artifacts
export { generateProjectContextInstructions, generateSyncFailureInstructions };
