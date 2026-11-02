import { test, expect } from "../harness/fixtures";

// `gsd-verify doctor` runs this. It opens a fresh browser profile and writes
// nothing to the instance, so it stays read-only.
test("usable", async ({ page, matrix: _matrix, proof }) => {
  await expect(page.getByTestId("matrix-grid")).toBeVisible();
  await expect(page.getByTestId("capture-input")).toBeEditable();
  await proof.capture("matrix");
});

test("production-csp", async ({ page, baseURL }) => {
  const response = await page.goto(baseURL as string);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
});

test("internet-blocked", async ({ page, matrix: _matrix }) => {
  // connect-src allows this origin, so only the DNS block can stop the request.
  const outcome = await page.evaluate(() =>
    fetch("https://api.vinny.io/api/health").then(
      (response) => `reached ${response.status}`,
      () => "blocked",
    ),
  );
  expect(outcome).toBe("blocked");
});
