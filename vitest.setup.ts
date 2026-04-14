import * as React from "react";
import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);
import "fake-indexeddb/auto";

// Bun passes --localstorage-file without a valid path to jsdom, producing a broken
// localStorage stub that lacks clear(), removeItem(), and other standard methods.
// Override it with a full in-memory implementation so all tests behave consistently.
class InMemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length(): number { return Object.keys(this.store).length; }
  clear(): void { this.store = {}; }
  getItem(key: string): string | null { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key: string, value: string): void { this.store[key] = String(value); }
  removeItem(key: string): void { delete this.store[key]; }
  key(index: number): string | null { return Object.keys(this.store)[index] ?? null; }
}
Object.defineProperty(window, 'localStorage', { value: new InMemoryStorage(), writable: true, configurable: true });
Object.defineProperty(window, 'sessionStorage', { value: new InMemoryStorage(), writable: true, configurable: true });

// Provide a mock implementation for matchMedia used by Radix components
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false
  }) as MediaQueryList;
}

// Polyfill for isContentEditable property in jsdom
Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
  get: function() {
    const contentEditable = this.getAttribute('contenteditable');
    return contentEditable === 'true' || contentEditable === '';
  },
  configurable: true
});

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

const shouldSuppressConsole = (firstArg: unknown): boolean => {
  if (typeof firstArg !== "string") {
    return false;
  }

  if (firstArg.includes("[OAuthHandshake]")) {
    return true;
  }

  if (firstArg.includes("[SYNC_API]")) {
    return true;
  }

  return false;
};

console.error = (...args: unknown[]) => {
  const [firstArg] = args;
  if (typeof firstArg === "string") {
    if (shouldSuppressConsole(firstArg)) {
      return;
    }
    if (firstArg.includes("not wrapped in act")) {
      return;
    }
    if (firstArg.includes("Missing `Description`") && firstArg.includes("DialogContent")) {
      return;
    }
    if (firstArg.includes("requires a") && firstArg.includes("DialogTitle")) {
      return;
    }
  }
  originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
  const [firstArg] = args;
  if (typeof firstArg === "string") {
    if (shouldSuppressConsole(firstArg)) {
      return;
    }
    if (firstArg.includes("Missing `Description`") && firstArg.includes("DialogContent")) {
      return;
    }
    if (firstArg.includes("DialogTitle")) {
      return;
    }
  }
  originalConsoleWarn(...args);
};

console.log = (...args: unknown[]) => {
  const [firstArg] = args;
  if (shouldSuppressConsole(firstArg)) {
    return;
  }
  originalConsoleLog(...args);
};

console.info = (...args: unknown[]) => {
  const [firstArg] = args;
  if (shouldSuppressConsole(firstArg)) {
    return;
  }
  originalConsoleInfo(...args);
};

console.debug = (...args: unknown[]) => {
  const [firstArg] = args;
  if (shouldSuppressConsole(firstArg)) {
    return;
  }
  originalConsoleDebug(...args);
};
