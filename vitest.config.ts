import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/worktrees/**",
      "**/packages/mcp-server/**"
    ],
    coverage: {
      enabled: false, // Only enable when --coverage flag is passed
      reporter: ["text", "lcov", "html", "json-summary"],
      provider: "v8",
      include: [
        "lib/**/*.ts",
        "components/**/*.tsx",
        "app/**/*.ts",
        "app/**/*.tsx",
        "scripts/**/*.ts",
        "scripts/**/*.js"
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.config.ts",
        "**/types.ts",
        "**/index.ts",          // re-export barrels (no logic)
        "lib/sync/engine.ts",   // re-export barrel
        "lib/sync/config.ts",   // re-export barrel
        "lib/tasks/crud.ts",    // re-export barrel
        "components/ui/**",     // shadcn/ui wrappers (third-party abstractions)
      ],
      reportOnFailure: true, // Generate coverage report even if tests fail
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 75
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
