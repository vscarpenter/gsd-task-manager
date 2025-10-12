"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaUpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Listen for custom event from PwaRegister
    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent<ServiceWorker>;
      setWaitingWorker(customEvent.detail);
      setShowUpdate(true);
    };

    window.addEventListener("pwa-update-available", handleUpdateAvailable);

    return () => {
      window.removeEventListener("pwa-update-available", handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    if (!waitingWorker) return;

    // Listen for the service worker to actually take over
    // IMPORTANT: Attach listener BEFORE posting message to avoid race condition
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Reload the page to use the new service worker
      window.location.reload();
    });

    // Tell the waiting service worker to take over
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-labelledby="update-title"
      className="fixed inset-x-3 bottom-3 z-50 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:left-auto sm:right-3 sm:max-w-md"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <RefreshCw className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-2">
          <h3 id="update-title" className="font-semibold text-sm">
            Update Available
          </h3>
          <p className="text-sm text-muted-foreground">
            A new version of GSD Task Manager is ready. Refresh to update.
          </p>

          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={handleUpdate} className="h-8 px-3 py-1 text-xs">
              Refresh Now
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 px-3 py-1 text-xs"
            >
              Later
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 hover:bg-muted"
          aria-label="Dismiss update notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
