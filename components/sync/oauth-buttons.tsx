"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { loginWithGoogle, loginWithGithub, type AuthState } from "@/lib/sync/pb-auth";

interface OAuthButtonsProps {
  onSuccess?: (authState: AuthState) => void;
  onError?: (error: Error) => void;
  onStart?: (provider: "google" | "github") => void;
}

export function OAuthButtons({ onSuccess, onError, onStart }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(provider);
    onStart?.(provider);

    try {
      const loginFn = provider === "google" ? loginWithGoogle : loginWithGithub;
      const authState = await loginFn();
      onSuccess?.(authState);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    } finally {
      setLoading(null);
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
