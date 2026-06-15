"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Onboarding } from "./onboarding";

/** localStorage flag marking the welcome tour as seen. */
export const ONBOARDING_SEEN_KEY = "gsd-onboarding-seen";
/** Window event that replays the tour (dispatched from Settings → About). */
export const REPLAY_ONBOARDING_EVENT = "gsd:replay-onboarding";

// Marketing / utility surfaces where the tour should not auto-open.
const SUPPRESS_PREFIXES = ["/about", "/install"];

/**
 * Decides when the welcome tour appears: once for first-time visitors on the app
 * (not on the marketing pages), and on demand when replayed from settings. The
 * /about first-visit redirect is left untouched; the tour layers on top of the app.
 */
export function OnboardingGate() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (SUPPRESS_PREFIXES.some((p) => pathname?.startsWith(p))) return;
    if (localStorage.getItem(ONBOARDING_SEEN_KEY)) return;
    setOpen(true);
  }, [pathname]);

  useEffect(() => {
    const replay = () => setOpen(true);
    window.addEventListener(REPLAY_ONBOARDING_EVENT, replay);
    return () => window.removeEventListener(REPLAY_ONBOARDING_EVENT, replay);
  }, []);

  const close = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    setOpen(false);
  };

  const signIn = () => {
    close();
    router.push("/settings");
  };

  return <Onboarding open={open} onClose={close} onSignIn={signIn} />;
}
