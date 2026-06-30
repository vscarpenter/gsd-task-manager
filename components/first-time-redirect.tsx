"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "gsd-has-launched";

/**
 * Redirects first-time visitors to /about so they see the landing page.
 * Once they navigate away from /about, the flag is set and they never see it again.
 */
export function FirstTimeRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  // The redirect decision depends on localStorage (client-only) in a static-export
  // SPA, so it cannot be resolved during render with next/navigation's redirect().
  // A useEffect redirect is unavoidable here; the component renders null, so it never
  // paints the wrong page itself (no flash originates from this component).
  useEffect(() => {
    const hasLaunched = localStorage.getItem(STORAGE_KEY);
    if (hasLaunched) return;

    // Set the flag first so subsequent navigations never re-trigger
    localStorage.setItem(STORAGE_KEY, "true");

    if (pathname !== "/about") {
      // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect -- client-gated SPA redirect; renders null, no flash
      router.replace("/about");
    }
  }, [pathname, router]);

  return null;
}
