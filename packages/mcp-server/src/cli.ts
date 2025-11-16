/**
 * CLI utilities for interactive setup and validation
 * Re-exports modular CLI components for backward compatibility
 */

export type { CLIOptions } from './cli/index.js';
export type { ValidationCheck } from './cli/validation.js';

export {
  parseCLIArgs,
  showHelp,
  getClaudeConfigPath,
  createReadline,
  prompt,
  promptPassword,
} from './cli/index.js';

export { runSetupWizard } from './cli/setup-wizard.js';
export { runValidation } from './cli/validation.js';
