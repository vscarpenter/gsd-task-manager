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

  useEffect(() => {
    const hasLaunched = localStorage.getItem(STORAGE_KEY);
    if (hasLaunched) return;

    // Set the flag first so subsequent navigations never re-trigger
    localStorage.setItem(STORAGE_KEY, "true");

    if (pathname !== "/about") {
      router.replace("/about");
    }
  }, [pathname, router]);

  return null;
}
