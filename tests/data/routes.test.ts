import { describe, it, expect } from 'vitest';
import { ROUTES, ROUTE_VARIANTS, isRouteActive } from '@/lib/routes';

describe('routes', () => {
  describe('ROUTES constants', () => {
    it('should define HOME route as root path', () => {
      expect(ROUTES.HOME).toBe('/');
    });

    it('should define DASHBOARD route', () => {
      expect(ROUTES.DASHBOARD).toBe('/dashboard');
    });

    it('should define INSTALL route', () => {
      expect(ROUTES.INSTALL).toBe('/install');
    });
  });

  describe('ROUTE_VARIANTS', () => {
    it('should include index.html variant for HOME', () => {
      expect(ROUTE_VARIANTS.HOME).toContain('/');
      expect(ROUTE_VARIANTS.HOME).toContain('/index.html');
    });

    it('should include trailing slash and .html variants for DASHBOARD', () => {
      expect(ROUTE_VARIANTS.DASHBOARD).toContain('/dashboard');
      expect(ROUTE_VARIANTS.DASHBOARD).toContain('/dashboard/');
      expect(ROUTE_VARIANTS.DASHBOARD).toContain('/dashboard.html');
    });

    it('should include trailing slash and .html variants for INSTALL', () => {
      expect(ROUTE_VARIANTS.INSTALL).toContain('/install');
      expect(ROUTE_VARIANTS.INSTALL).toContain('/install/');
      expect(ROUTE_VARIANTS.INSTALL).toContain('/install.html');
    });
  });

  describe('isRouteActive', () => {
    it('should return true for exact HOME match', () => {
      expect(isRouteActive('/', 'HOME')).toBe(true);
    });

    it('should return true for HOME index.html variant', () => {
      expect(isRouteActive('/index.html', 'HOME')).toBe(true);
    });

    it('should return false for non-matching pathname', () => {
      expect(isRouteActive('/settings', 'HOME')).toBe(false);
    });

    it('should return true for exact DASHBOARD match', () => {
      expect(isRouteActive('/dashboard', 'DASHBOARD')).toBe(true);
    });

    it('should return true for DASHBOARD trailing slash', () => {
      expect(isRouteActive('/dashboard/', 'DASHBOARD')).toBe(true);
    });

    it('should return true for DASHBOARD .html variant', () => {
      expect(isRouteActive('/dashboard.html', 'DASHBOARD')).toBe(true);
    });

    it('should return false when pathname matches a different route', () => {
      expect(isRouteActive('/dashboard', 'HOME')).toBe(false);
      expect(isRouteActive('/', 'DASHBOARD')).toBe(false);
    });

    it('should return true for INSTALL route variants', () => {
      expect(isRouteActive('/install', 'INSTALL')).toBe(true);
      expect(isRouteActive('/install/', 'INSTALL')).toBe(true);
      expect(isRouteActive('/install.html', 'INSTALL')).toBe(true);
    });
  });
});
