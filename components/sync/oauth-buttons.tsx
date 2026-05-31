"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelOAuthLogin,
  loginWithGoogle,
  loginWithGithub,
  openOAuthPopup,
  type AuthState,
} from "@/lib/sync/pb-auth";

interface OAuthButtonsProps {
  onSuccess?: (authState: AuthState) => void | Promise<void>;
  onError?: (error: Error) => void;
  onStart?: (provider: "google" | "github") => void;
}

export function OAuthButtons({ onSuccess, onError, onStart }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);
  const activeRequestKey = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (activeRequestKey.current) {
        cancelOAuthLogin(activeRequestKey.current);
      }
    };
  }, []);

  const handleOAuth = (provider: "google" | "github") => {
    const popupWindow = openOAuthPopup(provider);
    const requestKey = createOAuthRequestKey(provider);
    activeRequestKey.current = requestKey;
    setLoading(provider);
    onStart?.(provider);

    void runOAuth(provider, requestKey, popupWindow);
  };

  const runOAuth = async (
    provider: "google" | "github",
    requestKey: string,
    popupWindow: Window | null
  ) => {
    try {
      const loginFn = provider === "google" ? loginWithGoogle : loginWithGithub;
      const authState = await loginFn({ requestKey, popupWindow });
      if (mounted.current) {
        await onSuccess?.(authState);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (mounted.current) {
        onError?.(err);
      }
    } finally {
      if (activeRequestKey.current === requestKey) {
        activeRequestKey.current = null;
      }
      if (mounted.current) {
        setLoading(null);
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
        onClick={() => handleOAuth("github")}
      >
        {loading === "github" ? "Connecting..." : "Continue with GitHub"}
      </Button>
    </div>
  );
}

function createOAuthRequestKey(provider: "google" | "github"): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `oauth_${provider}_${random}`;
}
