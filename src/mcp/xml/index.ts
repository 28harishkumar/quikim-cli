/**
 * XML Communication Layer - Main exports
 * Provides XML parsing and formatting functions for MCP Cursor Protocol
 */

export { XMLProtocolParser, xmlParser, ParseResult } from './parser.js';
export { XMLValidator, ValidationResult } from './validator.js';
export { 
  XML_REQUEST_SCHEMA, 
  XML_RESPONSE_SCHEMA, 
  XML_PARSER_OPTIONS, 
  XML_BUILDER_OPTIONS 
} from './schemas.js';