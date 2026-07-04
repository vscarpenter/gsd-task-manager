#!/usr/bin/env node
/**
 * build-openwiki-site.cjs
 *
 * Zero-dependency static site generator for the OpenWiki docs.
 * Converts every Markdown file under /openwiki into a styled, self-contained
 * HTML site written to /openwiki/site.
 *
 * Design goals:
 *   - No external dependencies (matches the repo's other *.cjs build helpers).
 *   - Output is fully self-contained (inline CSS), so pages work both when
 *     opened directly via file:// and when deployed to any static host.
 *   - Light/dark theme toggle, sidebar navigation, and rewritten internal
 *     links (.md -> .html) so the wiki is browsable as a website.
 *
 * Usage:
 *   node scripts/build-openwiki-site.cjs
 *   bun run build:docs
 */

"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const WIKI_DIR = path.join(REPO_ROOT, "openwiki");
const OUT_DIR = path.join(WIKI_DIR, "site");

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/** Recursively collect markdown files under dir (relative to WIKI_DIR). */
function collectMarkdown(dir, rootRel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = rootRel ? `${rootRel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Never descend into the generated output directory.
      if (abs === OUT_DIR) continue;
      out.push(...collectMarkdown(abs, rel));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tiny Markdown -> HTML converter
// Supports: ATX headings, fenced code blocks, GFM tables, unordered/ordered
// lists, blockquotes, horizontal rules, paragraphs, and inline
// (code, bold, italic, links). This is intentionally small and tuned for the
// OpenWiki content, not a general-purpose CommonMark implementation.
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Rewrite an internal link target: foo/bar.md -> foo/bar.html (keep #anchors). */
function rewriteLink(href) {
  if (/^(https?:)?\/\//i.test(href) || href.startsWith("mailto:")) return href;
  const hashIdx = href.indexOf("#");
  const anchor = hashIdx >= 0 ? href.slice(hashIdx) : "";
  let base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  if (base.endsWith(".md")) base = base.slice(0, -3) + ".html";
  return base + anchor;
}

function inline(text) {
  // Protect inline code spans first so their contents are not further parsed.
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });

  text = escapeHtml(text);

  // Links [text](href)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = escapeHtml(rewriteLink(href.trim()));
    return `<a href="${safeHref}">${label}</a>`;
  });

  // Bold then italic.
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  // Restore code spans.
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);

  return text;
}

function renderTable(rows) {
  const splitRow = (r) =>
    r
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const header = splitRow(rows[0]);
  const body = rows.slice(2).map(splitRow); // rows[1] is the --- separator
  let html = "<table>\n<thead>\n<tr>";
  for (const h of header) html += `<th>${inline(h)}</th>`;
  html += "</tr>\n</thead>\n<tbody>\n";
  for (const r of body) {
    html += "<tr>";
    for (let i = 0; i < header.length; i++) html += `<td>${inline(r[i] || "")}</td>`;
    html += "</tr>\n";
  }
  html += "</tbody>\n</table>\n";
  return html;
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const toc = [];
  let html = "";
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      html += `<pre class="code"${lang ? ` data-lang="${lang}"` : ""}><code>${escapeHtml(
        buf.join("\n"),
      )}</code></pre>\n`;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      html += "<hr>\n";
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const textRaw = h[2].trim();
      const id = slugify(textRaw);
      if (level === 2 || level === 3) toc.push({ level, id, text: textRaw });
      html += `<h${level} id="${id}">${inline(textRaw)}</h${level}>\n`;
      i++;
      continue;
    }

    // Table (line looks like a row and next line is a separator)
    if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|.*\|/.test(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      html += renderTable(rows);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html += `<blockquote>${inline(buf.join(" "))}</blockquote>\n`;
      continue;
    }

    // Lists (unordered or ordered)
    const isUl = /^\s*[-*]\s+/.test(line);
    const isOl = /^\s*\d+\.\s+/.test(line);
    if (isUl || isOl) {
      const tag = isUl ? "ul" : "ol";
      const re = isUl ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].replace(re, ""));
        i++;
      }
      html += `<${tag}>\n`;
      for (const it of items) html += `<li>${inline(it)}</li>\n`;
      html += `</${tag}>\n`;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (gather consecutive non-structural lines)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\|.*\|/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    html += `<p>${inline(buf.join(" "))}</p>\n`;
  }

  return { html, toc };
}

// ---------------------------------------------------------------------------
// Page shell (self-contained: inline CSS + theme toggle)
// ---------------------------------------------------------------------------

const STYLES = `
:root {
  --bg: #fbfaf7; --surface: #ffffff; --text: #1f2328; --muted: #57606a;
  --border: #e4e0d8; --accent: #b4531f; --accent-tint: #f6ede6;
  --code-bg: #f3f1ec; --sidebar-bg: #f6f4ef;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --serif: Georgia, "Times New Roman", serif;
}
:root[data-theme="dark"] {
  --bg: #16181c; --surface: #1c1f24; --text: #e6e6e3; --muted: #9aa0a6;
  --border: #2c3038; --accent: #e08a4f; --accent-tint: #2a211a;
  --code-bg: #23262c; --sidebar-bg: #191c21;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0; font-family: var(--sans); color: var(--text); background: var(--bg);
  line-height: 1.65; font-size: 16px;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
aside {
  background: var(--sidebar-bg); border-right: 1px solid var(--border);
  padding: 24px 20px; position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
aside .brand { font-family: var(--serif); font-size: 20px; font-weight: 600; margin: 0 0 4px; }
aside .brand a { color: var(--text); }
aside .sub { color: var(--muted); font-size: 12px; margin: 0 0 20px; font-family: var(--mono); }
aside nav .group { margin-bottom: 18px; }
aside nav .group-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--muted); font-weight: 600; margin: 0 0 8px;
}
aside nav a {
  display: block; padding: 5px 10px; border-radius: 6px; color: var(--text);
  font-size: 14px; margin-bottom: 2px;
}
aside nav a:hover { background: var(--accent-tint); text-decoration: none; }
aside nav a.active { background: var(--accent-tint); color: var(--accent); font-weight: 600; }
main { padding: 40px 48px 80px; max-width: 900px; }
.topbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.theme-toggle {
  font-family: var(--mono); font-size: 12px; padding: 6px 12px; cursor: pointer;
  background: var(--surface); border: 1px solid var(--border); border-radius: 999px;
  color: var(--muted);
}
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }
article h1 { font-family: var(--serif); font-size: 34px; line-height: 1.2; margin: 8px 0 24px; letter-spacing: -0.01em; }
article h2 { font-family: var(--serif); font-size: 24px; margin: 40px 0 12px; padding-top: 8px; border-top: 1px solid var(--border); }
article h3 { font-size: 18px; margin: 28px 0 10px; }
article h4 { font-size: 15px; margin: 20px 0 8px; }
article p { margin: 0 0 16px; }
article ul, article ol { margin: 0 0 16px; padding-left: 24px; }
article li { margin-bottom: 6px; }
article code {
  font-family: var(--mono); font-size: 0.86em; background: var(--code-bg);
  padding: 2px 6px; border-radius: 4px;
}
article pre.code {
  background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px 18px; overflow-x: auto; margin: 0 0 20px; position: relative;
}
article pre.code code { background: none; padding: 0; font-size: 13px; line-height: 1.55; }
article pre.code[data-lang]::before {
  content: attr(data-lang); position: absolute; top: 8px; right: 12px;
  font-family: var(--mono); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted);
}
article blockquote {
  margin: 0 0 16px; padding: 8px 16px; border-left: 3px solid var(--accent);
  background: var(--accent-tint); color: var(--muted); border-radius: 0 6px 6px 0;
}
article table { border-collapse: collapse; width: 100%; margin: 0 0 20px; font-size: 14px; }
article th, article td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; vertical-align: top; }
article th { background: var(--code-bg); font-weight: 600; }
article hr { border: none; border-top: 1px solid var(--border); margin: 28px 0; }
.page-nav {
  display: flex; justify-content: space-between; gap: 12px; margin-top: 48px;
  padding-top: 20px; border-top: 1px solid var(--border);
}
.page-nav a { font-size: 14px; }
.footer-note { margin-top: 40px; color: var(--muted); font-size: 12px; font-family: var(--mono); }
@media (max-width: 820px) {
  .layout { grid-template-columns: 1fr; }
  aside { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
  main { padding: 24px 20px 60px; }
}
`;

const THEME_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('openwiki-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  var next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('openwiki-theme', next); } catch (e) {}
}
`;

/** Relative prefix (../) to reach site root from a page at the given depth. */
function relPrefix(relPath) {
  const depth = relPath.split("/").length - 1;
  return depth === 0 ? "" : "../".repeat(depth);
}

/** Title-case a section directory name for the sidebar. */
function humanize(name) {
  return name
    .replace(/\.html$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSidebar(pages, currentRel, prefix) {
  // Group by top-level directory; root files first.
  const groups = new Map();
  for (const p of pages) {
    const parts = p.split("/");
    const group = parts.length > 1 ? parts[0] : "";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(p);
  }

  const order = ["", "architecture", "workflows", "operations", "testing", "integrations", "domain", "api"];
  const groupKeys = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a) === -1 ? 999 : order.indexOf(a);
    const ib = order.indexOf(b) === -1 ? 999 : order.indexOf(b);
    return ia - ib || a.localeCompare(b);
  });

  let nav = "";
  for (const g of groupKeys) {
    const items = groups.get(g).sort((a, b) => {
      // quickstart always first within root group
      if (a.endsWith("quickstart.md")) return -1;
      if (b.endsWith("quickstart.md")) return 1;
      return a.localeCompare(b);
    });
    nav += `<div class="group">`;
    if (g) nav += `<p class="group-title">${humanize(g)}</p>`;
    for (const p of items) {
      const href = prefix + p.replace(/\.md$/, ".html");
      const label = humanize(p.split("/").pop());
      const cls = p === currentRel ? ' class="active"' : "";
      nav += `<a href="${href}"${cls}>${label}</a>`;
    }
    nav += `</div>`;
  }
  return nav;
}

