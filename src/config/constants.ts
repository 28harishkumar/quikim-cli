/**
 * Quikim - CLI Constants
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/** Default API URLs (production - single gateway) */
export const DEFAULT_API_URL = "https://api.quikim.com";

/** Local development service URLs */
export const LOCAL_USER_SERVICE_URL = "http://localhost:8001";
export const LOCAL_PROJECT_SERVICE_URL = "http://localhost:8002";
export const LOCAL_WORKFLOW_SERVICE_URL = "http://localhost:8004";

/** Legacy: kept for backward compatibility */
export const LOCAL_API_URL = LOCAL_USER_SERVICE_URL;

/** Config file name */
export const CONFIG_FILE_NAME = "quikim-cli";

/** Quikim directory name (stored in project directory) */
export const QUIKIM_DIR = ".quikim";

/** Project config file name (stored in .quikim directory for MCP server) */
export const PROJECT_CONFIG_FILE = "project.json";

/** CLI version */
export const CLI_VERSION = "0.1.0";

/** CLI name */
export const CLI_NAME = "quikim";
