"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isOAuthOriginAllowed, OAUTH_STATE_CONFIG, getOAuthEnvironment } from "@/lib/oauth-config";
import { validateOAuthMessage, type OAuthSuccessMessage, type OAuthErrorMessage } from "@/lib/oauth-schemas";

// Use local worker for development, production worker for deployed app
const WORKER_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:8787"
  : "https://gsd-sync-worker.vscarpenter.workers.dev";

interface OAuthButtonsProps {
  onSuccess: (authData: {
    userId: string;
    deviceId: string;
    email: string;
    token: string;
    expiresAt: number;
    requiresEncryptionSetup: boolean;
    provider: string;
  }) => void;
  onError: (error: Error) => void;
}

/**
 * State management for OAuth flows
 * Tracks pending authentication attempts with timestamps for validation
 */
interface PendingOAuthState {
  timestamp: number;
  provider: 'google' | 'apple';
  popup: Window | null;
}

export function OAuthButtons({ onSuccess, onError }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  // Track pending OAuth states with automatic cleanup
  const pendingStates = useRef<Map<string, PendingOAuthState>>(new Map());

  // Cleanup expired states periodically
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
        console.warn('[OAuth Security] Expired state cleaned up:', {
          state: key.substring(0, 8) + '...',
          environment: getOAuthEnvironment(),
        });
        pendingStates.current.delete(key);
      });
    }, OAUTH_STATE_CONFIG.CLEANUP_INTERVAL_MS);

    return () => clearInterval(cleanupInterval);
  }, []);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(provider);

    try {
      // Request OAuth URL from worker
      const response = await fetch(`${WORKER_URL}/api/auth/oauth/${provider}/start`);

      if (!response.ok) {
        throw new Error(`Failed to initiate ${provider} OAuth`);
      }

      const { authUrl, state } = await response.json();

      // Validate state token length (basic sanity check)
      if (!state || state.length < OAUTH_STATE_CONFIG.MIN_STATE_LENGTH) {
        throw new Error('Invalid state token received from server');
      }

      // Open popup for OAuth flow
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
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Store state for validation (with timestamp for expiry check)
      pendingStates.current.set(state, {
        timestamp: Date.now(),
        provider,
        popup,
      });

      console.info('[OAuth Security] Flow initiated:', {
        provider,
        state: state.substring(0, 8) + '...',
        environment: getOAuthEnvironment(),
      });

      // Listen for callback message from popup with multi-layer security
      const messageHandler = (event: MessageEvent) => {
        // LAYER 1: Origin Validation
        // Only accept messages from trusted origins
        if (!isOAuthOriginAllowed(event.origin)) {
          console.warn('[OAuth Security] Rejected postMessage from untrusted origin:', {
            origin: event.origin,
            expected: 'one of allowed origins',
            environment: getOAuthEnvironment(),
          });
          return;
        }

        // LAYER 2: Message Structure Validation
        // Validate payload structure with Zod schema
        const validation = validateOAuthMessage(event.data);
        if (!validation.success) {
          console.warn('[OAuth Security] Invalid message structure:', {
            error: validation.error,
            origin: event.origin,
            environment: getOAuthEnvironment(),
          });
          return;
        }

        const message = validation.data!;

        // LAYER 3: State Validation
        // Verify state exists and hasn't expired
        if (message.type === 'oauth_success') {
          const successMessage = message as OAuthSuccessMessage;
          const pendingState = pendingStates.current.get(successMessage.state);

          if (!pendingState) {
            console.warn('[OAuth Security] Unknown or reused state token:', {
              state: successMessage.state.substring(0, 8) + '...',
              origin: event.origin,
              environment: getOAuthEnvironment(),
            });
            return;
          }

          // Check state hasn't expired
          const stateAge = Date.now() - pendingState.timestamp;
          if (stateAge > OAUTH_STATE_CONFIG.MAX_STATE_AGE_MS) {
            console.warn('[OAuth Security] Expired state token:', {
              state: successMessage.state.substring(0, 8) + '...',
              ageMs: stateAge,
              maxAgeMs: OAUTH_STATE_CONFIG.MAX_STATE_AGE_MS,
              environment: getOAuthEnvironment(),
            });
            pendingStates.current.delete(successMessage.state);
            return;
          }

          // LAYER 4: Provider Validation
          // Ensure provider matches what we initiated
          if (successMessage.authData.provider !== pendingState.provider) {
            console.warn('[OAuth Security] Provider mismatch:', {
              expected: pendingState.provider,
              received: successMessage.authData.provider,
              environment: getOAuthEnvironment(),
            });
            return;
          }

          // All validations passed - process success
          console.info('[OAuth Security] Authentication successful:', {
            provider: successMessage.authData.provider,
            userId: successMessage.authData.userId,
            environment: getOAuthEnvironment(),
          });

          // Cleanup
          window.removeEventListener('message', messageHandler);
          pendingStates.current.delete(successMessage.state);
          popup?.close();
          setLoading(null);

          onSuccess(successMessage.authData);
        } else if (message.type === 'oauth_error') {
          const errorMessage = message as OAuthErrorMessage;

          console.error('[OAuth Security] Authentication failed:', {
            error: errorMessage.error,
            state: errorMessage.state,
            origin: event.origin,
            environment: getOAuthEnvironment(),
          });

          // Cleanup
          window.removeEventListener('message', messageHandler);
          if (errorMessage.state) {
            pendingStates.current.delete(errorMessage.state);
          }
          popup?.close();
          setLoading(null);

          onError(new Error(errorMessage.error || 'OAuth failed'));
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed without completing auth
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          pendingStates.current.delete(state);
          setLoading(null);

          console.info('[OAuth Security] Popup closed by user:', {
            provider,
            environment: getOAuthEnvironment(),
          });
        }
      }, 500);
    } catch (error) {
      console.error('[OAuth Security] Flow initiation failed:', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: getOAuthEnvironment(),
      });
      setLoading(null);
      onError(error as Error);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={() => handleOAuth('google')}
        disabled={loading !== null}
        variant="subtle"
        className="w-full"
        type="button"
      >
        {loading === 'google' ? (
          <>
            <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Connecting...
          </>
        ) : (
          <>
            <GoogleIcon className="mr-2 h-5 w-5" />
            Continue with Google
          </>
        )}
      </Button>

      <Button
        onClick={() => handleOAuth('apple')}
        disabled={loading !== null}
        variant="subtle"
        className="w-full"
        type="button"
      >
        {loading === 'apple' ? (
          <>
            <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Connecting...
          </>
        ) : (
          <>
            <AppleIcon className="mr-2 h-5 w-5" />
            Continue with Apple
          </>
        )}
      </Button>
    </div>
  );
}

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Apple Icon Component
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