function renderPage({ title, bodyHtml, sidebar, prefix, prevNext, generatedAt }) {
  const prev = prevNext.prev
    ? `<a href="${prefix + prevNext.prev.href}">&larr; ${escapeHtml(prevNext.prev.label)}</a>`
    : "<span></span>";
  const next = prevNext.next
    ? `<a href="${prefix + prevNext.next.href}">${escapeHtml(prevNext.next.label)} &rarr;</a>`
    : "<span></span>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — GSD OpenWiki</title>
<script>${THEME_SCRIPT}</script>
<style>${STYLES}</style>
</head>
<body>
<div class="layout">
<aside>
  <p class="brand"><a href="${prefix}quickstart.html">GSD OpenWiki</a></p>
  <p class="sub">gsd-taskmanager docs</p>
  <nav>${sidebar}</nav>
</aside>
<main>
  <div class="topbar">
    <button class="theme-toggle" onclick="toggleTheme()">Toggle theme</button>
  </div>
  <article>${bodyHtml}</article>
  <div class="page-nav">${prev}${next}</div>
  <p class="footer-note">Generated from /openwiki Markdown by scripts/build-openwiki-site.cjs on ${generatedAt}. Do not edit generated HTML — edit the Markdown source.</p>
</main>
</div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function main() {
  if (!fs.existsSync(WIKI_DIR)) {
    console.error(`[openwiki] No /openwiki directory found at ${WIKI_DIR}`);
    process.exit(1);
  }

  const pages = collectMarkdown(WIKI_DIR).sort();
  if (pages.length === 0) {
    console.error("[openwiki] No markdown files found under /openwiki");
    process.exit(1);
  }

  // Order pages for prev/next: quickstart first, then the rest alphabetically.
  const ordered = [...pages].sort((a, b) => {
    if (a.endsWith("quickstart.md")) return -1;
    if (b.endsWith("quickstart.md")) return 1;
    return a.localeCompare(b);
  });

  rmrf(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString().slice(0, 10);

  ordered.forEach((rel, idx) => {
    const src = fs.readFileSync(path.join(WIKI_DIR, rel), "utf8");
    const { html } = markdownToHtml(src);

    // Derive a page title from the first H1, else the filename.
    const h1 = src.match(/^#\s+(.+)$/m);
    const title = h1 ? h1[1].replace(/`/g, "").trim() : humanize(rel.split("/").pop());

    const prefix = relPrefix(rel);
    const sidebar = buildSidebar(pages, rel, prefix);

    const prevPage = ordered[idx - 1];
    const nextPage = ordered[idx + 1];
    const mkNav = (p) =>
      p
        ? {
            href: p.replace(/\.md$/, ".html"),
            label: humanize(p.split("/").pop()),
          }
        : null;

    const outHtml = renderPage({
      title,
      bodyHtml: html,
      sidebar,
      prefix,
      prevNext: { prev: mkNav(prevPage), next: mkNav(nextPage) },
      generatedAt,
    });

    const outPath = path.join(OUT_DIR, rel.replace(/\.md$/, ".html"));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, outHtml, "utf8");
  });

  // index.html -> quickstart for convenience.
  const quickstart = ordered.find((p) => p.endsWith("quickstart.md"));
  if (quickstart) {
    const target = quickstart.replace(/\.md$/, ".html");
    fs.writeFileSync(
      path.join(OUT_DIR, "index.html"),
      `<!DOCTYPE html><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}"><a href="${target}">Open OpenWiki</a>`,
      "utf8",
    );
  }

  console.log(`[openwiki] Rendered ${ordered.length} page(s) to ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  console.log(`[openwiki] Open ${path.relative(REPO_ROOT, path.join(OUT_DIR, "index.html"))} in a browser.`);
}

main();
