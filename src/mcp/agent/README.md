# AI Agent for API Integration

## Overview

The AI Agent is an intelligent middleware layer that sits between the LLM (Large Language Model) and the Quikim API endpoints. It enables the LLM to interact with APIs through a structured, self-correcting workflow.

## Architecture

```
┌─────────────────┐
│      LLM        │ (Claude, GPT, etc.)
│   (via MCP)     │
└────────┬────────┘
         │ 1. Request with intent
         ↓
┌─────────────────┐
│   AI Agent      │
│  (Orchestrator) │
└────────┬────────┘
         │ 2. Provides API endpoints + schemas
         ↓
┌─────────────────┐
│      LLM        │
│  (Selects API)  │
└────────┬────────┘
         │ 3. Returns endpoint + formatted data
         ↓
┌─────────────────┐
│   AI Agent      │
│  (Validates &   │
│   Executes)     │
└────────┬────────┘
         │ 4. API Call
         ↓
┌─────────────────┐
│  Quikim API     │
│   Endpoints     │
└────────┬────────┘
         │ 5. Response or Error
         ↓
┌─────────────────┐
│   AI Agent      │
│ (Error Handler) │
└────────┬────────┘
         │ 6a. Success → Return data
         │ 6b. Error → Send error details back to LLM for retry
         ↓
┌─────────────────┐
│      LLM        │
│  (Retry logic)  │
└─────────────────┘
```

## Components

### 1. API Registry (`api-registry.ts`)

- Stores all available API endpoints with their schemas
- Provides metadata about each endpoint:
  - HTTP method (GET, POST, PUT, PATCH, DELETE)
  - Path with parameters (e.g., `/api/projects/{projectId}/requirements/latest`)
  - Description of what the endpoint does
  - Request schema (for POST/PUT/PATCH)
  - Response schema
  - Required fields
  - Examples

**Example Registration:**
```typescript
{
  path: '/api/projects/{projectId}/requirements/latest',
  method: 'GET',
  description: 'Fetch the latest requirements for a project',
  pathParams: ['projectId'],
  responseSchema: {
    id: 'string',
    projectId: 'string',
    version: 'number',
    content: 'string',
    // ...
  }
}
```

### 2. AI Agent (`index.ts`)

The core orchestrator that manages the LLM-API interaction workflow.

**Key Responsibilities:**

1. **Request Processing**: Receives requests from LLM with user intent
2. **Endpoint Discovery**: Finds relevant API endpoints based on intent
3. **Schema Provision**: Sends endpoint schemas to LLM for selection
4. **Validation**: Validates LLM's endpoint selection and data formatting
5. **Execution**: Executes the API call
6. **Error Handling**: If API call fails, sends error details back to LLM for correction
7. **Retry Logic**: Supports up to N retries (configurable, default 3)

### 3. Types (`types.ts`)

TypeScript interfaces for type safety:

- `APIEndpoint`: API endpoint definition
- `AgentRequest`: Request from LLM to agent
- `AgentResponse`: Response from agent to LLM
- `AgentInstruction`: Instructions sent to LLM
- `LLMAgentResponse`: LLM's response with endpoint selection
- `APICallResult`: Result of API call with error details
- `AgentState`: State management for retry logic

## Workflow

### Step 1: Initial Request

LLM sends a request with user intent:

```typescript
{
  requestId: "req_123",
  intent: "Fetch the latest requirements for project abc123",
  projectId: "abc123"
}
```

### Step 2: Agent Sends Instructions

Agent analyzes intent, finds relevant endpoints, and sends instructions:

```typescript
{
  requestId: "req_123",
  availableEndpoints: [
    {
      path: "/api/projects/{projectId}/requirements/latest",
      method: "GET",
      description: "Fetch the latest requirements for a project",
      pathParams: ["projectId"],
      responseSchema: { /* ... */ }
    },
    // ... more endpoints
  ],
  instruction: "Select the appropriate API endpoint and provide the data...",
  examples: [
    {
      scenario: "Fetch requirements",
      llmResponse: {
        endpoint: "/api/projects/{projectId}/requirements/latest",
        method: "GET",
        pathParams: { projectId: "abc123" }
      }
    }
  ]
}
```

