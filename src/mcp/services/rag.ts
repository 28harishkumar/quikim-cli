/**
 * RAG (Retrieval Augmented Generation) Pipeline Service
 * Calls snippet-service API to search for relevant code snippets
 * Enterprise architecture: MCP server calls services via HTTP, not direct DB access
 */

import { logger } from '../utils/logger.js';
import { QuikimAPIClient } from '../api/client.js';

export interface CodeSnippet {
  id: string;
  content: string;
  file_path: string;  // Changed from filePath to match API response
  language: string;
  description?: string;
  tags?: string[];
  projectId?: string;
  organizationId?: string;
}

export interface RAGSearchParams {
  query: string;
  projectId?: string;
  organizationId?: string;
  limit?: number;
  fileTypes?: string[];
}

export class RAGService {
  constructor(private apiClient: QuikimAPIClient) {
    // apiClient is injected from server.ts
  }

  /**
   * Search for relevant code snippets via snippet-service API
   * Enterprise architecture: MCP server calls services, not database directly
   */
  async searchSnippets(params: RAGSearchParams): Promise<CodeSnippet[]> {
    const { query, projectId, organizationId, limit = 10, fileTypes } = params;

    logger.info("RAG search initiated", {
      query: query.substring(0, 100),
      projectId,
      organizationId,
    });

    const snippets: CodeSnippet[] = [];

    try {
      // Call snippet-service API to search components
      // Uses QuikimAPIClient.searchComponents which handles the API call
      const components = await this.apiClient.searchComponents(
        query,
        organizationId,
        limit
      );

      const componentSnippets = components
        .filter((c: any) => c.code)
        .map((c: any) => ({
          id: c.id || `component-${Date.now()}-${Math.random()}`,
          file_path: c.githubUrl || `components/${c.slug || c.id}.tsx`,
          content: c.code,
          language: "typescript",
          description:
            c.description ||
            `${c.name || "Component"} (${c.type || "component"})${
              c.type === "penpot-generated"
                ? " - Generated from Penpot design"
                : ""
            }`,
        }));
      snippets.push(...componentSnippets);

      // Also search for Penpot-generated components specifically
      if (projectId) {
        try {
          const penpotComponents = await this.apiClient.searchComponents(
            `${query} penpot-generated`,
            organizationId,
            Math.floor(limit / 2)
          );
          const penpotSnippets = penpotComponents
            .filter((c: any) => c.type === "penpot-generated" && c.code)
            .map((c: any) => ({
              id: c.id || `penpot-${Date.now()}-${Math.random()}`,
              file_path: c.githubUrl || `components/${c.slug || c.id}.tsx`,
              content: c.code,
              language: "typescript",
              description: `Penpot-generated: ${c.name} - ${
                c.description || "Design-to-code component"
              }`,
            }));
          snippets.push(...penpotSnippets);
        } catch (error) {
          // Continue without Penpot components if search fails
        }
      }

      // Search sample code repository via snippet-service API
      try {
        const sampleCodeResponse = await this.apiClient.searchSampleCode(
          query,
          organizationId,
          Math.floor(limit / 2)
        );

        if (sampleCodeResponse && sampleCodeResponse.length > 0) {
          const sampleSnippets = sampleCodeResponse
            .filter((s: any) => s.code)
            .map((s: any) => ({
              id: s.id || `sample-${Date.now()}-${Math.random()}`,
              file_path:
                s.githubUrl ||
                `samples/${s.category}/${s.name}.${
                  s.language === "typescript" ? "ts" : s.language
                }`,
              content: s.code,
              language: s.language || "typescript",
              description:
                s.description || `${s.name} (${s.category}/${s.language})`,
            }));
          snippets.push(...sampleSnippets);
        }
      } catch (sampleError) {
        // Continue without sample code if search fails
      }

      // Score and sort snippets
      const scoredSnippets = this.scoreSnippets(snippets, query, fileTypes);
      return scoredSnippets.slice(0, limit);
    } catch (error) {
      logger.error("RAG search failed", { error, params });
      return [];
    }
  }

  /**
   * Extract search terms from query
   */
  private extractSearchTerms(query: string): string[] {
    // Simple keyword extraction
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5); // Limit to top 5 terms

    return words;
  }

  /**
   * Score snippets by relevance to query
   */
  private scoreSnippets(
    snippets: CodeSnippet[],
    query: string,
    fileTypes?: string[]
  ): CodeSnippet[] {
    const queryLower = query.toLowerCase();
    const queryTerms = this.extractSearchTerms(query);

    return snippets
      .map((snippet) => {
        let score = 0;
        const contentLower = snippet.content.toLowerCase();
        const descLower = (snippet.description || "").toLowerCase();
        const pathLower = snippet.file_path.toLowerCase();

        // Exact phrase match
        if (
          contentLower.includes(queryLower) ||
          descLower.includes(queryLower)
        ) {
          score += 10;
        }

        // Term matches
        queryTerms.forEach((term) => {
          if (contentLower.includes(term)) score += 3;
          if (descLower.includes(term)) score += 2;
          if (pathLower.includes(term)) score += 1;
        });

        // File type matching
        if (fileTypes) {
          const matchesType = fileTypes.some((type) =>
            pathLower.endsWith(`.${type}`)
          );
          if (matchesType) score += 2;
        }

        return { snippet, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.snippet);
  }
}

// RAG service instance will be created with API client in server.ts
