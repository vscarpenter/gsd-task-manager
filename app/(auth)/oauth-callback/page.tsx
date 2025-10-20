"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * OAuth callback page for redirect-based OAuth flow
 * Used when popups are blocked (e.g., PWA mode on iOS)
 */
function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get OAuth result from URL params
        const success = searchParams.get('success');
        const errorParam = searchParams.get('error');
        const state = searchParams.get('state');
        const userId = searchParams.get('userId');
        const deviceId = searchParams.get('deviceId');
        const email = searchParams.get('email');
        const token = searchParams.get('token');
        const expiresAt = searchParams.get('expiresAt');
        const requiresEncryptionSetup = searchParams.get('requiresEncryptionSetup');
        const encryptionSalt = searchParams.get('encryptionSalt');
        const provider = searchParams.get('provider');

        if (errorParam) {
          setStatus('error');
          setError(decodeURIComponent(errorParam));

          // Store error in sessionStorage for the main app to read
          sessionStorage.setItem('oauth_error', errorParam);

          // Redirect back to main app after 2 seconds
          setTimeout(() => {
            router.push('/');
          }, 2000);
          return;
        }

        if (success === 'true' && userId && deviceId && email && token && expiresAt && provider && state) {
          setStatus('success');

          // Store OAuth success data in sessionStorage for the main app to read
          const authData = {
            userId,
            deviceId,
            email,
            token,
            expiresAt: Number(expiresAt),
            requiresEncryptionSetup: requiresEncryptionSetup === 'true',
            encryptionSalt: encryptionSalt || undefined,
            provider,
            state,
          };

          sessionStorage.setItem('oauth_success', JSON.stringify(authData));

          // Redirect back to main app
          setTimeout(() => {
            router.push('/?oauth_complete=true');
          }, 500);
        } else {
          setStatus('error');
          setError('Invalid OAuth callback - missing required parameters');
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      } catch (err) {
        console.error('OAuth callback processing error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to process OAuth callback');
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-card-border bg-card p-8 text-center shadow-xl">
        {status === 'processing' && (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              Completing sign in...
            </h1>
            <p className="text-sm text-foreground-muted">
              Please wait while we finish setting up your account.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              Sign in successful!
            </h1>
            <p className="text-sm text-foreground-muted">
              Redirecting you back to the app...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              Sign in failed
            </h1>
            <p className="text-sm text-red-600 dark:text-red-400">
              {error || 'An error occurred during authentication'}
            </p>
            <p className="mt-2 text-xs text-foreground-muted">
              Redirecting back to the app...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-card-border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <h1 className="mb-2 text-xl font-semibold text-foreground">
            Loading...
          </h1>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
