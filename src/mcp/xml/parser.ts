/**
 * XML parsing and formatting functions for MCP Cursor Protocol
 * Handles XML communication between Cursor and MCP server
 * Requirements: 2.1, 2.2, 2.3
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { XML_PARSER_OPTIONS, XML_BUILDER_OPTIONS } from './schemas.js';
import { XMLRequest, XMLResponse, ActionParameters } from '../types.js';
import { ERROR_CODES } from '../utils/constants.js';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class XMLProtocolParser {
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser(XML_PARSER_OPTIONS);
    this.builder = new XMLBuilder(XML_BUILDER_OPTIONS);
  }

  /**
   * Parses incoming XML request from Cursor
   * Handles malformed XML with appropriate error messages
   */
  parseRequest(xmlString: string): ParseResult<XMLRequest> {
    try {
      // Validate input
      if (!xmlString || typeof xmlString !== 'string') {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: Input must be a non-empty string`
        };
      }

      let trimmedXml = xmlString.trim();
      if (trimmedXml.length === 0) {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: XML string cannot be empty or whitespace only`
        };
      }

      // Decode HTML entities if present (Cursor may HTML-encode the XML)
      trimmedXml = this.decodeHtmlEntities(trimmedXml);

      // Parse XML
      const parsed = this.parser.parse(trimmedXml);
      
      // Check for root element
      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: Invalid XML structure`
        };
      }

      if (!parsed.mcp_request) {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: Missing mcp_request root element`
        };
      }

      const request = parsed.mcp_request;

      // Validate and extract required fields
      const result = this.extractRequestData(request);
      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_PARSE_ERROR}: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
      };
    }
  }

  /**
   * Formats XMLResponse object as XML string for sending to Cursor
   */
  formatResponse(response: XMLResponse): ParseResult<string> {
    try {
      // Validate response object
      const validationResult = this.validateResponseObject(response);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error
        };
      }

      // Build XML structure
      const xmlObject = {
        mcp_response: {
          request_id: response.requestId,
          action: response.action,
          instructions: response.instructions,
          reasoning: response.reasoning,
          ...(response.parameters && Object.keys(response.parameters).length > 0 && {
            parameters: this.formatParameters(response.parameters)
          }),
          ...(response.finalResponse && { final_response: response.finalResponse })
        }
      };

      // Generate XML string
      const xmlString = this.builder.build(xmlObject);
      
      return {
        success: true,
        data: xmlString
      };

    } catch (error) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_FORMAT_ERROR}: ${error instanceof Error ? error.message : 'Unknown formatting error'}`
      };
    }
  }

  /**
   * Parses XML response string back to XMLResponse object (for testing)
   */
  parseResponse(xmlString: string): ParseResult<XMLResponse> {
    try {
      // Validate input
      if (!xmlString || typeof xmlString !== 'string') {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: Input must be a non-empty string`
        };
      }

      let trimmedXml = xmlString.trim();
      if (trimmedXml.length === 0) {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: XML string cannot be empty or whitespace only`
        };
      }

      // Decode HTML entities if present
      trimmedXml = this.decodeHtmlEntities(trimmedXml);

      // Parse XML
      const parsed = this.parser.parse(trimmedXml);

      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: Invalid XML structure`
        };
      }

      if (!parsed.mcp_response) {
        return {
          success: false,
          error: `${ERROR_CODES.XML_PARSE_ERROR}: Missing mcp_response root element`
        };
      }

      const response = parsed.mcp_response;

      // Extract and validate response data
      return this.extractResponseData(response);

    } catch (error) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_PARSE_ERROR}: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
      };
    }
  }

  /**
   * Formats XMLRequest object as XML string (for testing or MCP server to MCP server communication)
   */
  formatRequest(request: XMLRequest): ParseResult<string> {
    try {
      // Validate request object
      const validationResult = this.validateRequestObject(request);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error
        };
      }

      // Build XML structure
      const xmlObject = {
        mcp_request: {
          type: request.type,
          request_id: request.requestId,
          ...(request.userPrompt && { user_prompt: request.userPrompt }),
          ...(request.codebase && { codebase: this.formatCodebase(request.codebase) }),
          ...(request.executionResult && { execution_result: this.formatExecutionResult(request.executionResult) })
        }
      };

      // Generate XML string
      const xmlString = this.builder.build(xmlObject);
      
      return {
        success: true,
        data: xmlString
      };

    } catch (error) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_FORMAT_ERROR}: ${error instanceof Error ? error.message : 'Unknown formatting error'}`
      };
    }
  }

  /**
   * Extracts and validates request data from parsed XML
   */
  private extractRequestData(request: any): ParseResult<XMLRequest> {
    const errors: string[] = [];

    // Validate type
    if (!request.type) {
      errors.push('Missing required field: type');
    } else if (!['user_request', 'workflow_response'].includes(request.type)) {
      errors.push('Invalid type value. Must be "user_request" or "workflow_response"');
    }

    // Validate request_id
    if (request.request_id === undefined || request.request_id === null) {
      errors.push('Missing required field: request_id');
    } else {
      const requestIdStr = String(request.request_id).trim();
      if (requestIdStr.length === 0) {
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
        const promptStr = String(request.user_prompt).trim();
        if (promptStr.length === 0) {
          errors.push('user_prompt must be non-empty for user_request type');
        }
      }

      // Validate analysis section for user_request
      if (!request.analysis) {
        errors.push('analysis section is required for user_request type');
      } else {
        const analysisErrors = this.validateAnalysisSection(request.analysis);
        errors.push(...analysisErrors);
      }
    }

    if (request.type === 'workflow_response' && !request.execution_result) {
      errors.push('execution_result is required for workflow_response type');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_VALIDATION_ERROR}: ${errors.join(', ')}`
      };
    }

    // Extract data
    const xmlRequest: XMLRequest = {
      type: request.type,
      requestId: String(request.request_id).trim(),
      userPrompt: request.user_prompt ? String(request.user_prompt) : undefined,
      analysis: request.analysis ? this.parseAnalysisSection(request.analysis) : undefined,
      codebase: request.codebase ? this.parseCodebase(request.codebase) : undefined,
      executionResult: request.execution_result ? this.parseExecutionResult(request.execution_result) : undefined
    };

    return {
      success: true,
      data: xmlRequest
    };
  }

  /**
   * Validate analysis section structure and enum values
   */
  private validateAnalysisSection(analysis: any): string[] {
    const errors: string[] = [];

    // Validate workflow_type (required)
    if (!analysis.workflow_type) {
      errors.push('analysis.workflow_type is required');
    } else {
      const validWorkflowTypes = [
        'requirement_create', 'requirement_update',
        'wireframe_create', 'wireframe_update',
        'er_diagram_create', 'er_diagram_update',
        'prisma_schema_create', 'prisma_schema_update',
        'hld_create', 'hld_update',
        'tasks_create', 'tasks_update',
        'code_implementation', 'bug_fix', 'question'
      ];
      if (!validWorkflowTypes.includes(analysis.workflow_type)) {
        errors.push(`Invalid workflow_type: ${analysis.workflow_type}. Must be one of: ${validWorkflowTypes.join(', ')}`);
      }
    }

    // Validate requested_artifact (optional)
    if (analysis.requested_artifact) {
      const validArtifactTypes = ['requirements', 'wireframes', 'er-diagram', 'prisma-schema', 'hld', 'tasks', 'code'];
      if (!validArtifactTypes.includes(analysis.requested_artifact)) {
        errors.push(`Invalid requested_artifact: ${analysis.requested_artifact}. Must be one of: ${validArtifactTypes.join(', ')}`);
      }
    }

    // Validate boolean fields
    if (typeof analysis.is_create !== 'boolean') {
      errors.push('analysis.is_create must be a boolean');
    }

    if (typeof analysis.is_new_project !== 'boolean') {
      errors.push('analysis.is_new_project must be a boolean');
    }

    if (typeof analysis.has_quikim_directory !== 'boolean') {
      errors.push('analysis.has_quikim_directory must be a boolean');
    }

    // Validate arrays
    if (!Array.isArray(analysis.existing_artifact_versions)) {
      errors.push('analysis.existing_artifact_versions must be an array');
    }

    if (!Array.isArray(analysis.artifacts_in_latest_version)) {
      errors.push('analysis.artifacts_in_latest_version must be an array');
    }

    // Validate latest_version (optional number)
    if (analysis.latest_version !== null && analysis.latest_version !== undefined) {
      const version = Number(analysis.latest_version);
      if (isNaN(version) || version < 1 || !Number.isInteger(version)) {
        errors.push('analysis.latest_version must be a positive integer or null');
      }
    }

    return errors;
  }

  /**
   * Parse analysis section from XML
   */
  private parseAnalysisSection(analysis: any): any {
    if (!analysis) {
      return undefined;
    }

    // Parse existing_artifact_versions array
    let existingArtifactVersions = [];
    if (analysis.existing_artifact_versions && analysis.existing_artifact_versions.artifact) {
      const artifacts = Array.isArray(analysis.existing_artifact_versions.artifact) 
        ? analysis.existing_artifact_versions.artifact 
        : [analysis.existing_artifact_versions.artifact];
      
      existingArtifactVersions = artifacts.map((artifact: any) => ({
        type: artifact.type || '',
        version: Number(artifact.version) || 1,
        file_path: artifact.file_path || '',
        exists: artifact.exists === true || artifact.exists === 'true'
      }));
    }

    // Parse artifacts_in_latest_version array
    let artifactsInLatestVersion = [];
    if (analysis.artifacts_in_latest_version && analysis.artifacts_in_latest_version.artifact) {
      const artifacts = Array.isArray(analysis.artifacts_in_latest_version.artifact)
        ? analysis.artifacts_in_latest_version.artifact
        : [analysis.artifacts_in_latest_version.artifact];
      
      artifactsInLatestVersion = artifacts.map((artifact: any) => 
        typeof artifact === 'string' ? artifact : artifact['#text'] || artifact
      );
    }

    return {
      workflow_type: analysis.workflow_type,
      requested_artifact: analysis.requested_artifact || null,
      is_create: analysis.is_create === true || analysis.is_create === 'true',
      is_new_project: analysis.is_new_project === true || analysis.is_new_project === 'true',
      has_quikim_directory: analysis.has_quikim_directory === true || analysis.has_quikim_directory === 'true',
      existing_artifact_versions: existingArtifactVersions,
      latest_version: analysis.latest_version ? Number(analysis.latest_version) : null,
      artifacts_in_latest_version: artifactsInLatestVersion
    };
  }

  /**
   * Parses codebase from XML structure
   */
  private parseCodebase(codebase: any): any {
    if (!codebase || !codebase.file) {
      return undefined;
    }

    const files = Array.isArray(codebase.file) ? codebase.file : [codebase.file];
    
    return {
      files: files.map((file: any) => ({
        path: file['@_path'] || '',
        content: file['#text'] || '',
        size: (file['#text'] || '').length,
        lastModified: new Date()
      })),
      detectedTechnology: [],
      projectStructure: {
        rootPath: '',
        directories: [],
        fileTypes: {},
        packageManagers: [],
        frameworks: []
      },
      lastAnalysis: new Date()
    };
  }

  /**
   * Parses execution result from XML structure
   */
  private parseExecutionResult(execResult: any): any {
    if (!execResult) {
      return undefined;
    }

    return {
      success: execResult.success === true || execResult.success === 'true',
      output: execResult.output !== undefined && execResult.output !== null ? String(execResult.output) : '',
      error: execResult.error ? String(execResult.error) : undefined,
      filesModified: [],
      duration: 0
    };
  }

  /**
   * Formats codebase for XML output
   */
  private formatCodebase(codebase: any): any {
    if (!codebase || !codebase.files || !Array.isArray(codebase.files)) {
      return undefined;
    }

    const files = codebase.files.map((file: any) => ({
      '@_path': file.path || '',
      '#text': file.content || ''
    }));

    return {
      file: files.length === 1 ? files[0] : files
    };
  }

  /**
   * Formats execution result for XML output
   */
  private formatExecutionResult(execResult: any): any {
    if (!execResult) {
      return undefined;
    }

    return {
      action: execResult.action || '',
      success: execResult.success === true,
      output: execResult.output || '',
      ...(execResult.error && { error: execResult.error })
    };
  }

  /**
   * Formats action parameters for XML output
   */
  private formatParameters(parameters: ActionParameters): any {
    const formatted: any = {};

    if (parameters.files) {
      if (Array.isArray(parameters.files)) {
        formatted.files = parameters.files.join(',');
      } else {
        formatted.files = parameters.files;
      }
    }

    if (parameters.command) {
      formatted.command = parameters.command;
    }

    if (parameters.content) {
      formatted.content = parameters.content;
    }

    if (parameters.filePath) {
      formatted.file_path = parameters.filePath;
    }

    return formatted;
  }

  /**
   * Validates XMLRequest object before formatting
   */
  private validateRequestObject(request: XMLRequest): ParseResult<void> {
    const errors: string[] = [];

    if (!request.type || !['user_request', 'workflow_response'].includes(request.type)) {
      errors.push('Invalid or missing type');
    }

    if (!request.requestId || typeof request.requestId !== 'string' || request.requestId.trim().length === 0) {
      errors.push('Invalid or missing requestId');
    } else if (!/^[a-zA-Z0-9-_]+$/.test(request.requestId)) {
      errors.push('requestId must contain only alphanumeric characters, hyphens, and underscores');
    }

    if (request.type === 'user_request' && (!request.userPrompt || request.userPrompt.trim().length === 0)) {
      errors.push('userPrompt is required and must be non-empty for user_request type');
    }

    if (request.type === 'workflow_response' && !request.executionResult) {
      errors.push('executionResult is required for workflow_response type');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_VALIDATION_ERROR}: ${errors.join(', ')}`
      };
    }

    return { success: true };
  }

  /**
   * Validates XMLResponse object before formatting
   */
  private validateResponseObject(response: XMLResponse): ParseResult<void> {
    const errors: string[] = [];

    if (!response.requestId || typeof response.requestId !== 'string' || response.requestId.trim().length === 0) {
      errors.push('Invalid or missing requestId');
    } else if (!/^[a-zA-Z0-9-_]+$/.test(response.requestId)) {
      errors.push('requestId must contain only alphanumeric characters, hyphens, and underscores');
    }

    const validActions = ['read_files', 'create_file', 'modify_file', 'run_command', 'complete', 'request_info'];
    if (!response.action || !validActions.includes(response.action)) {
      errors.push('Invalid or missing action');
    }

    if (!response.instructions || typeof response.instructions !== 'string' || response.instructions.trim().length === 0) {
      errors.push('Invalid or missing instructions');
    }

    if (!response.reasoning || typeof response.reasoning !== 'string' || response.reasoning.trim().length === 0) {
      errors.push('Invalid or missing reasoning');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_VALIDATION_ERROR}: ${errors.join(', ')}`
      };
    }

    return { success: true };
  }

  /**
   * Decode HTML entities that may be present in XML from Cursor
   */
  private decodeHtmlEntities(text: string): string {
    const htmlEntities: { [key: string]: string } = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '='
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return htmlEntities[entity] || entity;
    });
  }

  /**
   * Utility method to check if a string is valid XML
   */
  isValidXML(xmlString: string): boolean {
    try {
      if (!xmlString || typeof xmlString !== 'string' || xmlString.trim().length === 0) {
        return false;
      }
      
      // Decode HTML entities before validation
      const decodedXml = this.decodeHtmlEntities(xmlString.trim());
      this.parser.parse(decodedXml);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Utility method to extract request ID from XML without full parsing
   */
  extractRequestId(xmlString: string): string | null {
    try {
      // Decode HTML entities before parsing
      const decodedXml = this.decodeHtmlEntities(xmlString.trim());
      const parsed = this.parser.parse(decodedXml);
      
      if (parsed.mcp_request?.request_id) {
        return String(parsed.mcp_request.request_id);
      }
      
      if (parsed.mcp_response?.request_id) {
        return String(parsed.mcp_response.request_id);
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts and validates response data from parsed XML
   */
  private extractResponseData(response: any): ParseResult<XMLResponse> {
    const errors: string[] = [];

    // Validate request_id
    if (response.request_id === undefined || response.request_id === null) {
      errors.push('Missing required field: request_id');
    }

    // Validate action
    if (!response.action) {
      errors.push('Missing required field: action');
    } else if (!['read_files', 'create_file', 'modify_file', 'run_command', 'complete', 'request_info'].includes(response.action)) {
      errors.push('Invalid action value');
    }

    // Validate instructions
    if (!response.instructions) {
      errors.push('Missing required field: instructions');
    }

    // Validate reasoning
    if (!response.reasoning) {
      errors.push('Missing required field: reasoning');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `${ERROR_CODES.XML_PARSE_ERROR}: ${errors.join(', ')}`
      };
    }

    // Extract parameters
    let parameters: ActionParameters = {};
    if (response.parameters) {
      if (response.parameters.files) {
        parameters.files = typeof response.parameters.files === 'string' 
          ? response.parameters.files.split(',').map((f: string) => f.trim())
          : response.parameters.files;
      }
      if (response.parameters.command) {
        parameters.command = response.parameters.command;
      }
      if (response.parameters.content) {
        parameters.content = response.parameters.content;
      }
      if (response.parameters.file_path) {
        parameters.filePath = response.parameters.file_path;
      }
    }

    // Build XMLResponse object
    const xmlResponse: XMLResponse = {
      requestId: String(response.request_id),
      action: response.action,
      instructions: response.instructions,
      parameters,
      reasoning: response.reasoning,
      ...(response.final_response && { finalResponse: response.final_response })
    };

    return {
      success: true,
      data: xmlResponse
    };
  }
}

// Export singleton instance for convenience
export const xmlParser = new XMLProtocolParser();