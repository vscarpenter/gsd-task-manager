#!/usr/bin/env node

const { createServer } = require("node:http");
const { existsSync, readFileSync, statSync } = require("node:fs");
const { extname, join, resolve, sep } = require("node:path");
const { handler: rewriteLikeCloudFront } = require("../../cloudfront-function-url-rewrite.cjs");

const DEFAULT_PORT = 3100;
const HOST = "127.0.0.1";
const POLICY_PATH = join(__dirname, "../../cloudfront/response-headers-policy.json");
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function readProductionCsp() {
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  return policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
}

function toCloudFrontHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), { value: String(value) }])
  );
}

// Routing runs through the deployed viewer-request function, so a rewrite rule
// cannot change in production without changing here. Production also answers
// every unknown path with the app shell and a 200, missing chunks included, so
// the fallback below matches it. A missing chunk still fails a journey: HTML
// parsed as JavaScript throws a page error.
function resolveExportFile(outputRoot, requestUrl, headers) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const { uri } = rewriteLikeCloudFront({
    request: { uri: pathname, headers: toCloudFrontHeaders(headers) },
  });
  const target = resolve(outputRoot, `.${uri}`);
  const isInsideRoot = target.startsWith(outputRoot + sep);
  if (!isInsideRoot || !existsSync(target) || !statSync(target).isFile()) {
    return join(outputRoot, "index.html");
  }
  return target;
}

function startStaticExportServer({ outputRoot = resolve("out"), port = 0, csp } = {}) {
  if (!existsSync(join(outputRoot, "index.html"))) {
    return Promise.reject(
      new Error(`No static export at ${outputRoot}. Run \`bun run build\` first.`)
    );
  }

  const server = createServer((request, response) => {
    const target = resolveExportFile(outputRoot, request.url ?? "/", request.headers);
    const headers = {
      "Content-Type": CONTENT_TYPES[extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    };
    if (csp) headers["Content-Security-Policy"] = csp;
    response.writeHead(200, headers);
    response.end(readFileSync(target));
  });

  return new Promise((resolveStart, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(port, HOST, () => {
      resolveStart({ server, rootUrl: `http://${HOST}:${server.address().port}` });
    });
  });
}

if (require.main === module) {
  startStaticExportServer({
    port: Number(process.env.PORT ?? DEFAULT_PORT),
    csp: readProductionCsp(),
  })
    .then(({ rootUrl }) => {
      process.stdout.write(`Serving out/ at ${rootUrl} under the production CSP.\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exitCode = 1;
    });
}

module.exports = { readProductionCsp, resolveExportFile, startStaticExportServer };
