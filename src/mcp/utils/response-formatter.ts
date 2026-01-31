/**
 * Quikim - Response Formatting Utilities
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { HandlerResponse, APICallResult } from "../types/handler-types.js";

export class ResponseFormatter {
  /**
   * Format successful response
   */
  static formatSuccess(
    requestId: string,
    message: string,
    data?: unknown
  ): HandlerResponse {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            requestId,
            success: true,
            message,
            data,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Format error response
   */
  static formatError(
    requestId: string,
    error: string | Error
  ): HandlerResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            requestId,
            success: false,
            error: errorMessage,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Format API result response
   */
  static formatAPIResult(
    requestId: string,
    result: APICallResult,
    operation: string
  ): HandlerResponse {
    if (result.success) {
      return this.formatSuccess(
        requestId,
        `Successfully completed ${operation}`,
        result.data
      );
    } else {
      return this.formatError(requestId, result.error || "Operation failed");
    }
  }

  /**
   * Format AI agent response
   */
  static formatAIResponse(response: unknown): HandlerResponse {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }
}