"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const THROTTLE_MS = 2000;

export function GlobalErrorListener() {
  useEffect(() => {
    let lastToastTime = 0;

    function handleRejection() {
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
