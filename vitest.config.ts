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
    coverage: {
      enabled: true,
      reporter: ["text", "lcov", "html"],
      provider: "v8",
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.config.ts", "**/types.ts"],
      all: true,
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
