/**
 * XML Schema definitions for MCP Cursor Protocol
 * Defines the structure and validation rules for XML messages
 */

export const XML_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    mcp_request: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['user_request', 'workflow_response']
        },
        request_id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9-_]+$'
        },
        user_prompt: {
          type: 'string',
          minLength: 1
        },
        codebase: {
          type: 'object',
          properties: {
            file: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    '@_path': { type: 'string' },
                    '#text': { type: 'string' }
                  },
                  required: ['@_path', '#text']
                },
                {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      '@_path': { type: 'string' },
                      '#text': { type: 'string' }
                    },
                    required: ['@_path', '#text']
                  }
                }
              ]
            }
          }
        },
        execution_result: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            success: { type: 'boolean' },
            output: { type: 'string' }
          },
          required: ['action', 'success', 'output']
        }
      },
      required: ['type', 'request_id']
    }
  },
  required: ['mcp_request']
};

export const XML_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    mcp_response: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9-_]+$'
        },
        action: {
          type: 'string',
          enum: ['read_files', 'create_file', 'modify_file', 'run_command', 'complete', 'request_info']
        },
        instructions: {
          type: 'string',
          minLength: 1
        },
        parameters: {
          type: 'object',
          properties: {
            files: { type: 'string' },
            command: { type: 'string' },
            content: { type: 'string' },
            file_path: { type: 'string' }
          }
        },
        reasoning: {
          type: 'string',
          minLength: 1
        },
        final_response: {
          type: 'string'
        }
      },
      required: ['request_id', 'action', 'instructions', 'reasoning']
    }
  },
  required: ['mcp_response']
};

// XML parsing options for fast-xml-parser
export const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: false, // Don't trim values to preserve whitespace
  parseTrueNumberOnly: false,
  arrayMode: false,
  alwaysCreateTextNode: false,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseTagValue: true,
  cdataTagName: '__cdata',
  cdataPositionChar: '\\c',
  localeRange: '',
  stopNodes: ['parse-me-as-string']
};

// XML builder options for fast-xml-parser
export const XML_BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataTagName: '__cdata',
  cdataPositionChar: '\\c',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
  suppressUnpairedNode: true,
  suppressBooleanAttributes: true,
  tagValueProcessor: (_tagName: string, tagValue: unknown) => tagValue,
  attributeValueProcessor: (_attrName: string, attrValue: unknown) => attrValue
};