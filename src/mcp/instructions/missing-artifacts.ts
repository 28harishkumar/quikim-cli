/**
 * Missing Artifacts Instructions
 * Instructions sent to Cursor when artifacts are missing
 * MCP server NEVER sends errors - always sends instructions
 */

export interface MissingArtifactContext {
  missingArtifacts: string[];
  projectName: string;
  nextStep: string;
}

export function generateMissingArtifactsInstructions(
  context: MissingArtifactContext
): string {
  const { missingArtifacts, nextStep } = context;

  const artifactMap: Record<string, { tool: string; description: string }> = {
    requirements: {
      tool: "pull_requirements",
      description: "requirements document",
    },
    hld: {
      tool: "pull_hld",
      description: "High-Level Design (HLD) document",
    },
    wireframes: {
      tool: "pull_wireframe",
      description: "wireframes document",
    },
    "er-diagram": {
      tool: "er_diagram_pull",
      description: "ER diagram",
    },
    tasks: {
      tool: "pull_tasks",
      description: "tasks document",
    },
  };

  const missingList = missingArtifacts
    .map((artifact) => {
      const info = artifactMap[artifact] || { tool: "", description: artifact };
      return `- ${info.description} (use ${info.tool} tool)`;
    })
    .join("\n");

  return `The following artifacts are required before ${nextStep}:

${missingList}

**Action Required:**
Please create the missing artifacts in order:
1. Start with requirements (if missing)
2. Then create HLD (if missing)
3. Then create other artifacts as needed

**Next Steps:**
After creating all required artifacts, proceed with ${nextStep}.`;
}

export function generateProjectContextInstructions(): string {
  return `Project context is not configured.

**Action Required:**
Create .quikim/project.json file with the following structure:

\`\`\`json
{
  "projectId": "[your-project-id]",
  "organizationId": "[your-organization-id]",
  "userId": "[your-user-id]",
  "latestVersion": 1
}
\`\`\`

**How to get project context:**
1. Get project ID from Quikim dashboard
2. Get organization ID from your account settings
3. Create the file at: .quikim/project.json

**Next Steps:**
After creating project.json, retry the operation.`;
}

export function generateSyncFailureInstructions(
  artifactType: string,
  error?: string
): string {
  return `Failed to sync ${artifactType} to Quikim platform.

**Action Required:**
1. Check your API configuration:
   - Verify QUIKIM_API_BASE_URL environment variable
   - Verify QUIKIM_API_KEY environment variable
2. Ensure you have an active subscription
3. Verify project access permissions

**Troubleshooting:**
${error ? `Error details: ${error}\n\n` : ""}**Next Steps:**
After fixing API configuration, retry the sync operation using the push tool again.`;
}
