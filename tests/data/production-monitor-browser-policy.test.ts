import { describe, expect, it } from "vitest";
import { allowPublicRequest } from "../../monitoring/browser-policy.cjs";

describe("isolated production browser egress", () => {
  it.each([
    "https://gsd.vinny.dev/",
    "https://gsd.vinny.dev/settings/",
    "https://gsd.vinny.dev/_next/static/chunks/page.js",
    "https://gsd.vinny.dev/settings/__next.settings.txt?_rsc=abc-123",
    "https://api.vinny.io/api/health",
  ])("allows public read %s", (url) => {
    expect(allowPublicRequest(url, "GET")).toBe(true);
  });

  it.each([
    "https://api.vinny.io/api/collections/tasks/records",
    "https://api.vinny.io/api/gsd/tasks/task-id",
    "https://gsd.vinny.dev/api/tasks",
    "https://gsd.vinny.dev/_/",
    "https://gsd.vinny.dev/?title=private-task-content",
    "https://api.vinny.io/api/health?token=private",
    "https://private@gsd.vinny.dev/",
    "https://example.test/collector",
    "http://169.254.169.254/latest/meta-data/",
    "not-a-url",
  ])("blocks account access, content-bearing URLs and third parties: %s", (url) => {
    expect(allowPublicRequest(url, "GET")).toBe(false);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])("blocks every %s", (method) => {
    expect(allowPublicRequest("https://gsd.vinny.dev/", method)).toBe(false);
    expect(allowPublicRequest("https://api.vinny.io/api/health", method)).toBe(false);
  });
});
