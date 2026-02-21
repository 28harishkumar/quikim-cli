/**
 * Quikim - Test artifact CLI commands
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 *
 * Sync test artifacts (sample input/output, schemas) with project-service.
 * Pull writes to .quikim/artifacts/<spec>/tests_<id>.md.
 */

import { Command } from "commander";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { configManager } from "../config/manager.js";
import { getQuikimProjectRoot } from "../config/project-root.js";
import { ServiceAwareAPIClient } from "../mcp/api/service-client.js";
import * as output from "../utils/output.js";

/** Ensure user is authenticated and has project context */
function requireAuthAndProject(): { projectId: string; client: ServiceAwareAPIClient } {
  if (!configManager.isAuthenticated() || !configManager.getAuth()?.token) {
    output.error("Not logged in. Run 'quikim login' to authenticate.");
    process.exit(1);
  }
  const project = configManager.getCurrentProject();
  if (!project?.projectId) {
    output.error("No project connected. Run 'quikim connect' to connect to a project.");
    process.exit(1);
  }
  const client = new ServiceAwareAPIClient();
  return { projectId: project.projectId, client };
}

/**
 * Create test CLI command group with sync (pull from server).
 */
export function createTestCommands(): Command {
  const testCmd = new Command("test")
    .description("Manage test artifacts (sync from server to .quikim/artifacts)");

  testCmd
    .command("sync")
    .description("Pull tests from server and write to .quikim/artifacts/<spec>/tests_<id>.md")
    .option("--spec <name>", "Spec name (default: default)")
    .option("--project-id <id>", "Project ID (overrides connected project)")
    .option("--json", "Output list as JSON only (do not write files)")
    .action(async (opts: { spec?: string; projectId?: string; json?: boolean }) => {
      const ctx = requireAuthAndProject();
      const projectId = opts.projectId ?? ctx.projectId;
      const specName = opts.spec ?? "default";
      const client = ctx.client;
      try {
        const res = await client.fetchTests(projectId, specName) as { data?: unknown[] };
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        if (opts.json) {
          output.json(list);
          return;
        }
        const root = getQuikimProjectRoot();
        const specDir = join(root, ".quikim", "artifacts", specName);
        await mkdir(specDir, { recursive: true });
        let written = 0;
        for (const t of list as Array<{ id: string; name?: string; description?: string; sampleInputOutput?: unknown; inputDescription?: unknown; outputDescription?: unknown }>) {
          const id = t.id;
          const name = t.name ?? id;
          const content = [
            "# " + (name || "Test"),
            "",
            (t.description ? `## Description\n\n${t.description}\n\n` : ""),
            "## sampleInputOutput\n\n```json",
            JSON.stringify(t.sampleInputOutput ?? {}, null, 2),
            "```",
            "",
            "## inputDescription\n\n" + (typeof t.inputDescription === "object" ? JSON.stringify(t.inputDescription, null, 2) : String(t.inputDescription ?? "")),
            "",
            "## outputDescription\n\n" + (typeof t.outputDescription === "object" ? JSON.stringify(t.outputDescription, null, 2) : String(t.outputDescription ?? "")),
          ].join("\n");
          const path = join(specDir, `tests_${id}.md`);
          await writeFile(path, content, "utf-8");
          written++;
        }
        output.success(`Synced ${written} test(s) to .quikim/artifacts/${specName}/`);
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return testCmd;
}
