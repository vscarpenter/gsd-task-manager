import { expect, test } from "@playwright/test";

const DIRECTIONS = [
  "refined-evolution",
  "editorial-planner",
  "precision-utility",
  "spatial-focus",
  "native-calm",
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("gsd-has-launched", "true");
    window.localStorage.setItem("gsd-onboarding-seen", "true");
    window.localStorage.setItem("gsd-pwa-dismissed", Date.now().toString());
  });
});

test("shows five directions and a live comparison", async ({ page }) => {
  await page.goto("/design-lab");
  await expect(page.getByRole("heading", { name: "Five ways to make priorities tangible" })).toBeVisible();
  await expect(page.getByTestId("design-comparison")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open prototype: Spatial Focus desktop preview" })).toHaveAttribute(
    "href",
    "/design-lab/spatial-focus",
  );
});

test("honors direct mobile and dark-theme links", async ({ page }) => {
  await page.goto("/design-lab/native-calm?preview=mobile&theme=dark");
  await expect(page.locator(".dl-preview-stage")).toHaveAttribute("data-preview", "mobile");
  await expect(page.getByTestId("prototype-workspace")).toHaveAttribute("data-theme", "dark");
});

test("contains fixed mobile navigation inside the preview frame", async ({ page }) => {
  for (const [direction, navigation] of [
    ["precision-utility", ".dl-precision-rail"],
    ["native-calm", ".dl-native-sidebar"],
  ] as const) {
    await page.goto(`/design-lab/${direction}?preview=mobile`);
    const workspace = await page.getByTestId("prototype-workspace").boundingBox();
    const mobileNavigation = await page.locator(navigation).boundingBox();
    expect(workspace).not.toBeNull();
    expect(mobileNavigation).not.toBeNull();
    expect(mobileNavigation!.x).toBeGreaterThanOrEqual(workspace!.x);
    expect(mobileNavigation!.x + mobileNavigation!.width).toBeLessThanOrEqual(
      workspace!.x + workspace!.width
    );
    expect(mobileNavigation!.y + mobileNavigation!.height).toBeLessThanOrEqual(
      workspace!.y + workspace!.height
    );
  }
});

for (const direction of DIRECTIONS) {
  test(`${direction} reflows across desktop, mobile, and a 200% equivalent width`, async ({ page }) => {
    await page.goto(`/design-lab/${direction}`);
    await expect(page.getByTestId("prototype-workspace")).toHaveAttribute("data-direction", direction);
    await expect(page.getByTestId("prototype-task-renewal")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/design-lab/${direction}?preview=mobile`);
    await expect(page.getByTestId("prototype-workspace")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);

    // A 640 CSS-pixel viewport exercises the reflow available to a 1280px-wide
    // desktop viewport at 200% browser zoom without relying on browser chrome.
    await page.setViewportSize({ width: 640, height: 800 });
    await page.goto(`/design-lab/${direction}`);
    await expect(page.getByTestId("prototype-workspace")).toBeVisible();
    const zoomEquivalentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(zoomEquivalentOverflow).toBe(false);
  });
}

test("keeps coarse-pointer controls at least 44 by 44 CSS pixels", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    for (const direction of DIRECTIONS) {
      await page.goto(`http://localhost:3000/design-lab/${direction}`);
      const undersizedControls = await page
        .locator(".design-lab a, .design-lab button, .design-lab select")
        .evaluateAll((controls) =>
          controls.flatMap((control) => {
            const rect = control.getBoundingClientRect();
            const style = getComputedStyle(control);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              rect.width === 0 ||
              rect.height === 0 ||
              (rect.width >= 44 && rect.height >= 44)
            ) {
              return [];
            }
            return [{
              name: control.getAttribute("aria-label") ?? control.textContent?.trim() ?? control.tagName,
              width: rect.width,
              height: rect.height,
            }];
          })
        );
      expect(undersizedControls, `${direction} has undersized coarse-pointer controls`).toEqual([]);
    }
  } finally {
    await context.close();
  }
});

test("supports keyboard search, editing, dark mode, and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-lab/precision-utility");

  await page.getByRole("searchbox", { name: "Search tasks" }).focus();
  await page.keyboard.type("privacy");
  await expect(page.getByText("Review household backup and recovery plan")).toBeVisible();
  await page.getByRole("button", { name: "Clear search input" }).click();

  await page.getByTestId("prototype-task-renewal").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("prototype-task-renewal")).toBeFocused();

  await page.keyboard.press("Alt+r");
  await expect(page.getByTestId("prototype-review")).toBeFocused();

  await page.getByRole("button", { name: /dark theme/i }).click();
  await expect(page.getByTestId("prototype-workspace")).toHaveAttribute("data-theme", "dark");

  const motionDurations = await page.locator("[data-motion]").evaluateAll((elements) => {
    const toMilliseconds = (value: string): number => {
      const parsed = Number.parseFloat(value);
      return value.trim().endsWith("ms") ? parsed : parsed * 1000;
    };
    return elements.flatMap((element) => {
      const style = getComputedStyle(element);
      return [...style.animationDuration.split(","), ...style.transitionDuration.split(",")]
        .map(toMilliseconds);
    });
  });
  expect(motionDurations.length).toBeGreaterThan(0);
  expect(Math.max(...motionDurations)).toBeLessThanOrEqual(0.1);
});
