/**
 * Quikim - AI Agent for API Integration
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { QuikimAPIClient } from '../api/client.js';
import { ServiceAwareAPIClient } from '../api/service-client.js';
import { apiRegistry } from './api-registry.js';
import { logger } from '../utils/logger.js';
import {
  AgentRequest,
  AgentResponse,
  AgentInstruction,
  LLMAgentResponse,
  APICallResult,
  AgentState,
  APIEndpoint
} from './types.js';

/**
 * AI Agent Configuration
 */
export interface AIAgentConfig {
  /** Maximum number of retries for failed API calls */
  maxRetries?: number;
  
  /** Whether to log detailed information */
  verbose?: boolean;
  
  /** API client instance */
  apiClient: QuikimAPIClient | ServiceAwareAPIClient;
}

/**
 * AI Agent that bridges LLM and API endpoints
 * 
 * Flow:
 * 1. LLM sends request to MCP
 * 2. Agent receives request and analyzes intent
 * 3. Agent sends available endpoints + schemas to LLM
 * 4. LLM responds with endpoint selection and formatted data
 * 5. Agent validates and executes API call
 * 6. If error, agent sends error details back to LLM for retry
 * 7. Agent returns final result to LLM
 */
export class AIAgent {
  private config: Required<AIAgentConfig>;
  private activeStates: Map<string, AgentState> = new Map();

