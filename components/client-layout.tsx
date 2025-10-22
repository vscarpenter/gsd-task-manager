"use client";

import { Suspense } from 'react';
import { OAuthCallbackHandler } from './oauth-callback-handler';

/**
 * Client-side layout wrapper that provides global client components
 * This includes the OAuth callback handler that processes OAuth redirects
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* OAuth callback handler - processes OAuth success from sessionStorage */}
      <Suspense fallback={null}>
        <OAuthCallbackHandler />
      </Suspense>
    </>
  );
}
