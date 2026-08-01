"use client";

import { usePathname } from "next/navigation";

interface DesignLabRuntimeGateProps {
  appRuntime: React.ReactNode;
  children: React.ReactNode;
}

function isDesignLabRoute(pathname: string): boolean {
  return pathname === "/design-lab" || pathname.startsWith("/design-lab/");
}

/**
 * Keeps production-only providers and side effects outside the isolated design lab.
 * The gate renders no DOM, so non-lab routes retain their existing runtime tree.
 */
export function DesignLabRuntimeGate({
  appRuntime,
  children,
}: DesignLabRuntimeGateProps) {
  const pathname = usePathname();

  return isDesignLabRoute(pathname) ? children : appRuntime;
}
