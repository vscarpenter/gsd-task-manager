import { expect, test } from "@playwright/test";

interface DesignLabIsolationProbe {
  cacheOpenCalls: string[];
  indexedDbOpenCalls: string[];
  modelContextCalls: number;
  protectedStorageReads: string[];
  protectedStorageWrites: string[];
  runtimeEventListeners: string[];
  serviceWorkerRegisterCalls: string[];
}

declare global {
  interface Window {
    __designLabIsolationProbe: DesignLabIsolationProbe;
  }
}

const POCKETBASE_HOSTS = new Set([
  "127.0.0.1:8090",
  "localhost:8090",
  "api.vinny.io",
]);

test("keeps the design lab outside production storage and runtime services", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pocketBaseRequests: string[] = [];

  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      POCKETBASE_HOSTS.has(url.host) ||
      url.pathname.startsWith("/api/collections/")
    ) {
      pocketBaseRequests.push(request.url());
    }
  });

  await context.addInitScript(() => {
    const probe: DesignLabIsolationProbe = {
      cacheOpenCalls: [],
      indexedDbOpenCalls: [],
      modelContextCalls: 0,
      protectedStorageReads: [],
      protectedStorageWrites: [],
      runtimeEventListeners: [],
      serviceWorkerRegisterCalls: [],
    };
    Object.defineProperty(window, "__designLabIsolationProbe", {
      configurable: false,
      value: probe,
      writable: false,
    });

    const originalIndexedDbOpen = window.indexedDB.open.bind(window.indexedDB);
    Object.defineProperty(window.indexedDB, "open", {
      configurable: true,
      value: (name: string, version?: number) => {
        probe.indexedDbOpenCalls.push(name);
        return version === undefined
          ? originalIndexedDbOpen(name)
          : originalIndexedDbOpen(name, version);
      },
    });

    if ("caches" in window) {
      const originalCacheOpen = window.caches.open.bind(window.caches);
      Object.defineProperty(window.caches, "open", {
        configurable: true,
        value: (name: string) => {
          probe.cacheOpenCalls.push(name);
          return originalCacheOpen(name);
        },
      });
    }

    if ("serviceWorker" in navigator) {
      const originalRegister = navigator.serviceWorker.register.bind(
        navigator.serviceWorker
      );
      Object.defineProperty(navigator.serviceWorker, "register", {
        configurable: true,
        value: (scriptUrl: string, options?: RegistrationOptions) => {
          probe.serviceWorkerRegisterCalls.push(scriptUrl);
          return originalRegister(scriptUrl, options);
        },
      });
    }

    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      value: {
        provideContext: () => {
          probe.modelContextCalls += 1;
        },
      },
    });

    const protectedKeys = new Set([
      "gsd-has-launched",
      "gsd-onboarding-seen",
      "gsd-pwa-dismissed",
    ]);
    const originalStorageGet = Storage.prototype.getItem;
    const originalStorageSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function getItem(key: string): string | null {
      if (this === window.localStorage && protectedKeys.has(key)) {
        probe.protectedStorageReads.push(key);
      }
      return originalStorageGet.call(this, key);
    };
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (this === window.localStorage && protectedKeys.has(key)) {
        probe.protectedStorageWrites.push(key);
      }
      originalStorageSet.call(this, key, value);
    };

    const watchedEvents = new Set([
      "beforeinstallprompt",
      "gsd:replay-onboarding",
      "pwa-update-available",
    ]);
    const originalAddEventListener = window.addEventListener.bind(window);
    Object.defineProperty(window, "addEventListener", {
      configurable: true,
      value: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => {
        if (watchedEvents.has(type)) {
          probe.runtimeEventListeners.push(type);
        }
        originalAddEventListener(type, listener, options);
      },
    });
  });

  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/design-lab", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Five ways to make priorities tangible" })
    ).toBeVisible();

    const installEventWasNotPrevented = await page.evaluate(() =>
      window.dispatchEvent(
        new Event("beforeinstallprompt", { bubbles: false, cancelable: true })
      )
    );
    expect(installEventWasNotPrevented).toBe(true);

    await page.waitForTimeout(3_250);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Install GSD Task Manager")).toHaveCount(0);

    const probe = await page.evaluate(() => window.__designLabIsolationProbe);
    expect(probe).toEqual({
      cacheOpenCalls: [],
      indexedDbOpenCalls: [],
      modelContextCalls: 0,
      protectedStorageReads: [],
      protectedStorageWrites: [],
      runtimeEventListeners: [],
      serviceWorkerRegisterCalls: [],
    });
    expect(pocketBaseRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
