import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP_ROOT = join(process.cwd(), "app");
const E2E_ORIGIN = "http://localhost:3000";

function pageFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? pageFiles(path) : entry.name === "page.tsx" ? [path] : [];
  });
}

function routeForPage(path: string): string {
  const segments = relative(APP_ROOT, path)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

export const E2E_WARM_ROUTES = pageFiles(APP_ROOT).map(routeForPage).sort();

export async function warmE2ERoutes(request: typeof fetch = fetch): Promise<void> {
  for (const route of E2E_WARM_ROUTES) {
    const response = await request(`${E2E_ORIGIN}${route}`);
    if (!response.ok) {
      throw new Error(`Failed to warm ${route}: HTTP ${response.status}`);
    }
    await response.text();
  }
}

export default async function globalSetup(): Promise<void> {
  await warmE2ERoutes();
}
