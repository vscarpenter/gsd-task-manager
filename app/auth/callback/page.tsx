"use client";

import { useEffect, useRef, useState } from "react";
import { relayOAuthCallback, type OAuthRelayOutcome } from "@/lib/sync/oauth-callback";

const OUTCOME_TEXT: Record<OAuthRelayOutcome, string> = {
  delivered: "Sign-in is finishing in GSD. You can close this window.",
  unclaimed:
    "GSD didn't pick up this sign-in. It may have timed out or been cancelled. Close this window, go back to GSD, and sign in again.",
  invalid: "There's no sign-in to finish here. Close this window and start sign-in from GSD.",
};

/**
 * OAuth return page. The server bounce (docker/pb_hooks/oauth_web_redirect.pb.js)
 * puts `code` and `state` in the URL fragment, which never reaches the CDN logs.
 * This page relays them to the tab that started sign-in and removes them from
 * the address bar and this history entry. It closes once that tab has them, and
 * otherwise stays open to say why nothing happened.
 */
export default function OAuthCallbackPage() {
  const [outcome, setOutcome] = useState<OAuthRelayOutcome | null>(null);
  const relayStarted = useRef(false);

  useEffect(() => {
    // The fragment is cleared below, so a second effect run (StrictMode) would
    // find nothing and report "invalid" over the real outcome.
    if (relayStarted.current) return;
    relayStarted.current = true;

    const relay = relayOAuthCallback(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
    void relay.then((result) => {
      setOutcome(result);
      if (result === "delivered") {
        window.close();
      }
    });
  }, []);

  const failed = outcome === "unclaimed" || outcome === "invalid";

  // Two elements, each with a fixed role: changing `role` on a live element,
  // or mounting a status region with its text, often goes unannounced.
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center text-muted-foreground">
        <p role="status">
          {!outcome && "Finishing sign-in."}
          {outcome === "delivered" && OUTCOME_TEXT.delivered}
        </p>
        {failed && <p role="alert">{OUTCOME_TEXT[outcome]}</p>}
      </div>
    </div>
  );
}
