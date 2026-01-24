/**
 * Quikim - AI Agent for API Integration
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 *
 * Code Implementation Instructions
 * Instructions for code modification and implementation
 */

import { AIAgent } from '../agent/index.js';
import { QuikimAPIClient } from '../api/client.js';

/**
 * Create AI Agent instance for API interactions
 */
export function createAIAgent(apiClient: QuikimAPIClient): AIAgent {
  return new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: true
  });
}

export interface CodeImplementationContext {
  projectName: string;
  userPrompt: string;
  requirementsPath: string;
  hldPath: string;
  tasksPath?: string;
  codeGuidelines?: string[];
  sampleSnippets?: Array<{ file_path: string; content: string; description?: string }>;
  components?: Array<{ name: string; description: string; code?: string }>;
}

export function generateCodeImplementationInstructions(context: CodeImplementationContext): string {
  const { projectName, userPrompt, requirementsPath, hldPath, tasksPath, codeGuidelines, sampleSnippets, components } = context;
  
  let instructions = `Implement the requested feature: "${userPrompt}"

**Implementation Context:**
- Project: ${projectName}
- Requirements: ${requirementsPath}
- HLD: ${hldPath}
${tasksPath ? `- Tasks: ${tasksPath}\n` : ''}
**Implementation Guidelines:**
1. Follow the architecture defined in HLD
2. Use the technology stack specified in HLD
3. Implement according to requirements document
4. Follow code guidelines provided below
5. Use sample code snippets and components as reference
6. Update task status after implementation

${codeGuidelines && codeGuidelines.length > 0 ? `**Code Guidelines:**
${codeGuidelines.map(g => `- ${g}`).join('\n')}

` : ''}${sampleSnippets && sampleSnippets.length > 0 ? `**Sample Code Snippets:**
Reference these code patterns when implementing:
${sampleSnippets.map(s => `- ${s.file_path}: ${s.description || 'Code pattern'}`).join('\n')}

` : ''}${components && components.length > 0 ? `**Available Components:**
Use these components from the component library:
${components.map(c => `- ${c.name}: ${c.description}`).join('\n')}

` : ''}**Code Quality Requirements:**
Follow the code guidelines provided above. These guidelines are specific to your project's technology stack and architecture.

**Next Steps:** After implementation, update task files to mark completed tasks.`;

  return instructions;
}
