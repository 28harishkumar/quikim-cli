/**
 * Quikim - Artifact Graph Builder
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

/**
 * Builds ArtifactGraphSnapshot once per /workflow/next.
 * Uses at most 2 logical rounds: (1) fetch all artifacts in parallel, (2) links if API exists.
 */

import type {
  ArtifactGraphSnapshot,
  ArtifactSummary,
  ArtifactLinkRecord,
} from "../types/workflow-types.js";
import type { ServiceAwareAPIClient } from "../../mcp/api/service-client.js";

function toSummary(
  id: string,
  artifactType: string,
  specName: string,
  artifactName: string,
  version?: number,
  rootId?: string
): ArtifactSummary {
  return {
    id,
    rootId: rootId ?? id,
    artifactType,
    specName: specName || "default",
    artifactName,
    version,
    isLatest: true,
    isLLMContext: false,
  };
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const obj = data as Record<string, unknown>;
  if (obj && Array.isArray(obj.data)) return obj.data;
  return [];
}

/**
 * Builds artifact graph snapshot for a project by calling project API (one round of fetches).
 * Links are left empty unless a dedicated link API is available.
 */
export async function buildArtifactGraph(
  projectId: string,
  apiClient: ServiceAwareAPIClient
): Promise<ArtifactGraphSnapshot> {
  const artifacts: ArtifactSummary[] = [];

  const [reqRes, hldRes, lldRes, tasksRes, erRes, wireRes, contextsRes] =
    await Promise.all([
      apiClient.fetchRequirements(projectId),
      apiClient.fetchHLD(projectId),
      apiClient.fetchLLD(projectId),
      apiClient.fetchTasks(projectId),
      apiClient.fetchERDiagram(projectId),
      apiClient.fetchWireframes(projectId),
      apiClient.fetchContexts(projectId),
    ]);

  const reqData = (reqRes as { data?: unknown })?.data ?? reqRes;
  for (const item of extractList(reqData)) {
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const name = String(o.name ?? "requirement");
    const spec = String((o as { specName?: string }).specName ?? "default");
    const ver = typeof o.version === "number" ? o.version : undefined;
    const rootId = typeof o.rootId === "string" ? o.rootId : undefined;
    if (id) artifacts.push(toSummary(id, "requirement", spec, name, ver, rootId));
  }

  const hldData = (hldRes as { data?: unknown })?.data ?? hldRes;
  for (const item of extractList(hldData)) {
    const o = item as Record<string, unknown>;
    if (o.type !== "hld") continue;
    const id = String(o.id ?? "");
    const name = String(o.name ?? "hld");
    const spec = String((o as { specName?: string }).specName ?? "default");
    const ver = typeof o.version === "number" ? o.version : undefined;
    const rootId = typeof o.rootId === "string" ? o.rootId : undefined;
    if (id) artifacts.push(toSummary(id, "hld", spec, name, ver, rootId));
  }

  const lldData = (lldRes as { data?: unknown })?.data ?? lldRes;
  for (const item of extractList(lldData)) {
    const o = item as Record<string, unknown>;
    if (o.type !== "lld") continue;
    const id = String(o.id ?? "");
    const name = String(o.name ?? o.componentName ?? "lld");
    const spec = String((o as { specName?: string }).specName ?? "default");
    const ver = typeof o.version === "number" ? o.version : undefined;
    const rootId = typeof o.rootId === "string" ? o.rootId : undefined;
    if (id) artifacts.push(toSummary(id, "lld", spec, name, ver, rootId));
  }

  const tasksData = (tasksRes as { data?: unknown })?.data ?? tasksRes;
  for (const item of extractList(tasksData)) {
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const name = String(o.title ?? o.name ?? "tasks");
    const spec = String((o as { specName?: string }).specName ?? "default");
    if (id) artifacts.push(toSummary(id, "tasks", spec, name));
  }

  const erData = (erRes as { data?: unknown })?.data ?? erRes;
  for (const item of extractList(erData)) {
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const name = String(o.name ?? "flow_diagram");
    const spec = String((o as { specName?: string }).specName ?? "default");
    const ver = typeof o.version === "number" ? o.version : undefined;
    const rootId = typeof o.rootId === "string" ? o.rootId : undefined;
    if (id) artifacts.push(toSummary(id, "flow_diagram", spec, name, ver, rootId));
  }

  const wireData = (wireRes as { data?: unknown })?.data ?? wireRes;
  for (const item of extractList(wireData)) {
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const name = String(o.name ?? "wireframe");
    if (id) artifacts.push(toSummary(id, "wireframe_files", "default", name));
  }

  const ctxData = (contextsRes as { data?: unknown })?.data ?? contextsRes;
  for (const item of extractList(ctxData)) {
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    const name = String(o.title ?? o.name ?? "context");
    const spec = String((o as { specName?: string }).specName ?? "default");
    if (id) artifacts.push(toSummary(id, "context", spec, name));
  }

  const links: ArtifactLinkRecord[] = [];
  return { artifacts, links };
}
