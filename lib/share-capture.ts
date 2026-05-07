import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import type { TaskDraft } from "@/lib/types";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol.toLowerCase())) return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function clampTitle(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  const max = SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(",")) {
    const tag = piece.trim().toLowerCase().slice(0, SCHEMA_LIMITS.TAG_MAX_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= SCHEMA_LIMITS.MAX_TAGS) break;
  }
  return out;
}

/**
 * Parses `?action=capture&title=…&url=…&tags=…` query params into a TaskDraft
 * destined for the Eliminate quadrant. Returns null when the action does not
 * apply or when there is nothing meaningful to capture (no title and no URL).
 *
 * Why URL-driven: bookmarklets cannot reach this app's IndexedDB across origins,
 * so the bookmarklet opens this app with params and we materialize the task here.
 */
export function parseShareCaptureParams(params: URLSearchParams): TaskDraft | null {
  if (params.get("action") !== "capture") return null;

  const safe = safeUrl(params.get("url"));
  const rawTitle = (params.get("title") ?? "").trim();
  const fallbackTitle = safe ? new URL(safe).hostname : "";
  const titleSource = rawTitle || fallbackTitle;
  if (!titleSource) return null;

  return {
    title: clampTitle(titleSource),
    description: safe ?? "",
    urgent: false,
    important: false,
    tags: parseTags(params.get("tags")),
  };
}
