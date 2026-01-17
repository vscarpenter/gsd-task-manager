"use client";

import { useEffect, useState } from "react";
import { X, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectBrowserType(): "chrome" | "safari" | "other" {
  if (typeof window === "undefined") return "other";
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.includes("chrome") && !userAgent.includes("edg")) {
    return "chrome";
  } else if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
    return "safari";
  }
  return "other";
}

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [browserType] = useState<"chrome" | "safari" | "other">(detectBrowserType);

  useEffect(() => {
    // Check if already installed
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    if (isInstalled) {
      return; // Don't show prompt if already installed
    }

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem("gsd-pwa-dismissed");
    if (dismissed) {
      const dismissedTime = Number.parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For Safari/iOS, show prompt after a delay
    if (browserType === "safari" && !isInstalled) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds

      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [browserType]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If no install prompt (e.g., Safari), redirect to instructions
      window.location.href = ROUTES.INSTALL;
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error("Install prompt error:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("gsd-pwa-dismissed", Date.now().toString());
  };

  const handleLearnMore = () => {
    window.location.href = ROUTES.INSTALL;
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-labelledby="install-pwa-title"
      aria-describedby="install-pwa-description"
      className="fixed inset-x-3 top-3 z-50 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Download className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-2">
          <h3 id="install-pwa-title" className="font-semibold text-sm">
            Install GSD Task Manager
          </h3>
          <p id="install-pwa-description" className="text-sm text-muted-foreground">
            {browserType === "safari"
              ? "Install GSD on your device for quick access and offline use. Tap the share button and select 'Add to Home Screen'."
              : "Install GSD for quick access and offline use. Works completely offline."}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {deferredPrompt ? (
              <Button
                type="button"
                onClick={handleInstallClick}
                className="h-8 px-3 py-1 text-xs"
              >
                Install Now
              </Button>
            ) : (
              <Button
                type="button"
                variant="subtle"
                onClick={handleLearnMore}
                className="h-8 gap-1 px-3 py-1 text-xs"
              >
                <Info className="h-3 w-3" aria-hidden="true" />
                How to Install
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 px-3 py-1 text-xs"
            >
              Not Now
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 hover:bg-muted"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
