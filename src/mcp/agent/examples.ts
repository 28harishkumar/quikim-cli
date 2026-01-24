/**
 * Quikim - AI Agent Usage Examples
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { AIAgent } from './index.js';
import { QuikimAPIClient } from '../api/client.js';
import { AgentRequest } from './types.js';

/**
 * Example 1: Fetch Requirements
 * Demonstrates the complete flow of fetching project requirements
 */
export async function exampleFetchRequirements() {
  // 1. Create API client
  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: process.env.QUIKIM_API_KEY || "",
    timeout: 30000
  });

  // 2. Create AI Agent
  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: true
  });

  // 3. Initial request from LLM
  const initialRequest: AgentRequest = {
    requestId: "req_fetch_requirements_001",
    intent: "I need to fetch the latest requirements document for project abc123",
    projectId: "abc123"
  };

  console.log("Step 1: LLM sends initial request");
  const step1Response = await agent.processRequest(initialRequest);
  
  if (!step1Response.success) {
    console.error("Failed:", step1Response.error);
    return;
  }

  console.log("Step 2: Agent provides available endpoints and schemas");
  console.log("Available endpoints:", step1Response.data.availableEndpoints.length);
  console.log("Instruction to LLM:", step1Response.data.instruction);

  // 4. LLM selects endpoint and formats data
  console.log("\nStep 3: LLM analyzes and selects endpoint");
  const llmSelectionRequest: AgentRequest = {
    requestId: "req_fetch_requirements_001",
    intent: initialRequest.intent,
    projectId: "abc123",
    data: {
      endpoint: "/api/projects/{projectId}/requirements/latest",
      method: "GET",
      pathParams: { projectId: "abc123" },
      reasoning: "Using GET endpoint to fetch latest requirements for the specified project"
    }
  };

  console.log("Step 4: Agent executes API call");
  const finalResponse = await agent.processRequest(llmSelectionRequest);

  if (finalResponse.success) {
    console.log("\nSuccess! Requirements fetched:");
    console.log("- ID:", finalResponse.data.id);
    console.log("- Version:", finalResponse.data.version);
    console.log("- Content length:", finalResponse.data.content.length, "characters");
    console.log("- Quikim Features:", finalResponse.data.quikimFeatures);
  } else {
    console.error("\nFailed:", finalResponse.error);
  }
}

/**
 * Example 2: Sync Artifact (POST request)
 * Demonstrates POST request with request body
 */
export async function exampleSyncArtifact() {
  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: process.env.QUIKIM_API_KEY || ""
  });

  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: true
  });

  // Initial request
  const initialRequest: AgentRequest = {
    requestId: "req_sync_artifact_001",
    intent: "I need to sync updated requirements document for project xyz789",
    projectId: "xyz789",
    context: {
      artifactType: "requirements",
      content: "# Updated Requirements\n\n## New Feature\n- Add user authentication"
    }
  };

  console.log("Step 1: Request endpoint information");
  await agent.processRequest(initialRequest);

  // LLM selects sync endpoint
  const llmSelectionRequest: AgentRequest = {
    requestId: "req_sync_artifact_001",
    intent: initialRequest.intent,
    projectId: "xyz789",
    data: {
      endpoint: "/api/projects/{projectId}/artifacts/sync",
      method: "POST",
      pathParams: { projectId: "xyz789" },
      data: {
        artifactType: "requirements",
        content: initialRequest.context!.content,
        version: 2
      },
      reasoning: "Using POST /artifacts/sync to update requirements with new version"
    }
  };

  console.log("\nStep 2: Execute sync");
  const finalResponse = await agent.processRequest(llmSelectionRequest);

  if (finalResponse.success) {
    console.log("\nSuccess! Artifact synced:");
    console.log("- Artifact ID:", finalResponse.data.artifactId);
    console.log("- New Version:", finalResponse.data.version);
  } else {
    console.error("\nFailed:", finalResponse.error);
  }
}

/**
 * Example 3: Error Handling and Retry
 * Demonstrates what happens when LLM makes a mistake
 */
export async function exampleErrorHandling() {
  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: process.env.QUIKIM_API_KEY || ""
  });

  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: true
  });

  const initialRequest: AgentRequest = {
    requestId: "req_error_demo_001",
    intent: "Fetch HLD for project test123",
    projectId: "test123"
  };

  // Get available endpoints
  await agent.processRequest(initialRequest);

  // LLM makes a mistake - forgets projectId path parameter
  console.log("\nAttempt 1: LLM forgets path parameter (WILL FAIL)");
  const wrongRequest: AgentRequest = {
    requestId: "req_error_demo_001",
    intent: initialRequest.intent,
    projectId: "test123",
    data: {
      endpoint: "/api/projects/{projectId}/hld/latest",
      method: "GET",
      pathParams: {},  // Missing projectId!
      reasoning: "Fetching HLD"
    }
  };

  const errorResponse = await agent.processRequest(wrongRequest);

  if (!errorResponse.success) {
    console.log("\nError detected:", errorResponse.error);
    console.log("Retry required:", errorResponse.data?.retryRequired);
    console.log("Error details:", errorResponse.data?.errorDetails);
    console.log("Suggestions:", errorResponse.suggestions);

    // LLM receives error details and corrects the mistake
    console.log("\n\nAttempt 2: LLM corrects the mistake");
    const correctedRequest: AgentRequest = {
      requestId: "req_error_demo_001",
      intent: initialRequest.intent,
      projectId: "test123",
      data: {
        endpoint: "/api/projects/{projectId}/hld/latest",
        method: "GET",
        pathParams: { projectId: "test123" },  // Fixed!
        reasoning: "Corrected: Added missing projectId path parameter"
      }
    };

    const successResponse = await agent.processRequest(correctedRequest);

    if (successResponse.success) {
      console.log("\nSuccess after correction!");
      console.log("HLD fetched successfully");
    }
  }
}

