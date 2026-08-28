"use client";

import { UnplugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Scoped fallback for the review's data region.
 *
 * Geometry mirrors the empty state rather than the app-wide boundary's
 * full-screen takeover, so the rail, topbar and matrix link stay reachable when
 * only the local read failed. Copy states where the data actually is — the
 * failure is a read, not a loss (brief principle 2).
 */
export function DashboardError(): React.ReactElement {
  return (
    <div
      role="alert"
      className="mx-auto max-w-xl border-y border-border/70 py-14 text-center sm:py-16"
    >
      <UnplugIcon className="mx-auto h-10 w-10 text-foreground-muted" aria-hidden />
      <h2 className="mt-4 text-h3 font-semibold text-foreground">
        Couldn&rsquo;t read your review
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground-muted">
        Your tasks are still on this device. This is a problem reading them back, not a
        problem with the data itself.
      </p>
      <Button className="touch-target mt-6" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}
