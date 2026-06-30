"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Onboarding } from "./onboarding";

/** localStorage flag marking the welcome tour as seen. */
export const ONBOARDING_SEEN_KEY = "gsd-onboarding-seen";
/** Window event that replays the tour (dispatched from Settings → About). */
export const REPLAY_ONBOARDING_EVENT = "gsd:replay-onboarding";

// Marketing / utility surfaces where the tour should not auto-open.
const SUPPRESS_PREFIXES = ["/about", "/install"];

const noopSubscribe = () => () => {};
/** Client snapshot: has the user already seen the welcome tour? */
const getSeenSnapshot = () => !!localStorage.getItem(ONBOARDING_SEEN_KEY);
/**
 * Server/prerender snapshot: treat the tour as already seen so it never
 * auto-opens during static prerendering (where localStorage is unavailable).
 */
const getSeenServerSnapshot = () => true;

/**
 * Decides when the welcome tour appears: once for first-time visitors on the app
 * (not on the marketing pages), and on demand when replayed from settings. The
 * /about first-visit redirect is left untouched; the tour layers on top of the app.
 *
 * Auto-open is derived during render from the pathname and the localStorage
 * "seen" flag, so navigating from a suppressed route (e.g. /about) onto the app
 * opens the tour without setting state inside an effect. Replay is tracked as
 * explicit state because it is driven by a window event.
 */
export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [forceOpen, setForceOpen] = useState(false);
  const seen = useSyncExternalStore(noopSubscribe, getSeenSnapshot, getSeenServerSnapshot);

  useEffect(() => {
    const replay = () => setForceOpen(true);
    window.addEventListener(REPLAY_ONBOARDING_EVENT, replay);
    return () => window.removeEventListener(REPLAY_ONBOARDING_EVENT, replay);
  }, []);

  const suppressed = SUPPRESS_PREFIXES.some((p) => pathname?.startsWith(p));
  const open = forceOpen || (!suppressed && !seen);

  const close = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    setForceOpen(false);
  };

  const signIn = () => {
    close();
    router.push("/settings");
  };

  return <Onboarding open={open} onClose={close} onSignIn={signIn} />;
}
