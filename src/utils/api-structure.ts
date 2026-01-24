/**
 * Quikim - API Structure Generator Utility
 * 
 * Copyright (c) 2026 Quikim Inc.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { APIStructureGenerator } from "./api-structure-generator.js";

/**
 * Generate API structure file for MCP caching
 */
export async function generateAPIStructureFile(projectPath: string): Promise<string> {
  const quikimDir = join(projectPath, ".quikim");
  const apiStructureFile = join(quikimDir, "api_structure.json");

  // Ensure .quikim directory exists
  await mkdir(quikimDir, { recursive: true });

  // Generate API structure using the new generator
  const apiStructureJSON = APIStructureGenerator.generateAPIStructureJSON();

  // Write to file
  await writeFile(apiStructureFile, apiStructureJSON, "utf-8");

  return apiStructureFile;
}
