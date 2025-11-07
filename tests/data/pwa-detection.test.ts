import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isStandalonePWA,
  canUsePopups,
  getPlatformInfo,
} from "@/lib/pwa-detection";

describe("pwa-detection", () => {
  beforeEach(() => {
    // Reset window.matchMedia
    delete (window as { matchMedia?: unknown }).matchMedia;
    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    // Reset navigator.standalone
    delete (window.navigator as { standalone?: boolean }).standalone;
  });

  describe("isStandalonePWA", () => {
    it("returns false in browser mode", () => {
      expect(isStandalonePWA()).toBe(false);
    });

    it("detects iOS standalone mode", () => {
      (window.navigator as { standalone?: boolean }).standalone = true;
      expect(isStandalonePWA()).toBe(true);
    });

    it("detects standalone display mode", () => {
      window.matchMedia = vi.fn((query) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;

      expect(isStandalonePWA()).toBe(true);
    });

    it("detects minimal-ui display mode", () => {
      window.matchMedia = vi.fn((query) => ({
        matches: query === "(display-mode: minimal-ui)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;

      expect(isStandalonePWA()).toBe(true);
    });
  });

  describe("canUsePopups", () => {
    it("returns true in browser mode", () => {
      expect(canUsePopups()).toBe(true);
    });

    it("returns false in standalone PWA mode", () => {
      (window.navigator as { standalone?: boolean }).standalone = true;
      expect(canUsePopups()).toBe(false);
    });
  });

  describe("getPlatformInfo", () => {
    it("detects desktop platform", () => {
      const info = getPlatformInfo();

      expect(info.platform).toBe("desktop");
      expect(info.standalone).toBe(false);
      expect(info.mobile).toBe(false);
      expect(info.canUsePopups).toBe(true);
    });

    it("detects iOS platform", () => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
        configurable: true,
      });

      const info = getPlatformInfo();

      expect(info.platform).toBe("ios");
      expect(info.mobile).toBe(true);
    });

    it("detects Android platform", () => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 11)",
        configurable: true,
      });

      const info = getPlatformInfo();

      expect(info.platform).toBe("android");
      expect(info.mobile).toBe(true);
    });

    it("detects standalone mode in platform info", () => {
      (window.navigator as { standalone?: boolean }).standalone = true;

      const info = getPlatformInfo();

      expect(info.standalone).toBe(true);
      expect(info.canUsePopups).toBe(false);
    });
  });
});
