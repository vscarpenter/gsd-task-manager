"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelOAuthLogin,
  loginWithGoogle,
  loginWithGithub,
  loginWithApple,
  openOAuthPopup,
  type AuthState,
  type OAuthProvider,
} from "@/lib/sync/pb-auth";

/**
 * Apple is offered here for parity with the GSD iOS app, which has always had it. Without
 * it, an iOS user who signed in with Apple had a PocketBase account this app could not
 * reach — sync looked broken rather than absent.
 */
const LOGIN_FNS: Record<OAuthProvider, typeof loginWithGoogle> = {
  google: loginWithGoogle,
  github: loginWithGithub,
  apple: loginWithApple,
};

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
  github: "Continue with GitHub",
};

interface OAuthButtonsProps {
  onSuccess?: (authState: AuthState) => void | Promise<void>;
  onError?: (error: Error) => void;
  onStart?: (provider: OAuthProvider) => void;
}

export function OAuthButtons({ onSuccess, onError, onStart }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const activeRequestKey = useRef<string | null>(null);
  const mounted = useRef(true);

  // react-doctor-disable-next-line react-doctor/exhaustive-deps -- cleanup intentionally reads the latest ref value at unmount
  useEffect(() => {
    // On unmount, cancel whatever OAuth login is currently in flight. Reading
    // the latest ref values at cleanup time is the intended behavior here.
    return () => {
      mounted.current = false;
      if (activeRequestKey.current) {
        cancelOAuthLogin(activeRequestKey.current);
      }
    };
  }, []);

  const handleOAuth = (provider: OAuthProvider) => {
    const popupWindow = openOAuthPopup(provider);
    const requestKey = createOAuthRequestKey(provider);
    activeRequestKey.current = requestKey;
    setLoading(provider);
    onStart?.(provider);

    void runOAuth(provider, requestKey, popupWindow);
  };

  const runOAuth = async (
    provider: OAuthProvider,
    requestKey: string,
    popupWindow: Window | null
  ) => {
    // No `finally`: the React Compiler can't yet optimize a component with a
    // try/finally, so the shared cleanup runs from both paths via `finish()`.
    const finish = () => {
      if (activeRequestKey.current === requestKey) {
        activeRequestKey.current = null;
      }
      if (mounted.current) {
        setLoading(null);
      }
    };
    try {
      const loginFn = LOGIN_FNS[provider];
      const authState = await loginFn({ requestKey, popupWindow });
      if (mounted.current) {
        await onSuccess?.(authState);
      }
      finish();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (mounted.current) {
        onError?.(err);
      }
      finish();
    }
  };

  return (
    <div className="space-y-3">
      {(Object.keys(PROVIDER_LABELS) as OAuthProvider[]).map((provider) => (
        <Button
          key={provider}
          variant="subtle"
          className="relative w-full justify-start"
          disabled={loading !== null}
          onClick={() => handleOAuth(provider)}
        >
          {loading === provider ? "Connecting..." : PROVIDER_LABELS[provider]}
        </Button>
      ))}
    </div>
  );
}

function createOAuthRequestKey(provider: OAuthProvider): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `oauth_${provider}_${random}`;
}
