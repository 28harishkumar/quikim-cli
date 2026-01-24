/**
 * Quikim - AI Agent Types
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * API endpoint definition with metadata
 */
export interface APIEndpoint {
  /** Endpoint path (e.g., "/api/projects/{projectId}/requirements/latest") */
  path: string;
  
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  
  /** Description of what this endpoint does */
  description: string;
  
  /** Expected request body structure (for POST/PUT/PATCH) */
  requestSchema?: Record<string, any>;
  
  /** Expected response structure */
  responseSchema?: Record<string, any>;
  
  /** Path parameters that need to be filled */
  pathParams?: string[];
  
  /** Query parameters */
  queryParams?: string[];
  
  /** Required fields in request body */
  requiredFields?: string[];
  
  /** Examples of valid requests */
  examples?: Array<{
    description: string;
    request?: any;
    response?: any;
  }>;
}

/**
 * Agent request from LLM
 */
export interface AgentRequest {
  /** Unique request ID */
  requestId: string;
  
  /** LLM's intent/instruction */
  intent: string;
  
  /** Context from previous interactions */
  context?: Record<string, any>;
  
  /** Any data the LLM wants to send */
  data?: Record<string, any>;
  
  /** Project ID if applicable */
  projectId?: string;
}

/**
 * Agent response structure
 */
export interface AgentResponse {
  /** Request ID for tracking */
  requestId: string;
  
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Data returned from API */
  data?: any;
  
  /** Error message if failed */
  error?: string;
  
  /** Suggestions for next steps */
  suggestions?: string[];
  
  /** API endpoint that was called */
  endpointCalled?: string;
  
  /** HTTP status code */
  statusCode?: number;
}

/**
 * Agent instruction to LLM
 */
export interface AgentInstruction {
  /** Request ID */
  requestId: string;
  
  /** Available API endpoints with schemas */
  availableEndpoints: APIEndpoint[];
  
  /** Context about current state */
  context: string;
  
  /** What agent needs from LLM */
  instruction: string;
  
  /** Examples of how to format the response */
  examples?: Array<{
    scenario: string;
    llmResponse: {
      endpoint: string;
      method: string;
      data: any;
    };
  }>;
}

/**
 * LLM response to agent instruction
 */
export interface LLMAgentResponse {
  /** Request ID for tracking */
  requestId: string;
  
  /** Selected API endpoint path */
  endpoint: string;
  
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  
  /** Data to send in request body (for POST/PUT/PATCH) */
  data?: Record<string, any>;
  
  /** Path parameters to fill */
  pathParams?: Record<string, string>;
  
  /** Query parameters */
  queryParams?: Record<string, string>;
  
  /** Reasoning for this choice */
  reasoning?: string;
}

/**
 * API call result with error details
 */
export interface APICallResult {
  /** Whether call succeeded */
  success: boolean;
  
  /** Response data */
  data?: any;
  
  /** HTTP status code */
  statusCode: number;
  
  /** Error details if failed */
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  
  /** Request that was made */
  request: {
    endpoint: string;
    method: string;
    data?: any;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
  };
}

/**
 * Agent state for managing conversation
 */
export interface AgentState {
  /** Current request ID */
  requestId: string;
  
  /** Original intent */
  originalIntent: string;
  
  /** Number of retry attempts */
  retryCount: number;
  
  /** Maximum retries allowed */
  maxRetries: number;
  
  /** History of API calls made */
  callHistory: APICallResult[];
  
  /** Context accumulated during conversation */
  context: Record<string, any>;
}
