# CLI

## Overview

This directory parses the command-line flags and holds the interactive setup wizard and the configuration validator. The wizard writes a Claude Desktop configuration snippet, which contains the auth token, to an owner-only file in the home directory.

## Interface

Flags and prompts (`index.ts`):

- `parseCLIArgs(args)`: returns a mode of `setup`, `validate`, `help`, or `mcp`.
- Flags parsed: `--setup`, `--validate`, `--help`, and `-h`. No flag means MCP server mode. There are no subcommands.
- `CLIOptions`: `{ mode: 'mcp' | 'setup' | 'validate' | 'help' }`.
- `showHelp()`: prints usage, options, the two environment variables, config paths, and the version.
- `getClaudeConfigPath()`: returns the `claude_desktop_config.json` path for macOS, Windows, or other platforms.
- `prompt(question, defaultValue?)`: asks one readline question and returns the trimmed answer or the default.
- `promptPassword(question)`: reads input without echo in TTY raw mode. It falls back to a line read when stdin is not a TTY.

Setup artifact (`setup-artifact.ts`):

- `getSetupArtifactPath()`: returns `.gsd-mcp-setup.json` in the home directory.
- `removeSetupArtifact()`: deletes the artifact if it exists. It returns true if it removed the file, and it does not throw.

Setup wizard (`setup-wizard.ts`):

- `runSetupWizard()`: runs four steps: PocketBase URL, auth token, generated config file, and next steps.

Validation (`validation.ts`):

- `runValidation()`: checks the environment variables, the URL policy, `/api/health`, authentication, and task access, then prints the results.
- `ValidationCheck`: `{name, status, details}`.

## Invariants

- `index.ts:parseCLIArgs`: `--setup` wins over `--validate`, which wins over `--help` and `-h`.
- `index.ts:promptPassword`: the TTY path does not echo typed characters to stdout.
- `index.ts:promptPassword`: Enter or Ctrl-D ends input. Ctrl-C exits with code 130.
- `setup-wizard.ts:runSetupWizard`: the URL passes `isSafePocketBaseUrl` before any request. An unsafe URL exits with code 1.
- `setup-wizard.ts:resolveDefaultPocketBaseUrl`: an inherited `GSD_POCKETBASE_URL` is offered only if it is safe. Otherwise the default is `https://api.vinny.io`.
- `setup-wizard.ts:configureAuthentication`: an empty token exits with code 1. A `getSyncStatus` result with `healthy` false also exits with code 1.
- `setup-wizard.ts:writeConfigurationFile`: the file is written with mode `0o600`. The token is not printed to stdout.
- `setup-wizard.ts:displayConfiguration`: the preview shows a redacted host and a redacted token.
- `setup-wizard.ts:MCP_ENTRYPOINT`: the generated config points at this package's own `index.js`, not at a copy that npm selects.
- `setup-wizard.ts:runSetupWizard`: it removes a stale artifact before prompting, and removes it again on any error.
- `validation.ts:validateEnvironmentVariables`: `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` are required. A missing one exits with code 1.
- `validation.ts:runValidation`: an unsafe URL exits with code 1 before any request, so that host does not receive the token.
- `validation.ts:displayOverallStatus`: any failed check exits with code 1. Warnings alone do not.

## Side Effects

- `index.ts:showHelp`: writes help text to stdout.
- `index.ts:prompt` and `promptPassword`: read from stdin and write to stdout. `promptPassword` toggles stdin raw mode.
- `index.ts:getClaudeConfigPath`: reads `process.env.APPDATA` on Windows.
- `setup-artifact.ts:removeSetupArtifact`: deletes `~/.gsd-mcp-setup.json`.
- `setup-wizard.ts:writeConfigurationFile`: writes `~/.gsd-mcp-setup.json` with the plaintext `GSD_AUTH_TOKEN` and `process.execPath`.
- `setup-wizard.ts:resolveDefaultPocketBaseUrl`: reads `process.env.GSD_POCKETBASE_URL`.
- `setup-wizard.ts:validateConnectivity` and `validation.ts:validatePBConnection`: send a GET to `/api/health` on the PocketBase URL.
- `setup-wizard.ts:configureAuthentication` and `testTaskAccess`: call `getSyncStatus` and `listTasks` from `../tools.ts` with the token.
- `validation.ts:validateEnvironmentVariables`: reads `process.env.GSD_POCKETBASE_URL` and `process.env.GSD_AUTH_TOKEN`.
- `validation.ts:validateAuthentication` and `validateTaskAccess`: call `getSyncStatus` and `listTasks` from `../tools.ts`.
- `setup-wizard.ts:runSetupWizard` and `validation.ts:runValidation`: write to stdout and can call `process.exit(1)`.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
