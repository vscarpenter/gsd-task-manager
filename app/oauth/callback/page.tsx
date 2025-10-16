"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const WORKER_URL = "https://gsd-sync-worker.vscarpenter.workers.dev";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code and state from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing code or state parameter');
        }

        // Exchange code for token via worker
        const response = await fetch(`${WORKER_URL}/api/auth/oauth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            state,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'OAuth callback failed');
        }

        const authData = await response.json();

        // Send success message to opener window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'oauth_success',
              state,
              authData,
            },
            window.location.origin
          );
        }

        setStatus('success');

        // Close window after a short delay
        setTimeout(() => {
          window.close();
        }, 1000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setStatus('error');

        // Send error message to opener window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'oauth_error',
              error: errorMessage,
            },
            window.location.origin
          );
        }

        // Close window after error display
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-card-border bg-card p-8 text-center shadow-lg">
        {status === 'loading' && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Completing sign in...
            </h2>
            <p className="text-sm text-foreground-muted">
              Please wait while we finish setting up your account.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Sign in successful!
            </h2>
            <p className="text-sm text-foreground-muted">
              This window will close automatically...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Sign in failed
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              This window will close automatically...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
