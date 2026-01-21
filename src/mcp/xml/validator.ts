/**
 * XML validation functions for MCP Cursor Protocol
 * Validates XML messages against defined schemas
 */

import { XMLParser } from 'fast-xml-parser';
import { XML_PARSER_OPTIONS } from './schemas.js';
import { XMLRequest, XMLResponse } from '../types.js';
import { ERROR_CODES } from '../utils/constants.js';
import { XMLProtocolParser } from './parser.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export class XMLValidator {
  private parser: XMLParser;
  private protocolParser: XMLProtocolParser;

  constructor() {
    this.parser = new XMLParser(XML_PARSER_OPTIONS);
    this.protocolParser = new XMLProtocolParser();
  }

  /**
   * Validates an XML request string against the request schema
   */
  validateRequest(xmlString: string): ValidationResult {
    try {
      // Parse XML
      const parsed = this.parser.parse(xmlString);
      
      // Check basic structure
      if (!parsed.mcp_request) {
        return {
          isValid: false,
          errors: ['Missing mcp_request root element']
        };
      }

      // Validate required fields
      const errors = this.validateRequestStructure(parsed.mcp_request);
      
      if (errors.length > 0) {
        return {
          isValid: false,
          errors
        };
      }

      return {
        isValid: true,
        errors: [],
        data: parsed
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`XML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validates an XML response string against the response schema
   */
  validateResponse(xmlString: string): ValidationResult {
    try {
      // Parse XML
      const parsed = this.parser.parse(xmlString);
      
      // Check basic structure
      if (!parsed.mcp_response) {
        return {
          isValid: false,
          errors: ['Missing mcp_response root element']
        };
      }

      // Validate required fields
      const errors = this.validateResponseStructure(parsed.mcp_response);
      
      if (errors.length > 0) {
        return {
          isValid: false,
          errors
        };
      }

      return {
        isValid: true,
        errors: [],
        data: parsed
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`XML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validates the structure of a parsed request object
   */
  private validateRequestStructure(request: any): string[] {
    const errors: string[] = [];

    // Check required fields
    if (!request.type) {
      errors.push('Missing required field: type');
    } else if (!['user_request', 'workflow_response'].includes(request.type)) {
      errors.push('Invalid type value. Must be "user_request" or "workflow_response"');
    }

    if (request.request_id === undefined || request.request_id === null) {
      errors.push('Missing required field: request_id');
    } else {
      const requestIdStr = String(request.request_id);
      if (requestIdStr.trim().length === 0) {
        errors.push('request_id must be a non-empty string');
      } else if (!/^[a-zA-Z0-9-_]+$/.test(requestIdStr)) {
        errors.push('request_id must contain only alphanumeric characters, hyphens, and underscores');
      }
    }

    // Validate conditional fields
    if (request.type === 'user_request') {
      if (!request.user_prompt) {
        errors.push('user_prompt is required for user_request type');
      } else {
        const promptStr = String(request.user_prompt);
        if (promptStr.trim().length === 0) {
          errors.push('user_prompt must be non-empty for user_request type');
        }
      }
    }

    if (request.type === 'workflow_response' && !request.execution_result) {
      errors.push('execution_result is required for workflow_response type');
    }

    // Validate execution_result structure if present
    if (request.execution_result) {
      const execResult = request.execution_result;
      if (!execResult.action) {
        errors.push('execution_result.action is required');
      } else {
        const actionStr = String(execResult.action);
        if (actionStr.trim().length === 0) {
          errors.push('execution_result.action must be a non-empty string');
        }
      }
      if (typeof execResult.success !== 'boolean') {
        errors.push('execution_result.success must be a boolean');
      }
      if (execResult.output === undefined || execResult.output === null) {
        errors.push('execution_result.output is required');
      }
    }

    return errors;
  }

  /**
   * Validates the structure of a parsed response object
   */
  private validateResponseStructure(response: any): string[] {
    const errors: string[] = [];

    // Check required fields
    if (response.request_id === undefined || response.request_id === null) {
      errors.push('Missing required field: request_id');
    } else {
      const requestIdStr = String(response.request_id);
      if (requestIdStr.trim().length === 0) {
        errors.push('request_id must be a non-empty string');
      } else if (!/^[a-zA-Z0-9-_]+$/.test(requestIdStr)) {
        errors.push('request_id must contain only alphanumeric characters, hyphens, and underscores');
      }
    }

    if (!response.action) {
      errors.push('Missing required field: action');
    } else if (!['read_files', 'create_file', 'modify_file', 'run_command', 'complete', 'request_info'].includes(response.action)) {
      errors.push('Invalid action value');
    }

    if (!response.instructions) {
      errors.push('Missing required field: instructions');
    } else {
      const instructionsStr = String(response.instructions);
      if (instructionsStr.trim().length === 0) {
        errors.push('instructions must be a non-empty string');
      }
    }

    if (!response.reasoning) {
      errors.push('Missing required field: reasoning');
    } else {
      const reasoningStr = String(response.reasoning);
      if (reasoningStr.trim().length === 0) {
        errors.push('reasoning must be a non-empty string');
      }
    }

    return errors;
  }

  /**
   * Converts parsed XML request to typed XMLRequest object
   */
  parseXMLRequest(xmlString: string): XMLRequest {
    const parseResult = this.protocolParser.parseRequest(xmlString);
    
    if (!parseResult.success) {
      throw new Error(parseResult.error || `${ERROR_CODES.XML_PARSE_ERROR}: Unknown parsing error`);
    }

    return parseResult.data!;
  }

  /**
   * Converts parsed XML response to typed XMLResponse object
   */
  parseXMLResponse(xmlString: string): XMLResponse {
    try {
      const parsed = this.parser.parse(xmlString);
      
      if (!parsed.mcp_response) {
        throw new Error(`${ERROR_CODES.XML_PARSE_ERROR}: Missing mcp_response root element`);
      }

      const response = parsed.mcp_response;
      
      return {
        requestId: String(response.request_id),
        action: response.action,
        instructions: String(response.instructions),
        parameters: response.parameters || {},
        reasoning: String(response.reasoning),
        finalResponse: response.final_response ? String(response.final_response) : undefined
      };
    } catch (error) {
      throw new Error(`${ERROR_CODES.XML_PARSE_ERROR}: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }
}