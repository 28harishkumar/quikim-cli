/**
 * Quikim - Wireframe CLI Commands
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 *
 * Wireframe download, update, list, and modify (LLM) via project-service API.
 * Contract: GET/PATCH /organizations/:orgId/projects/:projectId/wireframes/:id, POST /projects/:projectId/wireframes/modify.
 */

import { Command } from "commander";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { configManager } from "../config/manager.js";
import { getQuikimProjectRoot } from "../config/project-root.js";
import { ServiceAwareAPIClient } from "../mcp/api/service-client.js";
import * as output from "../utils/output.js";

/** Ensure user is authenticated and has org + project context */
function requireAuthAndProject(): {
  organizationId: string;
  projectId: string;
  client: ServiceAwareAPIClient;
} {
  if (!configManager.isAuthenticated() || !configManager.getAuth()?.token) {
    output.error("Not logged in. Run 'quikim login' to authenticate.");
    process.exit(1);
  }
  const auth = configManager.getAuth()!;
  const project = configManager.getCurrentProject();
  const organizationId = auth.organizationId;
  if (!organizationId) {
    output.error("No organization in session. Re-login and ensure you have an organization.");
    process.exit(1);
  }
  if (!project?.projectId) {
    output.error("No project connected. Run 'quikim connect' to connect to a project.");
    process.exit(1);
  }
  const client = new ServiceAwareAPIClient();
  return { organizationId, projectId: project.projectId, client };
}

/**
 * Create wireframe CLI command group and subcommands (download, update, list, modify).
 */
export function createWireframeCommands(): Command {
  const wireframe = new Command("wireframe")
    .description("Manage wireframes (download, update, list, modify via LLM)");

  wireframe
    .command("download")
    .description("Download a wireframe by ID to a JSON file")
    .requiredOption("--wireframe-id <id>", "Wireframe ID")
    .option("--output <path>", "Output file path (default: .quikim/artifacts/default/wireframes/<name>.json)")
    .option("--org-id <id>", "Organization ID (overrides current session)")
    .option("--project-id <id>", "Project ID (overrides connected project)")
    .action(async (opts: { wireframeId: string; output?: string; orgId?: string; projectId?: string }) => {
      const ctx = requireAuthAndProject();
      const orgId = opts.orgId ?? ctx.organizationId;
      const projectId = opts.projectId ?? ctx.projectId;
      const client = ctx.client;
      try {
        const data = await client.getWireframe(orgId, projectId, opts.wireframeId) as Record<string, unknown>;
        const name = (data?.name as string) ?? opts.wireframeId;
        const outPath = opts.output ?? getDefaultWireframePath(name);
        await mkdir(dirname(outPath), { recursive: true });
        const payload = { id: data?.id, name: data?.name, projectId: data?.projectId, version: data?.version, content: data?.content, viewport: data?.viewport, elements: (data?.content as Record<string, unknown>)?.elements ?? [] };
        await writeFile(outPath, JSON.stringify(payload, null, 2), "utf-8");
        output.success(`Downloaded wireframe "${name}" to ${outPath}`);
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  wireframe
    .command("update")
    .description("Update wireframe name or content (PATCH)")
    .requiredOption("--wireframe-id <id>", "Wireframe ID")
    .option("--name <name>", "New name")
    .option("--org-id <id>", "Organization ID (overrides current session)")
    .option("--project-id <id>", "Project ID (overrides connected project)")
    .option("--file <path>", "JSON file with content/viewport/elements to apply")
    .action(async (opts: { wireframeId: string; name?: string; orgId?: string; projectId?: string; file?: string }) => {
      const ctx = requireAuthAndProject();
      const orgId = opts.orgId ?? ctx.organizationId;
      const projectId = opts.projectId ?? ctx.projectId;
      const client = ctx.client;
      const body: { name?: string; content?: unknown; viewport?: unknown; elements?: unknown[] } = {};
      if (opts.name) body.name = opts.name;
      if (opts.file) {
        const { readFile } = await import("fs/promises");
        const raw = await readFile(opts.file, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.content != null) body.content = parsed.content;
        if (parsed.viewport != null) body.viewport = parsed.viewport;
        if (Array.isArray(parsed.elements)) body.elements = parsed.elements;
      }
      if (Object.keys(body).length === 0) {
        output.error("Specify --name and/or --file to update.");
        process.exit(1);
      }
      try {
        await client.updateWireframe(orgId, projectId, opts.wireframeId, body);
        output.success("Wireframe updated.");
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  wireframe
    .command("list")
    .description("List wireframes for the connected project")
    .option("--org-id <id>", "Organization ID (overrides current session)")
    .option("--project-id <id>", "Project ID (overrides connected project)")
    .option("--json", "Output as JSON")
    .action(async (opts: { orgId?: string; projectId?: string; json?: boolean }) => {
      const ctx = requireAuthAndProject();
      const projectId = opts.projectId ?? ctx.projectId;
      const client = ctx.client;
      try {
        const res = await client.fetchWireframes(projectId) as { data?: unknown[] };
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        if (opts.json) {
          output.json(list);
          return;
        }
        output.header(`Wireframes (${list.length})`);
        output.separator();
        for (const w of list as Array<{ id: string; name?: string }>) {
          output.info(`  ${w.name ?? w.id}`);
          output.tableRow("    ID", w.id);
        }
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  wireframe
    .command("modify")
    .description("Modify wireframe with LLM (POST /wireframes/modify)")
    .requiredOption("--wireframe-id <id>", "Wireframe ID")
    .requiredOption("--prompt <text>", "Modification prompt for the LLM")
    .option("--project-id <id>", "Project ID (overrides connected project)")
    .action(async (opts: { wireframeId: string; prompt: string; projectId?: string }) => {
      const ctx = requireAuthAndProject();
      const projectId = opts.projectId ?? ctx.projectId;
      const client = ctx.client;
      try {
        await client.modifyWireframe(projectId, {
          wireframeId: opts.wireframeId,
          modificationRequest: opts.prompt,
        });
        output.success("Wireframe modified.");
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return wireframe;
}

function getDefaultWireframePath(name: string): string {
  const root = getQuikimProjectRoot();
  const safe = name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 80) || "wireframe";
  return `${root}/.quikim/artifacts/default/wireframes/${safe}.json`;
}
