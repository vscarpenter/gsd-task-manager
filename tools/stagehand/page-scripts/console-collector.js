/*
 * console-collector.js — records console errors/warnings, uncaught errors,
 * and failed fetches into window.__gsdEvidence for the Stagehand harness.
 * Evaluated via page.evaluate() after every navigation (navigation wipes it).
 */
(() => {
  if (window.__gsdEvidence) return;
  const evidence = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
  window.__gsdEvidence = evidence;
  const toText = (parts) =>
    parts
      .map((part) => {
        if (typeof part === "string") return part;
        try {
          return JSON.stringify(part);
        } catch {
          return String(part);
        }
      })
      .join(" ");
  const originalError = console.error.bind(console);
  console.error = (...parts) => {
    evidence.consoleErrors.push(toText(parts));
    originalError(...parts);
  };
  const originalWarn = console.warn.bind(console);
  console.warn = (...parts) => {
    evidence.consoleWarnings.push(toText(parts));
    originalWarn(...parts);
  };
  window.addEventListener("error", (event) => {
    evidence.pageErrors.push(String(event.message));
  });
  window.addEventListener("unhandledrejection", (event) => {
    evidence.pageErrors.push(`unhandledrejection: ${String(event.reason)}`);
  });
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...fetchArgs) => {
      const response = await originalFetch(...fetchArgs);
      if (!response.ok) evidence.failedRequests.push(`${response.status} ${response.url}`);
      return response;
    };
  }
})();