/**
 * Example 4: Search Components
 * Demonstrates query parameter usage
 */
export async function exampleSearchComponents() {
  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: process.env.QUIKIM_API_KEY || ""
  });

  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: true
  });

  const initialRequest: AgentRequest = {
    requestId: "req_search_001",
    intent: "Search for authentication components in the organization org_123",
    context: {
      searchQuery: "authentication",
      organizationId: "org_123"
    }
  };

  await agent.processRequest(initialRequest);

  // LLM selects search endpoint with query parameters
  const searchRequest: AgentRequest = {
    requestId: "req_search_001",
    intent: initialRequest.intent,
    data: {
      endpoint: "/api/v1/snippets/components",
      method: "GET",
      queryParams: {
        search: "authentication",
        organizationId: "org_123",
        limit: "10"
      },
      reasoning: "Using component search endpoint with organization filter"
    }
  };

  const finalResponse = await agent.processRequest(searchRequest);

  if (finalResponse.success) {
    console.log("\nSearch results:");
    console.log("Found", finalResponse.data.data.length, "components");
    finalResponse.data.data.forEach((comp: any, i: number) => {
      console.log(`${i + 1}. ${comp.name} - ${comp.description}`);
    });
  }
}

/**
 * Example 5: Multiple Retries
 * Demonstrates the full retry flow with multiple attempts
 */
export async function exampleMultipleRetries() {
  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: process.env.QUIKIM_API_KEY || ""
  });

  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: true
  });

  const requestId = "req_retry_demo_001";

  // Attempt 1: Wrong endpoint
  console.log("Attempt 1: Using wrong endpoint");
  let response = await agent.processRequest({
    requestId,
    intent: "Create new task",
    data: {
      endpoint: "/api/tasks/create",  // Wrong!
      method: "POST",
      reasoning: "Creating task"
    }
  });

  console.log("Result:", response.success ? "Success" : `Failed - ${response.error}`);

  if (!response.success && response.data?.retryRequired) {
    // Attempt 2: Correct endpoint but missing required field
    console.log("\nAttempt 2: Correct endpoint but missing data");
    response = await agent.processRequest({
      requestId,
      intent: "Create new task",
      data: {
        endpoint: "/api/projects/{projectId}/artifacts/sync",
        method: "POST",
        pathParams: { projectId: "proj_123" },
        data: {
          // Missing artifactType!
          content: "Task content"
        },
        reasoning: "Fixed endpoint"
      }
    });

    console.log("Result:", response.success ? "Success" : `Failed - ${response.error}`);
  }

  if (!response.success && response.data?.retryRequired) {
    // Attempt 3: Fully corrected
    console.log("\nAttempt 3: Fully corrected request");
    response = await agent.processRequest({
      requestId,
      intent: "Create new task",
      data: {
        endpoint: "/api/projects/{projectId}/artifacts/sync",
        method: "POST",
        pathParams: { projectId: "proj_123" },
        data: {
          artifactType: "tasks",
          content: "# Tasks\n\n- Task 1\n- Task 2"
        },
        reasoning: "Added missing artifactType field"
      }
    });

    console.log("Result:", response.success ? "Success!" : `Failed - ${response.error}`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("=".repeat(60));
  console.log("EXAMPLE 1: Fetch Requirements");
  console.log("=".repeat(60));
  await exampleFetchRequirements();

  console.log("\n\n");
  console.log("=".repeat(60));
  console.log("EXAMPLE 2: Sync Artifact");
  console.log("=".repeat(60));
  await exampleSyncArtifact();

  console.log("\n\n");
  console.log("=".repeat(60));
  console.log("EXAMPLE 3: Error Handling and Retry");
  console.log("=".repeat(60));
  await exampleErrorHandling();

  console.log("\n\n");
  console.log("=".repeat(60));
  console.log("EXAMPLE 4: Search Components");
  console.log("=".repeat(60));
  await exampleSearchComponents();

  console.log("\n\n");
  console.log("=".repeat(60));
  console.log("EXAMPLE 5: Multiple Retries");
  console.log("=".repeat(60));
  await exampleMultipleRetries();
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
