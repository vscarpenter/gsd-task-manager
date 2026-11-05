import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WHATS_NEW_LAST_SEEN_KEY,
  readLastSeenVersion,
  recordLastSeenVersion,
  runningWebVersion,
  subscribeLastSeenVersion,
} from "@/lib/whats-new/last-seen";

describe("What's New last-seen version", () => {
  beforeEach(() => {
    localStorage.removeItem(WHATS_NEW_LAST_SEEN_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("is null on a device that has never recorded one", () => {
    expect(readLastSeenVersion()).toBeNull();
  });

  it("reads back what was recorded", () => {
    recordLastSeenVersion("14.7.0");
    expect(readLastSeenVersion()).toBe("14.7.0");
    expect(localStorage.getItem(WHATS_NEW_LAST_SEEN_KEY)).toBe("14.7.0");
  });

  it("tells same-tab subscribers about a new record, and stops after unsubscribe", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeLastSeenVersion(onChange);
    recordLastSeenVersion("14.7.0");
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    recordLastSeenVersion("14.8.0");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("returns null when storage can't be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readLastSeenVersion()).toBeNull();
  });

  it("keeps the record for this session when storage refuses writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    recordLastSeenVersion("14.9.0");
    expect(readLastSeenVersion()).toBe("14.9.0");
  });

  it("reports the build number as the running web version", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_NUMBER", "14.7.0");
    expect(runningWebVersion()).toBe("14.7.0");
  });

  it("reports no running version when the build number is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_NUMBER", "");
    expect(runningWebVersion()).toBeNull();
  });
});
