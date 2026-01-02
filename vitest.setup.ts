import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { vi } from "vitest";
import "fake-indexeddb/auto";

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
