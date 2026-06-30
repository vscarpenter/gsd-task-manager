"use client";

import { useEffect, useState } from "react";
import { X, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { TIME_MS } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PWA");

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

/**
 * Whether the prompt is still within the 7-day cooldown after the user
 * dismissed it. Reads the stored timestamp once.
 */
function isWithinDismissalCooldown(): boolean {
  const dismissed = localStorage.getItem("gsd-pwa-dismissed");
  if (!dismissed) {
    return false;
  }
  const dismissedTime = Number.parseInt(dismissed, 10);
  const daysSinceDismissed = (Date.now() - dismissedTime) / TIME_MS.DAY;
  return daysSinceDismissed < 7;
}

function navigateToInstall() {
  window.location.href = ROUTES.INSTALL;
}

interface PromptState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  showPrompt: boolean;
}

const INITIAL_PROMPT_STATE: PromptState = {
  deferredPrompt: null,
  showPrompt: false,
};

export function InstallPwaPrompt() {
  const [{ deferredPrompt, showPrompt }, setPromptState] =
    useState<PromptState>(INITIAL_PROMPT_STATE);
  const [browserType] = useState<"chrome" | "safari" | "other">(detectBrowserType);

  useEffect(() => {
    // Check if already installed
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      // navigator.standalone is a non-standard Safari/WebKit property not in
      // the TypeScript DOM types; `any` cast is the only way to access it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    if (isInstalled) {
      return; // Don't show prompt if already installed
    }

    // Check if user has dismissed the prompt before
    if (isWithinDismissalCooldown()) {
      return;
    }

    // Listen for the beforeinstallprompt event.
    // Chrome fires this on every SPA navigation, so we must re-check the
    // dismissal state each time the event fires — not just on mount.
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (isWithinDismissalCooldown()) {
        return;
      }
      setPromptState({
        deferredPrompt: e as BeforeInstallPromptEvent,
        showPrompt: true,
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For Safari/iOS, show prompt after a delay
    if (browserType === "safari" && !isInstalled) {
      const timer = setTimeout(() => {
        setPromptState((prev) => ({ ...prev, showPrompt: true }));
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
      navigateToInstall();
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setPromptState(INITIAL_PROMPT_STATE);
      }
    } catch (error) {
      logger.error("Install prompt error", error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleDismiss = () => {
    setPromptState((prev) => ({ ...prev, showPrompt: false }));
    localStorage.setItem("gsd-pwa-dismissed", Date.now().toString());
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
                onClick={navigateToInstall}
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
