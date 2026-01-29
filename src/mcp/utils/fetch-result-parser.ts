/**
 * Quikim - Parse API Fetch Results for Force Pull
 *
 * Copyright (c) 2026 Quikim Inc.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { ArtifactType } from "../types/handler-types.js";

export interface FetchedArtifactItem {
  content: string;
  artifactNameOrId: string;
  rootId?: string;
}

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw) {
    const inner = (raw as { data: unknown }).data;
    return Array.isArray(inner) ? inner : [];
  }
  return [];
}

function extractText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "content" in v) return extractText((v as { content: unknown }).content);
  return "";
}

/**
 * Extract content and ids from fetch response for writing to local files.
 */
export function extractFetchedArtifacts(
  artifactType: ArtifactType,
  fetchData: unknown
): FetchedArtifactItem[] {
  const items: FetchedArtifactItem[] = [];
  const list = asArray(fetchData);

  for (const item of list) {
    const obj = item as Record<string, unknown>;
    const id = (obj.id ?? obj.artifactId ?? "") as string;
    const rootId = obj.rootId as string | undefined;
    let content = "";
    if (artifactType === "mermaid" && "mermaidDiagram" in obj) {
      content = String(obj.mermaidDiagram ?? "");
    } else {
      content = extractText(obj.content ?? obj);
    }
    const name = (obj.name ?? obj.title ?? id ?? "main") as string;
    if (content || id) {
      items.push({
        content: content || "# (empty)\n",
        artifactNameOrId: id || name,
        rootId,
      });
    }
  }

  if (items.length === 0 && fetchData && typeof fetchData === "object") {
    const single = fetchData as Record<string, unknown>;
    const id = (single.id ?? single.artifactId ?? "main") as string;
    const rootId = single.rootId as string | undefined;
    let content = "";
    if (artifactType === "mermaid" && "mermaidDiagram" in single) {
      content = String(single.mermaidDiagram ?? "");
    } else {
      content = extractText(single.content ?? single);
    }
    if (content || id) {
      items.push({
        content: content || "# (empty)\n",
        artifactNameOrId: id,
        rootId,
      });
    }
  }

  return items;
}