  constructor(config: AIAgentConfig) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      verbose: config.verbose || false,
      apiClient: config.apiClient
    };
  }

  /**
   * Process an agent request from LLM
   * This is the main entry point
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Initialize or get existing state
      let state = this.activeStates.get(request.requestId);
      
      if (!state) {
        state = this.initializeState(request);
        this.activeStates.set(request.requestId, state);
      }

      this.log(`Processing request ${request.requestId}: ${request.intent}`);
      this.log(`Request has data: ${!!request.data}`);
      if (request.data) {
        this.log(`Data has endpoint: ${!!request.data.endpoint}`);
        this.log(`Data keys: ${Object.keys(request.data).join(', ')}`);
      }

      // Check if LLM already provided endpoint selection (optimized path)
      if (request.data && request.data.endpoint) {
        this.log('✅ Direct execution path - LLM provided endpoint');
        return await this.executeLLMRequest(request, state);
      }

      // If this is first request, send instruction to LLM with API structure
      if (state.callHistory.length === 0 && !request.data) {
        this.log('📋 Setup path - sending API structure');
        return this.requestLLMInput(request, state);
      }

      // Invalid request format
      this.log('❌ Invalid format - neither direct execution nor setup');
      return {
        requestId: request.requestId,
        success: false,
        error: 'Invalid request format. Expected either initial intent or LLM response with endpoint selection.'
      };

    } catch (error) {
      logger.logError('AI Agent error', error);
      return {
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Initialize agent state for new request
   */
  private initializeState(request: AgentRequest): AgentState {
    return {
      requestId: request.requestId,
      originalIntent: request.intent,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      callHistory: [],
      context: request.context || {}
    };
  }

  /**
   * Send instruction to LLM with available endpoints and generate API structure file
   */
  private requestLLMInput(request: AgentRequest, state: AgentState): AgentResponse {
    // Get relevant endpoints based on intent
    const relevantEndpoints = this.findRelevantEndpoints(request.intent, request.projectId);

    // Generate complete API structure for caching
    const apiStructure = this.generateAPIStructure();

    const instruction: AgentInstruction = {
      requestId: request.requestId,
      availableEndpoints: relevantEndpoints,
      context: this.buildContextString(state, request),
      instruction: this.buildInstructionStringWithCache(request.intent, relevantEndpoints),
      examples: this.buildExamples(relevantEndpoints)
    };

    this.log(`Requesting LLM input for: ${request.intent}`);

    return {
      requestId: request.requestId,
      success: true,
      data: {
        ...instruction,
        apiStructure, // Include full API structure for caching
      },
      suggestions: [
        'IMPORTANT: Create .quikim/api_structure.json file with the provided API structure for future use',
        'In future calls, you can read .quikim/api_structure.json and directly provide endpoint + data',
        'Select the appropriate API endpoint from the provided list',
        'Format your data according to the endpoint schema',
        'Include all required fields',
        'Use correct data types'
      ]
    };
  }

  /**
   * Execute API call based on LLM's response
   */
  private async executeLLMRequest(request: AgentRequest, state: AgentState): Promise<AgentResponse> {
    // Parse LLM response
    const llmResponse: LLMAgentResponse = {
      requestId: request.requestId,
      endpoint: request.data!.endpoint,
      method: request.data!.method,
      data: request.data!.data,
      pathParams: request.data!.pathParams,
      queryParams: request.data!.queryParams,
      reasoning: request.data!.reasoning
    };

    this.log(`LLM selected endpoint: ${llmResponse.method} ${llmResponse.endpoint}`);
    if (llmResponse.reasoning) {
      this.log(`Reasoning: ${llmResponse.reasoning}`);
    }

    // Validate endpoint exists
    const endpoint = apiRegistry.get(llmResponse.method, llmResponse.endpoint);
    if (!endpoint) {
      return this.handleInvalidEndpoint(request, state, llmResponse);
    }

    // Validate request data against schema
    const validationError = this.validateRequest(llmResponse, endpoint);
    if (validationError) {
      return this.handleValidationError(request, state, llmResponse, validationError);
    }

    // Execute API call
    const result = await this.executeAPICall(llmResponse, endpoint);
    state.callHistory.push(result);

    // Handle result
    if (result.success) {
      return this.handleSuccess(request, result);
    } else {
      return await this.handleAPIError(request, state, result);
    }
  }

  /**
   * Execute the actual API call
   */
  private async executeAPICall(llmResponse: LLMAgentResponse, endpoint: APIEndpoint): Promise<APICallResult> {
    try {
      // Build final endpoint path with path params
      let finalPath = endpoint.path;
      if (llmResponse.pathParams) {
        Object.entries(llmResponse.pathParams).forEach(([key, value]) => {
          finalPath = finalPath.replace(`{${key}}`, value);
        });
      }

      this.log(`Executing API call: ${llmResponse.method} ${finalPath}`);

      // Make the API call through the client
      let response: any;
      
      switch (llmResponse.method) {
        case 'GET':
          response = await this.executeGETCall(finalPath, llmResponse.queryParams);
          break;
        case 'POST':
        case 'PUT':
        case 'PATCH':
          response = await this.executePOSTCall(finalPath, llmResponse.method, llmResponse.data);
          break;
        case 'DELETE':
          response = await this.executeDELETECall(finalPath);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${llmResponse.method}`);
      }

      return {
        success: true,
        data: response,
        statusCode: 200,
        request: {
          endpoint: llmResponse.endpoint,
          method: llmResponse.method,
          data: llmResponse.data,
          pathParams: llmResponse.pathParams,
          queryParams: llmResponse.queryParams
        }
      };

    } catch (error: any) {
      this.log(`API call failed: ${error.message}`);
      
      return {
        success: false,
        statusCode: error.statusCode || 500,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        request: {
          endpoint: llmResponse.endpoint,
          method: llmResponse.method,
          data: llmResponse.data,
          pathParams: llmResponse.pathParams,
          queryParams: llmResponse.queryParams
        }
      };
    }
  }

  /**
   * Execute GET API call
   */
  private async executeGETCall(path: string, queryParams?: Record<string, string>): Promise<any> {
    // Build query string
    let finalPath = path;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      finalPath = `${path}?${params.toString()}`;
    }

    // Use the API client's request method directly
    const response = await (this.config.apiClient as any).request(finalPath, { method: 'GET' });
    return response.data;
  }

  /**
   * Execute POST/PUT/PATCH API call
   */
  private async executePOSTCall(path: string, method: 'POST' | 'PUT' | 'PATCH', data?: any): Promise<any> {
    const response = await (this.config.apiClient as any).request(path, {
      method,
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Execute DELETE API call
   */
  private async executeDELETECall(path: string): Promise<any> {
    const response = await (this.config.apiClient as any).request(path, { method: 'DELETE' });
    return response.data;
  }

  /**
   * Handle successful API call
   */
  private handleSuccess(request: AgentRequest, result: APICallResult): AgentResponse {
    this.log(`API call successful`);
    
    // Clean up state
    this.activeStates.delete(request.requestId);

    return {
      requestId: request.requestId,
      success: true,
      data: result.data,
      endpointCalled: `${result.request.method} ${result.request.endpoint}`,
      statusCode: result.statusCode
    };
  }

  /**
   * Handle API error with retry logic
   */
  private async handleAPIError(request: AgentRequest, state: AgentState, result: APICallResult): Promise<AgentResponse> {
    state.retryCount++;

    this.log(`API call failed (attempt ${state.retryCount}/${state.maxRetries}): ${result.error?.message}`);

    // If max retries reached, return error
    if (state.retryCount >= state.maxRetries) {
      this.activeStates.delete(request.requestId);
      
      return {
        requestId: request.requestId,
        success: false,
        error: `API call failed after ${state.maxRetries} attempts: ${result.error?.message}`,
        data: {
          lastAttempt: result,
          allAttempts: state.callHistory
        }
      };
    }

    // Otherwise, send error info back to LLM for retry
    return this.requestLLMRetry(request, state, result);
  }

  /**
   * Request LLM to retry with error information
   */
  private requestLLMRetry(request: AgentRequest, state: AgentState, failedResult: APICallResult): AgentResponse {
    const relevantEndpoints = this.findRelevantEndpoints(state.originalIntent, request.projectId);

    const errorDetails = {
      previousAttempt: {
        endpoint: failedResult.request.endpoint,
        method: failedResult.request.method,
        data: failedResult.request.data,
        pathParams: failedResult.request.pathParams,
        queryParams: failedResult.request.queryParams
      },
      error: failedResult.error,
      statusCode: failedResult.statusCode,
      attemptNumber: state.retryCount,
      remainingAttempts: state.maxRetries - state.retryCount
    };

    const instruction: AgentInstruction = {
      requestId: request.requestId,
      availableEndpoints: relevantEndpoints,
      context: this.buildRetryContextString(state, errorDetails),
      instruction: `The previous API call failed. Please review the error and try again with corrections.

Error Details:
- Status Code: ${errorDetails.statusCode}
- Error Message: ${errorDetails.error?.message}
- Failed Request: ${errorDetails.previousAttempt.method} ${errorDetails.previousAttempt.endpoint}

Please analyze the error and provide a corrected endpoint and data structure.`,
      examples: this.buildExamples(relevantEndpoints)
    };

    return {
      requestId: request.requestId,
      success: false,
      error: failedResult.error?.message,
      data: {
        instruction,
        errorDetails,
        retryRequired: true
      },
      suggestions: [
        'Check if the endpoint path is correct',
        'Verify all required fields are included',
        'Ensure data types match the schema',
        'Check path parameters and query parameters'
      ]
    };
  }

  /**
   * Handle invalid endpoint selection
   */
  private handleInvalidEndpoint(request: AgentRequest, state: AgentState, llmResponse: LLMAgentResponse): AgentResponse {
    state.retryCount++;

    const allEndpoints = apiRegistry.getAll();
    
    return {
      requestId: request.requestId,
      success: false,
      error: `Invalid endpoint: ${llmResponse.method} ${llmResponse.endpoint}`,
      data: {
        availableEndpoints: allEndpoints.map(e => `${e.method} ${e.path}`),
        retryRequired: true
      },
      suggestions: [
        'Select an endpoint from the available list',
        'Check the endpoint path syntax',
        'Ensure HTTP method is correct'
      ]
    };
  }

  /**
   * Handle validation error
   */
  private handleValidationError(
    request: AgentRequest,
    state: AgentState,
    llmResponse: LLMAgentResponse,
    error: string
  ): AgentResponse {
    state.retryCount++;

    return {
      requestId: request.requestId,
      success: false,
      error: `Validation failed: ${error}`,
      data: {
        endpoint: apiRegistry.get(llmResponse.method, llmResponse.endpoint),
        providedData: llmResponse.data,
        retryRequired: true
      },
      suggestions: [
        'Check all required fields are included',
        'Verify data types match the schema',
        'Review the endpoint documentation'
      ]
    };
  }

  /**
   * Validate request data against endpoint schema
   */
  private validateRequest(llmResponse: LLMAgentResponse, endpoint: APIEndpoint): string | null {
    // Check path parameters
    if (endpoint.pathParams) {
      for (const param of endpoint.pathParams) {
        if (!llmResponse.pathParams || !llmResponse.pathParams[param]) {
          return `Missing required path parameter: ${param}`;
        }
      }
    }

    // Check required fields for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(llmResponse.method) && endpoint.requiredFields) {
      if (!llmResponse.data) {
        return 'Request data is required but not provided';
      }

      for (const field of endpoint.requiredFields) {
        if (!(field in llmResponse.data)) {
          return `Missing required field: ${field}`;
        }
      }
    }

    return null;
  }

  /**
   * Find relevant endpoints based on intent
   */
  private findRelevantEndpoints(intent: string, _projectId?: string): APIEndpoint[] {
    const lowerIntent = intent.toLowerCase();
    
    // Search by keywords
    const keywords = lowerIntent.split(' ');
    const relevantEndpoints: APIEndpoint[] = [];
    const seen = new Set<string>();

    for (const keyword of keywords) {
      const found = apiRegistry.search(keyword);
      for (const endpoint of found) {
        const key = `${endpoint.method}:${endpoint.path}`;
        if (!seen.has(key)) {
          seen.add(key);
          relevantEndpoints.push(endpoint);
        }
      }
    }

    // If nothing found or too many, return all
    if (relevantEndpoints.length === 0 || relevantEndpoints.length > 10) {
      return apiRegistry.getAll();
    }

    return relevantEndpoints;
  }

  /**
   * Build context string for LLM
   */
  private buildContextString(state: AgentState, request: AgentRequest): string {
    return `You are helping to fulfill this intent: "${state.originalIntent}"

Project ID: ${request.projectId || 'Not specified'}

Your task is to select the appropriate API endpoint and format the data correctly according to the endpoint's schema.`;
  }

  /**
   * Build retry context string
   */
  private buildRetryContextString(state: AgentState, errorDetails: any): string {
    return `Original Intent: "${state.originalIntent}"

Previous Attempt Failed (Attempt ${errorDetails.attemptNumber}/${state.maxRetries}):
- Endpoint: ${errorDetails.previousAttempt.method} ${errorDetails.previousAttempt.endpoint}
- Error: ${errorDetails.error?.message}
- Status Code: ${errorDetails.statusCode}

Please analyze the error and provide a corrected request.`;
  }

  /**
   * Build instruction string with API structure caching guidance
   */
  private buildInstructionStringWithCache(intent: string, endpoints: APIEndpoint[]): string {
    return `IMPORTANT - First Time Setup:
Before selecting an endpoint, create .quikim/api_structure.json with the provided apiStructure object.
This file will be used in future calls to avoid this instruction step.

In future calls:
- Read .quikim/api_structure.json
- Directly provide endpoint selection and formatted data
- Skip this instruction phase entirely

---

To fulfill the intent "${intent}", please:

1. CREATE .quikim/api_structure.json with the provided apiStructure (if it doesn't exist)
2. Select the most appropriate API endpoint from the list below
3. Provide the required data in the correct format
4. Fill in any path parameters (e.g., {projectId})
5. Include query parameters if needed

Available Endpoints (${endpoints.length}):
${endpoints.map((e, i) => `${i + 1}. ${e.method} ${e.path} - ${e.description}`).join('\n')}

Respond with a JSON object in this format:
{
  "endpoint": "selected endpoint path",
  "method": "HTTP method",
  "data": { "field": "value" },  // for POST/PUT/PATCH
  "pathParams": { "paramName": "value" },  // if needed
  "queryParams": { "param": "value" },  // if needed
  "reasoning": "why this endpoint was chosen"
}`;
  }

  /**
   * Generate complete API structure for caching
   */
  private generateAPIStructure(): any {
    const allEndpoints = apiRegistry.getAll();
    
    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      description: 'Complete Quikim API structure for MCP Agent',
      usage: 'This file can be read by LLM to directly select endpoints without instruction phase',
      endpoints: allEndpoints.map(endpoint => ({
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        pathParams: endpoint.pathParams || [],
        queryParams: endpoint.queryParams || [],
        requiredFields: endpoint.requiredFields || [],
        requestSchema: endpoint.requestSchema || {},
        responseSchema: endpoint.responseSchema || {},
        examples: endpoint.examples || []
      })),
      quickReference: {
        byResourceType: this.groupEndpointsByResource(allEndpoints),
        byMethod: this.groupEndpointsByMethod(allEndpoints)
      }
    };
  }

  /**
   * Group endpoints by resource type for quick reference
   */
  private groupEndpointsByResource(endpoints: APIEndpoint[]): Record<string, APIEndpoint[]> {
    const grouped: Record<string, APIEndpoint[]> = {};
    
    for (const endpoint of endpoints) {
      // Extract resource type from path (e.g., /api/projects -> projects)
      const parts = endpoint.path.split('/').filter(p => p && !p.startsWith('{'));
      const resource = parts[parts.length - 1] || 'general';
      
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(endpoint);
    }
    
    return grouped;
  }

  /**
   * Group endpoints by HTTP method for quick reference
   */
  private groupEndpointsByMethod(endpoints: APIEndpoint[]): Record<string, APIEndpoint[]> {
    const grouped: Record<string, APIEndpoint[]> = {};
    
    for (const endpoint of endpoints) {
      if (!grouped[endpoint.method]) {
        grouped[endpoint.method] = [];
      }
      grouped[endpoint.method].push(endpoint);
    }
    
    return grouped;
  }

  /**
   * Build examples for LLM
   */
  private buildExamples(endpoints: APIEndpoint[]): Array<{ scenario: string; llmResponse: any }> {
    const examples: Array<{ scenario: string; llmResponse: any }> = [];

    // Find a GET endpoint
    const getEndpoint = endpoints.find(e => e.method === 'GET' && e.pathParams);
    if (getEndpoint) {
      examples.push({
        scenario: `Fetch data using ${getEndpoint.path}`,
        llmResponse: {
          endpoint: getEndpoint.path,
          method: 'GET',
          pathParams: Object.fromEntries(
            (getEndpoint.pathParams || []).map(p => [p, 'example-value'])
          ),
          reasoning: `Using GET ${getEndpoint.path} to retrieve the requested data`
        }
      });
    }

    // Find a POST endpoint
    const postEndpoint = endpoints.find(e => e.method === 'POST' && e.examples);
    if (postEndpoint && postEndpoint.examples && postEndpoint.examples.length > 0) {
      const example = postEndpoint.examples[0];
      examples.push({
        scenario: example.description,
        llmResponse: {
          endpoint: postEndpoint.path,
          method: 'POST',
          data: example.request,
          pathParams: Object.fromEntries(
            (postEndpoint.pathParams || []).map(p => [p, 'example-value'])
          ),
          reasoning: example.description
        }
      });
    }

    return examples;
  }

  /**
   * Log helper
   */
  private log(message: string): void {
    if (this.config.verbose) {
      logger.info(`[AI Agent] ${message}`);
    }
  }

  /**
   * Clean up expired states
   */
  cleanupExpiredStates(_maxAgeMs: number = 30 * 60 * 1000): void {
    for (const [requestId, state] of this.activeStates.entries()) {
      // If state is older than maxAge, remove it
      if (state.callHistory.length > 0) {
        // This is a simplified check - in production you'd track creation time
        this.activeStates.delete(requestId);
      }
    }
  }

  /**
   * Get active state count
   */
  getActiveStateCount(): number {
    return this.activeStates.size;
  }
}
