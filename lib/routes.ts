import type { Route } from 'next';

/**
 * Application route constants
 *
 * Centralized route definitions to avoid magic strings throughout the codebase.
 * Uses Next.js typed routes for compile-time safety.
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js/typedRoutes
 */

/**
 * Primary routes (canonical paths)
 */
export const ROUTES = {
  /** Home page - Eisenhower Matrix view */
  HOME: '/' as Route,

  /** Analytics dashboard */
  DASHBOARD: '/dashboard' as Route,

  /** PWA installation instructions */
  INSTALL: '/install' as Route,
} as const;

/**
 * Route variants for static export compatibility
 *
 * Next.js static exports with `trailingSlash: true` create files like:
 * - /index.html (for /)
 * - /dashboard/index.html (for /dashboard/)
 *
 * These variants handle pathname detection in both dev and production.
 */
export const ROUTE_VARIANTS = {
  HOME: ['/', '/index.html'] as const,
  DASHBOARD: ['/dashboard', '/dashboard/', '/dashboard.html'] as const,
  INSTALL: ['/install', '/install/', '/install.html'] as const,
} as const;

/**
 * Helper to check if a pathname matches a route (including variants)
 *
 * @param pathname - Current pathname from usePathname()
 * @param route - Route key to check against
 * @returns True if pathname matches the route or any of its variants
 *
 * @example
 * ```tsx
 * const pathname = usePathname();
 * const isHome = isRouteActive(pathname, 'HOME');
 * // Returns true for: '/', '/index.html'
 * ```
 */
export function isRouteActive(
  pathname: string,
  route: keyof typeof ROUTE_VARIANTS
): boolean {
  const variants = ROUTE_VARIANTS[route] as readonly string[];
  return variants.includes(pathname);
}

/**
 * Type-safe route keys
 */
export type RouteKey = keyof typeof ROUTES;
