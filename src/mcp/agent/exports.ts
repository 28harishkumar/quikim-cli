/**
 * Quikim - AI Agent Module Exports
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

// Main AI Agent
export { AIAgent, type AIAgentConfig } from './index.js';

// API Registry
export { APIRegistry, apiRegistry } from './api-registry.js';

// Types
export type {
  APIEndpoint,
  AgentRequest,
  AgentResponse,
  AgentInstruction,
  LLMAgentResponse,
  APICallResult,
  AgentState
} from './types.js';

// Examples (for reference)
export {
  exampleFetchRequirements,
  exampleSyncArtifact,
  exampleErrorHandling,
  exampleSearchComponents,
  exampleMultipleRetries,
  runAllExamples
} from './examples.js';

// Tests
export { runTests } from './tests.js';
