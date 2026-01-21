/**
 * Requirement Handler - Handles requirement creation and updates with versioning
 * Implements single-response completion for requirement workflows
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { XMLResponse, PromptAnalysis } from '../types.js';
import { CodebaseContext } from '../session/types.js';
import { logger } from '../utils/logger.js';

export interface RequirementHandlerConfig {
  useEARSPattern: boolean;
  includeAcceptanceCriteria: boolean;
  generateUserStories: boolean;
}

export class RequirementHandler {
  private config: RequirementHandlerConfig;

  constructor(config: RequirementHandlerConfig = {
    useEARSPattern: true,
    includeAcceptanceCriteria: true,
    generateUserStories: true
  }) {
    this.config = config;
  }

  /**
   * Handle requirement creation (new project)
   * Creates v1/requirements.md
   */
  handleCreate(
    userPrompt: string,
    analysis: PromptAnalysis,
    requestId: string
  ): XMLResponse {
    logger.info('Creating new requirements document', { 
      userPrompt: userPrompt.substring(0, 100),
      isNewProject: analysis.is_new_project 
    });

    // Generate requirements content
    const requirements = this.generateRequirements(userPrompt, null);
    const version = 1;
    const filePath = `.quikim/v${version}/requirements.md`;

    return {
      requestId,
      action: 'create_file',
      instructions: `Create the requirements document (v${version}) for the new project. This will establish the project foundation.`,
      parameters: {
        filePath,
        content: requirements
      },
      reasoning: `New project detected. Creating requirements v${version} based on user prompt: "${userPrompt.substring(0, 50)}..."`,
      finalResponse: `I've created the requirements document (v${version}) for your project. The requirements are structured using the EARS pattern and include user stories with acceptance criteria. Please review the document at ${filePath}.`
    };
  }

  /**
   * Handle requirement updates (existing project)
   * Creates new version directory with updated requirements
   */
  handleUpdate(
    userPrompt: string,
    analysis: PromptAnalysis,
    codebase: CodebaseContext,
    requestId: string
  ): XMLResponse {
    logger.info('Updating requirements document', { 
      userPrompt: userPrompt.substring(0, 100),
      latestVersion: analysis.latest_version 
    });

    // Find existing requirements in latest version
    const existingRequirements = this.findLatestRequirements(analysis, codebase);
    
    // Generate updated requirements
    const updatedRequirements = this.generateRequirements(userPrompt, existingRequirements);
    const newVersion = (analysis.latest_version || 0) + 1;
    const filePath = `.quikim/v${newVersion}/requirements.md`;

    return {
      requestId,
      action: 'create_file',
      instructions: `Create updated requirements document (v${newVersion}). This preserves the previous version while adding the new requirements.`,
      parameters: {
        filePath,
        content: updatedRequirements
      },
      reasoning: `Updating requirements from v${analysis.latest_version} to v${newVersion}. Adding new requirements: "${userPrompt.substring(0, 50)}..."`,
      finalResponse: `I've updated the requirements document to v${newVersion}. The previous version (v${analysis.latest_version}) is preserved for reference. The new requirements include your requested changes. Please review the updated document at ${filePath}.`
    };
  }

  /**
   * Find the latest requirements document from codebase
   */
  private findLatestRequirements(analysis: PromptAnalysis, codebase: CodebaseContext): string | null {
    if (!analysis.latest_version) {
      return null;
    }

    // Look for requirements in latest version
    const requirementsPath = `.quikim/v${analysis.latest_version}/requirements.md`;
    const requirementsFile = codebase.files.find(f => f.path === requirementsPath);
    
    return requirementsFile?.content || null;
  }

  /**
   * Generate requirements content using EARS pattern
   */
  private generateRequirements(userPrompt: string, existingRequirements: string | null): string {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Extract project information from user prompt
    const projectInfo = this.extractProjectInfo(userPrompt);
    
    let content = `# Requirements Document\n\n`;
    content += `**Generated:** ${timestamp}\n`;
    content += `**Version:** ${existingRequirements ? 'Updated' : 'Initial'}\n\n`;

    // Project Overview
    content += `## Project Overview\n\n`;
    content += `${projectInfo.description}\n\n`;

    // Functional Requirements (EARS Pattern)
    content += `## Functional Requirements\n\n`;
    content += `The following requirements are structured using the EARS (Easy Approach to Requirements Syntax) pattern:\n\n`;

    const requirements = this.generateEARSRequirements(userPrompt, existingRequirements);
    requirements.forEach((req, index) => {
      content += `### FR${String(index + 1).padStart(2, '0')} - ${req.title}\n\n`;
      content += `**Requirement:** ${req.statement}\n\n`;
      if (req.rationale) {
        content += `**Rationale:** ${req.rationale}\n\n`;
      }
      if (req.acceptanceCriteria.length > 0) {
        content += `**Acceptance Criteria:**\n`;
        req.acceptanceCriteria.forEach((criteria, i) => {
          content += `${i + 1}. ${criteria}\n`;
        });
        content += `\n`;
      }
    });

    // User Stories (if enabled)
    if (this.config.generateUserStories) {
      content += `## User Stories\n\n`;
      const userStories = this.generateUserStories(userPrompt, existingRequirements);
      userStories.forEach((story, index) => {
        content += `### US${String(index + 1).padStart(2, '0')} - ${story.title}\n\n`;
        content += `**As a** ${story.actor}\n`;
        content += `**I want** ${story.action}\n`;
        content += `**So that** ${story.benefit}\n\n`;
        if (story.acceptanceCriteria.length > 0) {
          content += `**Acceptance Criteria:**\n`;
          story.acceptanceCriteria.forEach((criteria) => {
            content += `- ${criteria}\n`;
          });
          content += `\n`;
        }
      });
    }

    // Non-Functional Requirements
    content += `## Non-Functional Requirements\n\n`;
    const nfRequirements = this.generateNonFunctionalRequirements(userPrompt);
    nfRequirements.forEach((req, index) => {
      content += `### NFR${String(index + 1).padStart(2, '0')} - ${req.category}\n\n`;
      content += `${req.description}\n\n`;
    });

    // Constraints and Assumptions
    content += `## Constraints and Assumptions\n\n`;
    content += `### Constraints\n`;
    const constraints = this.generateConstraints(userPrompt);
    constraints.forEach((constraint, index) => {
      content += `${index + 1}. ${constraint}\n`;
    });

    content += `\n### Assumptions\n`;
    const assumptions = this.generateAssumptions(userPrompt);
    assumptions.forEach((assumption, index) => {
      content += `${index + 1}. ${assumption}\n`;
    });

    return content;
  }

  /**
   * Extract project information from user prompt
   */
  private extractProjectInfo(userPrompt: string): { description: string; type: string } {
    const prompt = userPrompt.toLowerCase();
    
    // Extract project type and description
    let description = userPrompt;
    let type = 'web application';

    if (prompt.includes('website') || prompt.includes('web app')) {
      type = 'website';
    } else if (prompt.includes('mobile app') || prompt.includes('app')) {
      type = 'mobile application';
    } else if (prompt.includes('api') || prompt.includes('service')) {
      type = 'API service';
    } else if (prompt.includes('dashboard')) {
      type = 'dashboard application';
    }

    // Clean up description
    description = description.replace(/^(this is a project for|create a|build a|develop a)/i, '').trim();
    if (!description.endsWith('.')) {
      description += '.';
    }

    return { description, type };
  }

  /**
   * Generate EARS pattern requirements
   */
  private generateEARSRequirements(userPrompt: string, _existingRequirements: string | null): Array<{
    title: string;
    statement: string;
    rationale?: string;
    acceptanceCriteria: string[];
  }> {
    const requirements = [];
    const prompt = userPrompt.toLowerCase();

    // Core functionality requirement
    requirements.push({
      title: 'Core Functionality',
      statement: `The system SHALL provide ${this.extractMainFeature(userPrompt)}.`,
      rationale: 'This is the primary functionality requested by the user.',
      acceptanceCriteria: [
        'The main feature is accessible to users',
        'The feature performs as expected',
        'Error handling is implemented for edge cases'
      ]
    });

    // User interface requirement (if applicable)
    if (prompt.includes('website') || prompt.includes('app') || prompt.includes('dashboard')) {
      requirements.push({
        title: 'User Interface',
        statement: 'The system SHALL provide an intuitive user interface for all core functions.',
        rationale: 'Users need an easy-to-use interface to interact with the system.',
        acceptanceCriteria: [
          'Interface is responsive across different screen sizes',
          'Navigation is clear and consistent',
          'User feedback is provided for all actions'
        ]
      });
    }

    // Data management requirement
    requirements.push({
      title: 'Data Management',
      statement: 'The system SHALL securely store and manage all user data.',
      rationale: 'Data integrity and security are essential for user trust.',
      acceptanceCriteria: [
        'Data is validated before storage',
        'Data is backed up regularly',
        'User data privacy is maintained'
      ]
    });

    // Add specific requirements based on prompt content
    if (prompt.includes('auth') || prompt.includes('login') || prompt.includes('user')) {
      requirements.push({
        title: 'User Authentication',
        statement: 'The system SHALL provide secure user authentication and authorization.',
        rationale: 'User accounts and access control are required for personalized functionality.',
        acceptanceCriteria: [
          'Users can register new accounts',
          'Users can log in securely',
          'Password requirements are enforced',
          'Session management is implemented'
        ]
      });
    }

    return requirements;
  }

  /**
   * Generate user stories
   */
  private generateUserStories(userPrompt: string, _existingRequirements: string | null): Array<{
    title: string;
    actor: string;
    action: string;
    benefit: string;
    acceptanceCriteria: string[];
  }> {
    const stories = [];
    const mainFeature = this.extractMainFeature(userPrompt);

    // Primary user story
    stories.push({
      title: 'Access Main Feature',
      actor: 'user',
      action: `access and use ${mainFeature}`,
      benefit: 'I can accomplish my primary goal efficiently',
      acceptanceCriteria: [
        'Feature is easily discoverable',
        'Feature works as expected',
        'Results are displayed clearly'
      ]
    });

    // Additional stories based on context
    const prompt = userPrompt.toLowerCase();
    
    if (prompt.includes('manage') || prompt.includes('admin')) {
      stories.push({
        title: 'Manage Content',
        actor: 'administrator',
        action: 'manage and configure system content',
        benefit: 'I can maintain the system effectively',
        acceptanceCriteria: [
          'Admin interface is accessible',
          'Content can be added, edited, and deleted',
          'Changes are reflected immediately'
        ]
      });
    }

    return stories;
  }

  /**
   * Generate non-functional requirements
   */
  private generateNonFunctionalRequirements(_userPrompt: string): Array<{
    category: string;
    description: string;
  }> {
    return [
      {
        category: 'Performance',
        description: 'The system should respond to user actions within 2 seconds under normal load conditions.'
      },
      {
        category: 'Security',
        description: 'The system must implement industry-standard security practices including data encryption and secure authentication.'
      },
      {
        category: 'Usability',
        description: 'The system should be intuitive and require minimal training for new users.'
      },
      {
        category: 'Reliability',
        description: 'The system should maintain 99.9% uptime during business hours.'
      },
      {
        category: 'Scalability',
        description: 'The system should support growth in users and data without significant performance degradation.'
      }
    ];
  }

  /**
   * Generate constraints
   */
  private generateConstraints(userPrompt: string): string[] {
    const constraints = [
      'Must comply with relevant data protection regulations',
      'Should be compatible with modern web browsers',
      'Must be maintainable by the development team'
    ];

    const prompt = userPrompt.toLowerCase();
    
    if (prompt.includes('mobile')) {
      constraints.push('Must work on both iOS and Android platforms');
    }
    
    if (prompt.includes('budget') || prompt.includes('cost')) {
      constraints.push('Development must stay within approved budget');
    }

    return constraints;
  }

  /**
   * Generate assumptions
   */
  private generateAssumptions(_userPrompt: string): string[] {
    return [
      'Users have basic computer/device literacy',
      'Internet connectivity is available for users',
      'Required third-party services will remain available',
      'User requirements will not change significantly during development'
    ];
  }

  /**
   * Extract main feature from user prompt
   */
  private extractMainFeature(userPrompt: string): string {
    const prompt = userPrompt.toLowerCase();
    
    // Try to extract the main feature/purpose
    const patterns = [
      /(?:project for|website for|app for|system for)\s+(.+?)(?:\.|$)/,
      /(?:create|build|develop)\s+(?:a|an)?\s*(.+?)(?:\s+(?:website|app|system|platform))?(?:\.|$)/,
      /(.+?)(?:\s+(?:website|app|system|platform))/
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback
    return 'the requested functionality';
  }
}