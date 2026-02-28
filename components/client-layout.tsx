"use client";

/**
 * Client-side layout wrapper
 *
 * Simplified for PocketBase: OAuth callback handling is done
 * by the PocketBase SDK internally, so no OAuthCallbackHandler needed.
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
