#!/usr/bin/env node

/**
 * Generates public/sw-cache-logic.js from lib/sw-cache-logic.ts.
 *
 * The service worker loads the JS copy with importScripts(), which runs a
 * classic script, so the output strips `export` and leaves every function a
 * global. A module.exports footer lets tests require() the same file.
 * tests/data/sw-cache-logic-generated.test.ts fails when the committed copy
 * drifts from this output, so the build never has to write it.
 *
 * Usage: node scripts/generate-sw-cache-logic.cjs
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SOURCE = path.join(__dirname, '..', 'lib', 'sw-cache-logic.ts');
const TARGET = path.join(__dirname, '..', 'public', 'sw-cache-logic.js');

const HEADER = [
  '// GENERATED FILE. Do not edit by hand.',
  '// Source: lib/sw-cache-logic.ts. Regenerate with: node scripts/generate-sw-cache-logic.cjs',
  '// Loaded via importScripts() in sw.js, so its functions land on global scope.',
  '',
].join('\n');

function isExported(statement) {
  return (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !== 0;
}

// Names of the exported functions and constants, in source order, for the footer.
function exportedValueNames(typescriptSource) {
  const file = ts.createSourceFile('sw-cache-logic.ts', typescriptSource, ts.ScriptTarget.Latest);
  return file.statements.filter(isExported).flatMap((statement) => {
    if (ts.isFunctionDeclaration(statement) && statement.name) return [statement.name.text];
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) => declaration.name.getText(file));
    }
    return [];
  });
}

function moduleExportsFooter(names) {
  const lines = names.map((name) => `        ${name},`).join('\n');
  return `\nif (typeof module !== "undefined" && module.exports) {\n    module.exports = {\n${lines}\n    };\n}\n`;
}

// The TypeScript printer drops blank lines; put one before each top-level
// declaration (or the doc comment that opens it) so the copy stays readable.
function spaceTopLevelDeclarations(code) {
  return code.replace(/\n(?=\/\*\*)|(?<!\*\/)\n(?=(?:function|const) )/g, '\n\n');
}

// The source's own header comment speaks for the .ts file, so drop it while
// the blank line that ends it is still there.
function withoutLeadingHeader(typescriptSource) {
  return typescriptSource.replace(/^(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\n)+\n/, '');
}

function generateSwCacheLogic(typescriptSource) {
  const { outputText } = ts.transpileModule(withoutLeadingHeader(typescriptSource), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    fileName: 'sw-cache-logic.ts',
  });
  const globals = outputText.replace(/^export (?=(?:async )?function |const )/gm, '').trim();
  // importScripts() runs a classic script, where any export left behind is a
  // SyntaxError that stops the worker from installing. Fail here instead.
  const leftover = globals.match(/^export\b.*$/m);
  if (leftover) {
    throw new Error(`Unsupported export form for importScripts(): ${leftover[0]}`);
  }
  const body = spaceTopLevelDeclarations(globals);
  return `${HEADER}\n${body}\n${moduleExportsFooter(exportedValueNames(typescriptSource))}`;
}

module.exports = { generateSwCacheLogic };

if (require.main === module) {
  fs.writeFileSync(TARGET, generateSwCacheLogic(fs.readFileSync(SOURCE, 'utf8')));
  console.log(`Generated ${path.relative(process.cwd(), TARGET)} from ${path.relative(process.cwd(), SOURCE)}`);
}
