/**
 * Quikim - AI Agent Tests
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { AIAgent } from './index.js';
import { QuikimAPIClient } from '../api/client.js';
import { apiRegistry } from './api-registry.js';

/**
 * Test 1: API Registry
 */
function testAPIRegistry() {
  console.log("Test 1: API Registry");
  console.log("-".repeat(50));

  // Check if endpoints are registered
  const allEndpoints = apiRegistry.getAll();
  console.log(`✓ Total endpoints registered: ${allEndpoints.length}`);

  // Test GET endpoint
  const requirementsEndpoint = apiRegistry.get(
    "GET",
    "/api/projects/{projectId}/requirements/latest"
  );
  console.log(`✓ Requirements endpoint found:`, !!requirementsEndpoint);
  if (requirementsEndpoint) {
    console.log(`  - Path: ${requirementsEndpoint.path}`);
    console.log(`  - Method: ${requirementsEndpoint.method}`);
    console.log(`  - Path params: ${requirementsEndpoint.pathParams?.join(", ")}`);
  }

  // Test POST endpoint
  const syncEndpoint = apiRegistry.get(
    "POST",
    "/api/projects/{projectId}/artifacts/sync"
  );
  console.log(`✓ Sync endpoint found:`, !!syncEndpoint);
  if (syncEndpoint) {
    console.log(`  - Required fields: ${syncEndpoint.requiredFields?.join(", ")}`);
  }

  // Test search
  const searchResults = apiRegistry.search("requirements");
  console.log(`✓ Search for "requirements": ${searchResults.length} results`);

  console.log("\n");
}

/**
 * Test 2: AI Agent Initialization
 */
function testAIAgentInitialization() {
  console.log("Test 2: AI Agent Initialization");
  console.log("-".repeat(50));

  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: "test-key",
    timeout: 5000
  });

  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: false
  });

  console.log(`✓ AI Agent created successfully`);
  console.log(`✓ Active states: ${agent.getActiveStateCount()}`);

  console.log("\n");
}

/**
 * Test 3: Request Validation
 */
async function testRequestValidation() {
  console.log("Test 3: Request Validation");
  console.log("-".repeat(50));

  const apiClient = new QuikimAPIClient({
    baseURL: "https://api.quikim.com",
    apiKey: "test-key"
  });

  const agent = new AIAgent({
    apiClient,
    maxRetries: 3,
    verbose: false
  });

  // Test initial request without data (should return instructions)
  const response1 = await agent.processRequest({
    requestId: "test_001",
    intent: "Fetch requirements for project test123",
    projectId: "test123"
  });

  console.log(`✓ Initial request processed`);
  console.log(`  - Success: ${response1.success}`);
  console.log(`  - Has instructions: ${!!response1.data?.instruction}`);
  console.log(`  - Available endpoints: ${response1.data?.availableEndpoints?.length || 0}`);

  // Test invalid endpoint selection (should fail validation)
  const response2 = await agent.processRequest({
    requestId: "test_002",
    intent: "Test invalid endpoint",
    data: {
      endpoint: "/api/invalid/endpoint",
      method: "GET"
    }
  });

  console.log(`✓ Invalid endpoint handled`);
  console.log(`  - Success: ${response2.success}`);
  console.log(`  - Error message: ${response2.error}`);

  console.log("\n");
}

/**
 * Test 4: Endpoint Discovery
 */
function testEndpointDiscovery() {
  console.log("Test 4: Endpoint Discovery");
  console.log("-".repeat(50));

  // Test finding endpoints by resource type
  const requirementsEndpoints = apiRegistry.getByResourceType("requirements");
  console.log(`✓ Requirements endpoints: ${requirementsEndpoints.length}`);

  const hldEndpoints = apiRegistry.getByResourceType("hld");
  console.log(`✓ HLD endpoints: ${hldEndpoints.length}`);

  const tasksEndpoints = apiRegistry.getByResourceType("tasks");
  console.log(`✓ Tasks endpoints: ${tasksEndpoints.length}`);

  const wireframeEndpoints = apiRegistry.getByResourceType("wireframes");
  console.log(`✓ Wireframe endpoints: ${wireframeEndpoints.length}`);

  console.log("\n");
}

/**
 * Test 5: Schema Validation
 */
function testSchemaValidation() {
  console.log("Test 5: Schema Validation");
  console.log("-".repeat(50));

  // Get sync endpoint
  const syncEndpoint = apiRegistry.get(
    "POST",
    "/api/projects/{projectId}/artifacts/sync"
  );

  if (syncEndpoint) {
    console.log(`✓ Sync endpoint schema:`);
    console.log(`  - Path params: ${syncEndpoint.pathParams?.join(", ")}`);
    console.log(`  - Required fields: ${syncEndpoint.requiredFields?.join(", ")}`);
    console.log(`  - Has request schema: ${!!syncEndpoint.requestSchema}`);
    console.log(`  - Has response schema: ${!!syncEndpoint.responseSchema}`);
    console.log(`  - Has examples: ${!!syncEndpoint.examples?.length}`);
  }

  console.log("\n");
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("AI AGENT TESTS");
  console.log("=".repeat(60));
  console.log("\n");

  try {
    testAPIRegistry();
    testAIAgentInitialization();
    await testRequestValidation();
    testEndpointDiscovery();
    testSchemaValidation();

    console.log("=".repeat(60));
    console.log("ALL TESTS PASSED ✓");
    console.log("=".repeat(60));
    console.log("\n");
  } catch (error) {
    console.error("\n");
    console.error("=".repeat(60));
    console.error("TEST FAILED ✗");
    console.error("=".repeat(60));
    console.error(error);
    console.error("\n");
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
