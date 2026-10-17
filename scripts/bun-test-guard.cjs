// Bun loads this before any test file (see bunfig.toml). Without it, Bun's runner
// skips the jsdom environment and setup file and reports about 1,650 false failures.
console.error(
  "bun test starts Bun's built-in runner, and this repo's tests are written for Vitest.\n" +
    "Run them with: bun run test"
);
process.exit(1);
