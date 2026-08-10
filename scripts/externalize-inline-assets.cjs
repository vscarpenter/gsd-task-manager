#!/usr/bin/env node

const { createHash } = require("node:crypto");
const {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} = require("node:fs");
const { join, resolve } = require("node:path");

const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const STYLE_PATTERN = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;

function htmlFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

function contentHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 24);
}

function quotedAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function isExecutableScript(attributes, body) {
  if (!body.trim() || /\bsrc\s*=/i.test(attributes)) return false;
  const type = quotedAttribute(attributes, "type");
  if (!type) return true;
  return /^(?:module|text\/javascript|application\/javascript)$/i.test(type);
}

function externalizeInlineAssets(outputDirectory) {
  const outputRoot = resolve(outputDirectory);
  const assetDirectory = join(outputRoot, "_next", "static", "csp-inline");
  mkdirSync(assetDirectory, { recursive: true });
  let executableScripts = 0;
  let styleBlocks = 0;

  for (const htmlPath of htmlFiles(outputRoot)) {
    let html = readFileSync(htmlPath, "utf8");
    html = html.replace(SCRIPT_PATTERN, (source, attributes, body) => {
      if (!isExecutableScript(attributes, body)) return source;
      const hash = contentHash(body);
      writeFileSync(join(assetDirectory, `${hash}.js`), `${body}\n`);
      executableScripts += 1;
      return `<script${attributes} src="/_next/static/csp-inline/${hash}.js"></script>`;
    });
    html = html.replace(STYLE_PATTERN, (_source, attributes, body) => {
      if (!body.trim()) return "";
      const hash = contentHash(body);
      const media = quotedAttribute(attributes, "media");
      writeFileSync(join(assetDirectory, `${hash}.css`), `${body}\n`);
      styleBlocks += 1;
      return `<link rel="stylesheet" href="/_next/static/csp-inline/${hash}.css"${media ? ` media="${media}"` : ""}>`;
    });
    writeFileSync(htmlPath, html);
  }

  return { executableScripts, styleBlocks };
}

if (require.main === module) {
  const outputDirectory = process.argv[2] ?? "out";
  const result = externalizeInlineAssets(outputDirectory);
  process.stdout.write(
    `Externalized ${result.executableScripts} executable script blocks and ${result.styleBlocks} style blocks.\n`,
  );
}

module.exports = { externalizeInlineAssets, isExecutableScript };
