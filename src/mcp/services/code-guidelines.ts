/**
 * Quikim - Code Guidelines Service
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 * 
 * Fetches code guidelines via API (system, user, team, project scoped)
 * NO HARDCODING - All guidelines come from API
 */

import { logger } from '../utils/logger.js';
import { QuikimAPIClient } from '../api/client.js';

export interface CodeGuidelines {
  guidelines: string[];
  techStack?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    mobile?: string[];
  };
  architecture?: {
    pattern?: string;
    structure?: Record<string, string>;
  };
}

export class CodeGuidelinesService {
  private apiClient: QuikimAPIClient | null = null;

  /**
   * Initialize with API client
   */
  initialize(apiClient: QuikimAPIClient): void {
    this.apiClient = apiClient;
  }

  /**
   * Fetch code guidelines for a project via API
   */
  async getGuidelines(
    projectId: string,
    organizationId?: string,
    userId?: string
  ): Promise<CodeGuidelines> {
    try {
      if (!this.apiClient) {
        logger.warn("CodeGuidelinesService not initialized with API client");
        return { guidelines: [] };
      }

      // Fetch guidelines via API
      const response = await this.apiClient.fetchCodeGuidelines(
        projectId,
        organizationId,
        userId
      );

      if (!response) {
        return { guidelines: [] };
      }

      // Parse the content as JSON to get structured guidelines
      try {
        const parsedContent = JSON.parse(response.content);
        return {
          guidelines: parsedContent.guidelines || [],
          techStack: parsedContent.techStack,
          architecture: parsedContent.architecture,
        };
      } catch {
        // If content is not JSON, treat it as a single guideline string
        return {
          guidelines: response.content ? [response.content] : [],
        };
      }
    } catch (error) {
      logger.error("Failed to fetch code guidelines", { error, projectId });
      return { guidelines: [] };
    }
  }

  /**
   * Parse markdown HLD to extract tech stack and architecture
   */
  parseMarkdownHLD(content: string): {
    techStack?: CodeGuidelines["techStack"];
    architecture?: CodeGuidelines["architecture"];
  } {
    let techStack: CodeGuidelines["techStack"];
    let architecture: CodeGuidelines["architecture"];

    // Extract tech stack section
    const techStackMatch = content.match(
      /##?\s*Technology Stack[\s\S]*?(?=##|$)/i
    );
    if (techStackMatch) {
      const techStackSection = techStackMatch[0];
      techStack = {
        frontend: this.extractListItems(
          techStackSection,
          /frontend|react|next|vue|angular/i
        ),
        backend: this.extractListItems(
          techStackSection,
          /backend|express|node|django|flask|rails|php/i
        ),
        database: this.extractListItems(
          techStackSection,
          /database|prisma|postgres|mysql|mongodb|sqlite/i
        ),
        mobile: this.extractListItems(
          techStackSection,
          /mobile|flutter|react-native|swift|kotlin/i
        ),
      };
    }

    // Extract architecture section
    const archMatch = content.match(/##?\s*Architecture[\s\S]*?(?=##|$)/i);
    if (archMatch) {
      const patternMatch = archMatch[0].match(/pattern[:\s]+(\w+)/i);
      if (patternMatch) {
        architecture = {
          pattern: patternMatch[1].toLowerCase(),
        };
      }
    }

    return { techStack, architecture };
  }

  /**
   * Extract list items from markdown
   */
  private extractListItems(content: string, filter?: RegExp): string[] {
    const items: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/^[-*]\s*(.+)$/);
      if (match) {
        const item = match[1].trim();
        if (!filter || filter.test(item)) {
          items.push(item);
        }
      }
    }

    return items;
  }
}

export const codeGuidelinesService = new CodeGuidelinesService();
