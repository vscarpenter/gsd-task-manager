// The journeys that also run against the production static export. Keep this
// list short: the full suite stays on the dev server, and these cover the paths
// where a bundler or CSP difference would cost a user their data.
export const EXPORT_JOURNEYS = [
  "task-crud.spec.ts",
  "drag-and-drop.spec.ts",
  "data-management.spec.ts",
  "settings-navigation.spec.ts",
  "first-time-redirect.spec.ts",
] as const;
