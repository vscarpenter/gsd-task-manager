"use client";

import { useEffect } from "react";
import { NOTIFICATION_TIMING } from "@/lib/constants";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("Service worker registered successfully");

        // Check for updates when page becomes visible
        const checkForUpdates = () => {
          registration.update().catch((error) => {
            console.error("Service worker update check failed:", error);
          });
        };

        // Check for updates when the page becomes visible
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            checkForUpdates();
          }
        });

        // Listen for service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New service worker is ready
              console.log("New service worker available");

              // Dispatch custom event to notify PwaUpdateToast
              window.dispatchEvent(
                new CustomEvent("pwa-update-available", {
                  detail: newWorker
                })
              );
            }
          });
        });

        // Register periodic background sync if supported
        // Supported on Chrome/Edge (desktop/mobile), not yet on Safari/iOS
        if (registration && "periodicSync" in registration) {
          try {
            // Check every 15 minutes when PWA is installed but not open
            // Type assertion for experimental API not yet in TypeScript DOM types
            const periodicSync = (registration as ServiceWorkerRegistration & {
              periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
            }).periodicSync;

            if (periodicSync && typeof periodicSync.register === "function") {
              await periodicSync.register("check-notifications", {
                minInterval: NOTIFICATION_TIMING.BACKGROUND_SYNC_INTERVAL_MINUTES * NOTIFICATION_TIMING.MS_PER_MINUTE
              });
              console.log("Periodic background sync registered");
            }
          } catch (error) {
            console.error("Periodic sync registration failed:", error);
          }
        }
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    register();
  }, []);

  return null;
}
