"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelOAuthLogin,
  loginWithGoogle,
  loginWithGithub,
  loginWithApple,
  openOAuthPopup,
  prepareOAuthLogin,
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

const PROVIDER_NAMES: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
  github: "GitHub",
};

interface OAuthButtonsProps {
  onSuccess?: (authState: AuthState) => void | Promise<void>;
  onError?: (error: Error) => void;
  onStart?: (provider: OAuthProvider) => void;
  /**
   * The provider this account signed in with, when it's signing in again. Each
   * provider can be its own account, so the wrong button reaches a different one.
   */
  lastUsedProvider?: string | null;
}

/** Runs one sign-in at a time and cancels it on request or on unmount. */
function useOAuthSignIn({ onSuccess, onError, onStart }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const activeRequestKey = useRef<string | null>(null);
  const mounted = useRef(true);

  // react-doctor-disable-next-line react-doctor/exhaustive-deps -- cleanup intentionally reads the latest ref value at unmount
  useEffect(() => {
    // StrictMode runs this cleanup once on a component that stays mounted, so
    // the next run has to mark it mounted again.
    mounted.current = true;
    // On unmount, cancel whatever OAuth login is currently in flight. Reading
    // the latest ref values at cleanup time is the intended behavior here.
    return () => {
      mounted.current = false;
      if (activeRequestKey.current) {
        cancelOAuthLogin(activeRequestKey.current);
      }
    };
  }, []);

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

  const start = (provider: OAuthProvider) => {
    const popupWindow = openOAuthPopup(provider);
    const requestKey = createOAuthRequestKey(provider);
    activeRequestKey.current = requestKey;
    setLoading(provider);
    onStart?.(provider);

    void runOAuth(provider, requestKey, popupWindow);
  };

  const cancel = () => {
    if (activeRequestKey.current) {
      cancelOAuthLogin(activeRequestKey.current);
    }
  };

  return { loading, start, cancel };
}

/**
 * Offered for the whole sign-in. A closed popup can't be detected for every
 * provider (Google severs the window handle), so Cancel is the way out.
 */
function CancelSignIn({ onCancel }: { onCancel: () => void }) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  // The clicked provider button is now disabled, and a disabled button can't
  // hold focus, so Cancel takes it.
  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  return (
    <Button ref={cancelButton} variant="ghost" className="shrink-0" onClick={onCancel}>
      Cancel sign-in
    </Button>
  );
}

/** What the sign-in is waiting on, with the way out. Renders empty between sign-ins. */
function SignInStatus({
  provider,
  onCancel,
}: {
  provider: OAuthProvider | null;
  onCancel: () => void;
}) {
  return (
    <div
      className={
        provider
          ? "mt-3 flex items-center justify-between gap-3 rounded-lg bg-background-muted p-3"
          : undefined
      }
    >
      {/* Always mounted: a live region that arrives with its text often goes unannounced. */}
      <p role="status" className="text-sm text-foreground">
        {provider &&
          `Waiting for ${PROVIDER_NAMES[provider]}. Finish signing in in the window that opened.`}
      </p>
      {provider && <CancelSignIn onCancel={onCancel} />}
    </div>
  );
}

export function OAuthButtons(props: OAuthButtonsProps) {
  const { loading, start, cancel } = useOAuthSignIn(props);
  const providerButtons = useRef<Partial<Record<OAuthProvider, HTMLButtonElement | null>>>({});
  const lastProvider = useRef<OAuthProvider | null>(null);

  // When sign-in ends, focus goes back to the button that started it.
  useEffect(() => {
    if (loading) {
      lastProvider.current = loading;
    } else if (lastProvider.current) {
      providerButtons.current[lastProvider.current]?.focus();
    }
  }, [loading]);

  return (
    <div>
      {/* Reaching for a button is the first sign the user means to sign in. */}
      <div className="space-y-3" onPointerEnter={prepareOAuthLogin} onFocus={prepareOAuthLogin}>
        {(Object.keys(PROVIDER_NAMES) as OAuthProvider[]).map((provider) => (
          <Button
            key={provider}
            ref={(node) => {
              providerButtons.current[provider] = node;
            }}
            variant="subtle"
            className="relative w-full justify-start"
            disabled={loading !== null}
            onClick={() => start(provider)}
          >
            Continue with {PROVIDER_NAMES[provider]}
            {provider === props.lastUsedProvider && (
              <span className="ml-auto text-xs text-foreground">Last used</span>
            )}
          </Button>
        ))}
      </div>
      <SignInStatus provider={loading} onCancel={cancel} />
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
