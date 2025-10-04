import "@testing-library/jest-dom/vitest";

// Provide a mock implementation for matchMedia used by Radix components
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false
  }) as MediaQueryList;
}
