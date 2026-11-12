# tools

## Overview

This directory groups developer tools that are not part of the app bundle. It has no source files of its own.

## Subdirectories & Boundaries

- stagehand: [./stagehand/README.md](./stagehand/README.md) - Browser verification with Stagehand. `verify.ts` checks one goal, `smoke.ts` runs six journeys, and both write evidence under `tools/stagehand/evidence/`. They call the model API with `ANTHROPIC_API_KEY`.
