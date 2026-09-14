import { describe, expect, it } from "vitest";
import { isExpectedOfflineDiagnostic } from "../../scripts/verify-production-pwa.cjs";

const rootUrl = "http://127.0.0.1:39239";

describe("production PWA verifier offline diagnostics", () => {
  it("ignores WebKit's failed preconnect to the closed smoke server", () => {
    const message =
      "Failed to preconnect to http://127.0.0.1:39239/. Error: Could not connect to 127.0.0.1: Connection refused";

    expect(isExpectedOfflineDiagnostic(message, rootUrl)).toBe(true);
  });

  it("still reports a failed preconnect to any other origin", () => {
    const message =
      "Failed to preconnect to https://api.vinny.io/. Error: Could not connect to api.vinny.io: Connection refused";

    expect(isExpectedOfflineDiagnostic(message, rootUrl)).toBe(false);
  });

  it("still reports every other console error", () => {
    const message = "Failed to load resource: the server responded with a status of 404";

    expect(isExpectedOfflineDiagnostic(message, rootUrl)).toBe(false);
  });
});