### Step 3: LLM Responds with Selection

LLM analyzes the endpoints and responds:

```typescript
{
  requestId: "req_123",
  endpoint: "/api/projects/{projectId}/requirements/latest",
  method: "GET",
  pathParams: { projectId: "abc123" },
  reasoning: "Using GET endpoint to fetch latest requirements for the specified project"
}
```

### Step 4: Agent Executes API Call

Agent validates the selection and executes:

1. Validates endpoint exists in registry
2. Validates path parameters are provided
3. Builds final URL: `/api/projects/abc123/requirements/latest`
4. Executes HTTP GET request
5. Returns result

### Step 5a: Success Response

If successful:

```typescript
{
  requestId: "req_123",
  success: true,
  data: {
    id: "req_456",
    projectId: "abc123",
    version: 1,
    content: "# Requirements\n\n...",
    // ...
  },
  endpointCalled: "GET /api/projects/{projectId}/requirements/latest",
  statusCode: 200
}
```

### Step 5b: Error Response with Retry

If failed (e.g., wrong endpoint or data format):

```typescript
{
  requestId: "req_123",
  success: false,
  error: "Missing required path parameter: projectId",
  data: {
    instruction: {
      availableEndpoints: [ /* ... */ ],
      instruction: "The previous API call failed. Please review the error and try again...",
    },
    errorDetails: {
      previousAttempt: {
        endpoint: "/api/projects/{projectId}/requirements/latest",
        method: "GET",
        data: null,
        pathParams: {}  // Missing projectId!
      },
      error: { message: "Missing required path parameter: projectId" },
      statusCode: 400,
      attemptNumber: 1,
      remainingAttempts: 2
    },
    retryRequired: true
  },
  suggestions: [
    "Check if the endpoint path is correct",
    "Verify all required fields are included",
    "Check path parameters and query parameters"
  ]
}
```

### Step 6: LLM Retries with Correction

LLM analyzes the error and sends corrected request:

```typescript
{
  requestId: "req_123",
  endpoint: "/api/projects/{projectId}/requirements/latest",
  method: "GET",
  pathParams: { projectId: "abc123" },  // Now included!
  reasoning: "Fixed: Added missing projectId path parameter"
}
```

## Features

### 1. Self-Correcting

The agent automatically retries failed API calls by sending error details back to the LLM:

- Syntax errors in endpoint path
- Missing required fields
- Wrong data types
- Invalid path/query parameters
- API errors (400, 404, 500, etc.)

### 2. Schema-Driven

All API endpoints are registered with schemas, ensuring:

- Type safety
- Validation before execution
- Clear documentation for LLM
- Examples for guidance

### 3. Retry Logic

Configurable retry attempts (default: 3):

- Tracks retry count per request
- Provides context about previous failures
- Suggests corrections based on error type
- Prevents infinite loops

### 4. Context Management

Maintains state across retry attempts:

- Original intent
- Call history
- Accumulated context
- Error patterns

### 5. Intelligent Endpoint Discovery

Finds relevant endpoints based on:

- Keyword matching in intent
- Endpoint descriptions
- Path patterns
- Resource types

## Configuration

```typescript
const agent = new AIAgent({
  apiClient: new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: "your-api-key",
    timeout: 30000
  }),
  maxRetries: 3,      // Maximum retry attempts
  verbose: true       // Enable detailed logging
});
```

## Integration with MCP

The AI Agent is integrated into the MCP system through the `ProtocolIntegration` class:

