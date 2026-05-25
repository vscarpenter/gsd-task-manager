"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createLogger } from "@/lib/logger";

const logger = createLogger("GLOBAL_ERROR");

const THROTTLE_MS = 2000;

export function GlobalErrorListener() {
  useEffect(() => {
    let lastToastTime = 0;

    function handleRejection(event: PromiseRejectionEvent) {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason ?? "Unknown rejection"));

      logger.error("Unhandled promise rejection", error, {
        type: event.reason instanceof Error ? event.reason.name : typeof event.reason,
      });

      const now = Date.now();
      if (now - lastToastTime >= THROTTLE_MS) {
        lastToastTime = now;
        toast.error("An unexpected error occurred");
      }
    }

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return null;
}
