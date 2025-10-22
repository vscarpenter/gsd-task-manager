"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { OAUTH_STATE_CONFIG, getOAuthEnvironment } from "@/lib/oauth-config";
import { canUsePopups, getPlatformInfo } from "@/lib/pwa-detection";
import {
  subscribeToOAuthHandshake,
  type OAuthHandshakeEvent,
  type OAuthAuthData,
} from "@/lib/sync/oauth-handshake";

function getWorkerURL(): string {
  if (typeof window === "undefined") {
    return "https://gsd.vinny.dev";
  }

  if (window.location.hostname === "localhost") {
    return "http://localhost:8787";
  }

  return window.location.origin;
}

const WORKER_URL = getWorkerURL();

interface OAuthButtonsProps {
  onSuccess?: (authData: OAuthAuthData) => void;
  onError?: (error: Error) => void;
  onStart?: (provider: "google" | "apple") => void;
}

interface PendingOAuthState {
  timestamp: number;
  provider: "google" | "apple";
  popup: Window | null;
}

export function OAuthButtons({ onSuccess, onError, onStart }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);
  const pendingStates = useRef<Map<string, PendingOAuthState>>(new Map());

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredStates: string[] = [];

      pendingStates.current.forEach((state, key) => {
        if (now - state.timestamp > OAUTH_STATE_CONFIG.MAX_STATE_AGE_MS) {
          expiredStates.push(key);
        }
      });

      expiredStates.forEach((key) => {
        console.warn("[OAuth] Expired state cleaned up:", {
          state: key.substring(0, 8) + "...",
          environment: getOAuthEnvironment(),
        });
        const pending = pendingStates.current.get(key);
        pending?.popup?.close();
        pendingStates.current.delete(key);
      });
    }, OAUTH_STATE_CONFIG.CLEANUP_INTERVAL_MS);

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOAuthHandshake((event: OAuthHandshakeEvent) => {
      const pending = pendingStates.current.get(event.state);
      if (!pending) {
        return;
      }

      pendingStates.current.delete(event.state);
      pending.popup?.close();
      setLoading(null);

      if (event.status === "success") {
        if (event.authData.provider !== pending.provider) {
          console.warn("[OAuth] Provider mismatch; ignoring result", {
            state: event.state.substring(0, 8) + "...",
            expected: pending.provider,
            received: event.authData.provider,
          });
          return;
        }

        console.info("[OAuth] Handshake completed successfully:", {
          provider: event.authData.provider,
          userId: event.authData.userId,
        });

        onSuccess?.(event.authData);
      } else {
        console.error("[OAuth] Handshake failed:", {
          state: event.state.substring(0, 8) + "...",
          error: event.error,
        });
        onError?.(new Error(event.error));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onSuccess, onError]);

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(provider);
    onStart?.(provider);

    try {
      const usePopup = canUsePopups();
      const platformInfo = getPlatformInfo();

      console.info("[OAuth] Initiating flow:", {
        provider,
        usePopup,
        platform: platformInfo,
        environment: getOAuthEnvironment(),
        workerUrl: WORKER_URL,
      });

      const workerEndpoint = `${WORKER_URL}/api/auth/oauth/${provider}/start`;

      let response;
      try {
        response = await fetch(workerEndpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          mode: "cors",
          credentials: "omit",
        });
      } catch (fetchError) {
        setLoading(null);
        const message =
          fetchError instanceof Error ? fetchError.message : "Network request failed";
        onError?.(new Error(message));
        throw fetchError;
      }

      if (!response.ok) {
        setLoading(null);
        const errorText = await response.text();
        const error = new Error(`Failed to initiate ${provider} OAuth: ${response.status} ${errorText}`);
        onError?.(error);
        throw error;
      }

      const { authUrl, state } = await response.json();

      if (!state || state.length < OAUTH_STATE_CONFIG.MIN_STATE_LENGTH) {
        setLoading(null);
        throw new Error("Invalid state token received from server");
      }

      pendingStates.current.set(state, {
        timestamp: Date.now(),
        provider,
        popup: null,
      });

      if (usePopup) {
        const width = 500;
        const height = 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          `${provider}_oauth`,
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
          pendingStates.current.delete(state);
          setLoading(null);
          throw new Error("Popup blocked. Please allow popups for this site.");
        }

        pendingStates.current.set(state, {
          timestamp: Date.now(),
          provider,
          popup,
        });

        console.info("[OAuth] Popup flow initiated:", {
          provider,
          state: state.substring(0, 8) + "...",
          environment: getOAuthEnvironment(),
        });

        popup.focus();
      } else {
        console.info("[OAuth] Redirect flow initiated:", {
          provider,
          state: state.substring(0, 8) + "...",
          environment: getOAuthEnvironment(),
        });

        window.location.href = authUrl;
      }
    } catch (error) {
      console.error("[OAuth] Flow failed:", error);
      if (error instanceof Error && error.message) {
        onError?.(error);
      }
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="subtle"
        className="relative w-full justify-start"
        disabled={loading !== null}
        onClick={() => handleOAuth("google")}
      >
        {loading === "google" ? "Connecting..." : "Continue with Google"}
      </Button>

      <Button
        variant="subtle"
        className="relative w-full justify-start"
        disabled={loading !== null}
        onClick={() => handleOAuth("apple")}
      >
        {loading === "apple" ? "Connecting..." : "Continue with Apple"}
      </Button>
    </div>
  );
}
