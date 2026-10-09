"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isResetPending } from "@/lib/reset-lock";

const STORAGE_KEY = "gsd-has-launched";

/**
 * Redirects first-time visitors to /about so they see the landing page.
 * The flag is written only after they leave /about, so closing the tab
 * on the landing page still shows it next time.
 */
export function FirstTimeRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const seenAbout = useRef(pathname === "/about");

  // The redirect decision depends on localStorage (client-only) in a static-export
  // SPA, so it cannot be resolved during render with next/navigation's redirect().
  // A useEffect redirect is unavoidable here; the component renders null, so it never
  // paints the wrong page itself (no flash originates from this component).
  useEffect(() => {
    // A page that loads locked hydrates this component once before the lock screen
    // renders. Leave the flag and the route alone until the reset finishes.
    if (isResetPending()) return;

    const hasLaunched = localStorage.getItem(STORAGE_KEY);
    if (hasLaunched) return;

    if (pathname === "/about") {
      seenAbout.current = true;
      return;
    }

    // They opened the app from the landing page. Remember that, and stay.
    if (seenAbout.current) {
      localStorage.setItem(STORAGE_KEY, "true");
      return;
    }

    // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect -- client-gated SPA redirect; renders null, no flash
    router.replace("/about");
  }, [pathname, router]);

  return null;
}
