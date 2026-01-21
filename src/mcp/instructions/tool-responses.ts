/**
 * Tool Response Instructions
 * All instructions for tool handlers - NO hardcoded instructions in handlers
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

// Re-export from missing-artifacts
export { generateProjectContextInstructions, generateSyncFailureInstructions };
