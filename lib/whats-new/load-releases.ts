"use client";

import { useSyncExternalStore } from "react";

import { createLogger } from "@/lib/logger";
import type { WhatsNewRelease } from "./releases";

const logger = createLogger("UI");

/**
 * The notes file holds every client's releases, so importing it statically put
 * about 8 KB gzipped on the matrix and Settings first loads. It loads as its own
 * chunk after hydration instead. The service worker caches hashed chunks on
 * first fetch, and the matrix asks for it on every visit, so it works offline
 * from the first visit after an update.
 */

let pending: Promise<WhatsNewRelease[]> | null = null;
let loaded: WhatsNewRelease[] | null = null;
const listeners = new Set<() => void>();

export function loadWhatsNewReleases(): Promise<WhatsNewRelease[]> {
  pending ??= import("./whats-new.json")
    .then((module) => {
      loaded = module.default.releases as WhatsNewRelease[];
      listeners.forEach((listener) => listener());
      return loaded;
    })
    .catch((error: unknown) => {
      // Forget a failed load (offline before the chunk was cached), so the next
      // subscriber retries instead of reusing the rejection until a reload.
      pending = null;
      throw error;
    });
  return pending;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // A failed load leaves the notes empty (null) until the next subscriber retries.
  loadWhatsNewReleases().catch((error: unknown) => {
    logger.warn("What's New notes failed to load", { error: error instanceof Error ? error.message : String(error) });
  });
  return () => listeners.delete(onChange);
}

const readLoaded = (): WhatsNewRelease[] | null => loaded;
const readServer = (): WhatsNewRelease[] | null => null;

/** Every client's releases once the notes chunk has loaded; null until then. */
export function useWhatsNewReleases(): WhatsNewRelease[] | null {
  return useSyncExternalStore(subscribe, readLoaded, readServer);
}
