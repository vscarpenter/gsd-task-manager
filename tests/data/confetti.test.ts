import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fire = vi.fn();
let libraryLoads = 0;
let idleCallbacks: Array<() => void> = [];

function stubBrowser({ reducedMotion }: { reducedMotion: boolean }): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reducedMotion }))
  );
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  });
  // jsdom returns null from getContext, which the module reads as "no canvas".
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as unknown as CanvasRenderingContext2D
  );
}

function mockLibrary({ failFirstLoad }: { failFirstLoad: boolean }): void {
  vi.doMock("canvas-confetti", () => {
    libraryLoads += 1;
    if (failFirstLoad && libraryLoads === 1) throw new Error("chunk unavailable offline");
    return { create: () => fire };
  });
}

// The library load and the first burst settle over a few microtask turns.
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe("confetti", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    fire.mockClear();
    libraryLoads = 0;
    idleCallbacks = [];
  });

  afterEach(() => {
    vi.doUnmock("canvas-confetti");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should_not_load_the_library_until_the_first_celebration", async () => {
    stubBrowser({ reducedMotion: false });
    mockLibrary({ failFirstLoad: false });

    const { celebrateCompletion } = await import("@/lib/confetti");
    await settle();
    expect(libraryLoads).toBe(0);

    celebrateCompletion();
    await settle();

    expect(libraryLoads).toBe(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("should_load_nothing_under_reduced_motion", async () => {
    stubBrowser({ reducedMotion: true });
    mockLibrary({ failFirstLoad: false });

    const { celebrateCompletion } = await import("@/lib/confetti");
    idleCallbacks.forEach((callback) => callback());
    celebrateCompletion();
    await settle();

    expect(idleCallbacks).toHaveLength(0);
    expect(libraryLoads).toBe(0);
    expect(fire).not.toHaveBeenCalled();
  });

  it("should_stay_quiet_and_retry_after_a_failed_import", async () => {
    stubBrowser({ reducedMotion: false });
    mockLibrary({ failFirstLoad: true });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    try {
      const { celebrateCompletion } = await import("@/lib/confetti");
      expect(() => celebrateCompletion()).not.toThrow();
      await settle();
      expect(fire).not.toHaveBeenCalled();

      celebrateCompletion();
      await settle();

      expect(libraryLoads).toBe(2);
      expect(fire).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("should_warm_the_library_once_when_the_browser_is_idle", async () => {
    stubBrowser({ reducedMotion: false });
    mockLibrary({ failFirstLoad: false });

    const { celebrateCompletion } = await import("@/lib/confetti");
    expect(idleCallbacks).toHaveLength(1);
    expect(libraryLoads).toBe(0);

    idleCallbacks[0]();
    await settle();
    expect(libraryLoads).toBe(1);
    expect(fire).not.toHaveBeenCalled();

    celebrateCompletion();
    await settle();
    expect(libraryLoads).toBe(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("should_schedule_no_warm_up_outside_a_browser", async () => {
    stubBrowser({ reducedMotion: false });
    mockLibrary({ failFirstLoad: false });
    vi.stubGlobal("window", undefined);

    await import("@/lib/confetti");

    expect(idleCallbacks).toHaveLength(0);
    expect(libraryLoads).toBe(0);
  });
});
