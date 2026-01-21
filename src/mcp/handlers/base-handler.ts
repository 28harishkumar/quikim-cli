/**
 * Base Handler
 * Common utilities for all tool handlers
 */

import { XMLResponse } from '../types.js';
import { XMLProtocolParser } from '../xml/parser.js';
import { QuikimAPIClient } from '../api/client.js';
import { RAGService } from '../services/rag.js';

export class BaseHandler {
  constructor(
    protected apiClient: QuikimAPIClient,
    protected xmlParser: XMLProtocolParser,
    protected ragService: RAGService
  ) {}

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format tool response to MCP format
   */
  protected formatToolResponse(response: XMLResponse): {
    content: Array<{ type: string; text: string }>;
  } {
    const xmlFormatResult = this.xmlParser.formatResponse(response);

    const xmlText =
      xmlFormatResult.success && xmlFormatResult.data
        ? xmlFormatResult.data
        : `<mcp_response><request_id>${response.requestId}</request_id><action>complete</action><instructions>Error formatting response</instructions><reasoning>XML formatting failed</reasoning><final_response>Internal error occurred</final_response></mcp_response>`;

    return {
      content: [
        {
          type: "text",
          text: xmlText,
        },
      ],
    };
  }
}
