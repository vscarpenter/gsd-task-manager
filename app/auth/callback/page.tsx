"use client";

import { useEffect } from "react";
import { relayOAuthCallback } from "@/lib/sync/oauth-callback";

/**
 * OAuth return page. The server bounce (docker/pb_hooks/oauth_web_redirect.pb.js)
 * puts `code` and `state` in the URL fragment, which never reaches the CDN logs.
 * This page relays them to the tab that started sign-in, removes them from the
 * address bar and this history entry, then tries to close the popup.
 */
export default function OAuthCallbackPage() {
  useEffect(() => {
    const relayed = relayOAuthCallback(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
    if (relayed) {
      window.close();
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="max-w-md text-center text-muted-foreground">
        Finishing sign-in. If this window stays open, close it and return to GSD.
      </p>
    </div>
  );
}
