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

    if (!hasLaunched && pathname !== "/about") {
      router.replace("/about");
    }

    if (!hasLaunched && pathname === "/about") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [pathname, router]);

  return null;
}