```typescript
// Enable AI Agent in config
const integration = new ProtocolIntegration({
  aiAgent: {
    enabled: true,
    maxRetries: 3,
    verbose: true
  }
});

// Process agent requests
const response = await integration.processAgentRequest(
  "req_123",
  "Fetch latest requirements",
  null,
  "project_abc"
);
```

## Adding New Endpoints

To add a new API endpoint to the registry:

```typescript
import { apiRegistry } from './agent/api-registry';

apiRegistry.register({
  path: '/api/projects/{projectId}/new-feature',
  method: 'POST',
  description: 'Create a new feature for a project',
  pathParams: ['projectId'],
  requestSchema: {
    name: 'string',
    description: 'string',
    enabled: 'boolean'
  },
  requiredFields: ['name', 'description'],
  responseSchema: {
    id: 'string',
    projectId: 'string',
    name: 'string',
    description: 'string',
    enabled: 'boolean',
    createdAt: 'string'
  },
  examples: [{
    description: 'Create authentication feature',
    request: {
      name: 'Authentication',
      description: 'User authentication with JWT',
      enabled: true
    },
    response: {
      id: 'feat_123',
      projectId: 'proj_abc',
      name: 'Authentication',
      description: 'User authentication with JWT',
      enabled: true,
      createdAt: '2026-01-24T00:00:00Z'
    }
  }]
});
```

## Error Handling

The agent handles various error scenarios:

1. **Invalid Endpoint**: LLM selects non-existent endpoint
2. **Validation Errors**: Missing required fields, wrong data types
3. **API Errors**: 400, 404, 500, etc.
4. **Network Errors**: Timeout, connection refused
5. **Authentication Errors**: Invalid API key, unauthorized

Each error type provides specific guidance to the LLM for correction.

## Best Practices

1. **Always register endpoints with complete schemas**
2. **Provide clear descriptions for each endpoint**
3. **Include examples for complex requests**
4. **Use meaningful error messages**
5. **Keep retry count reasonable (3-5 max)**
6. **Log all agent activities for debugging**
7. **Clean up expired states periodically**

## Example Usage

```typescript
// 1. Create API client
const apiClient = new QuikimAPIClient({
  baseURL: "https://api.quikim.com",
  apiKey: process.env.QUIKIM_API_KEY
});

// 2. Create AI Agent
const agent = new AIAgent({
  apiClient,
  maxRetries: 3,
  verbose: true
});

// 3. Process initial request
const initialResponse = await agent.processRequest({
  requestId: "req_123",
  intent: "Fetch the latest requirements for project abc123",
  projectId: "abc123"
});

// 4. LLM receives instructions with available endpoints
// 5. LLM selects endpoint and formats data
// 6. Process LLM's response
const finalResponse = await agent.processRequest({
  requestId: "req_123",
  intent: "Fetch the latest requirements for project abc123",
  projectId: "abc123",
  data: {
    endpoint: "/api/projects/{projectId}/requirements/latest",
    method: "GET",
    pathParams: { projectId: "abc123" },
    reasoning: "Using GET endpoint to fetch requirements"
  }
});

// 7. Handle result
if (finalResponse.success) {
  console.log("Requirements:", finalResponse.data);
} else {
  console.error("Error:", finalResponse.error);
}
```

## Benefits

1. **No Hardcoding**: LLM doesn't need to know API endpoints in advance
2. **Self-Correcting**: Automatically retries with corrections on errors
3. **Type Safe**: Schema validation prevents invalid requests
4. **Extensible**: Easy to add new endpoints
5. **Observable**: Detailed logging and state tracking
6. **Resilient**: Handles network errors, timeouts, rate limits

## Future Enhancements

1. **Intelligent Caching**: Cache successful API calls to reduce latency
2. **Rate Limiting**: Respect API rate limits automatically
3. **Batch Operations**: Execute multiple API calls in parallel
4. **Response Transformations**: Transform API responses to LLM-friendly format
5. **Analytics**: Track usage patterns and optimize endpoint discovery
