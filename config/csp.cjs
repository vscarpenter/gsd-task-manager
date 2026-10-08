// The one definition of the app's Content-Security-Policy. The static export
// test server serves buildCsp("cloudfront") directly. The CloudFront policy JSON
// and docker/Caddyfile ship as they are, so each keeps a copy.
// tests/data/csp-single-source.test.ts fails when either copy drifts.

const TARGETS = ["cloudfront", "selfhost"];
const OAUTH_ORIGINS = ["https://accounts.google.com", "https://github.com"];

// Directive order is part of the contract: the copies match it byte for byte.
// `extra` lists sources only one target allows. The self-host image serves the
// API from its own origin, so 'self' already covers it. §7 of the modernization
// brief tracks font-src data:, worker-src blob:, and the Google and GitHub
// connect-src entries as possible drift; they stay until the owner decides.
const DIRECTIVES = [
  { name: "default-src", sources: ["'self'"] },
  { name: "script-src", sources: ["'self'"] },
  { name: "script-src-attr", sources: ["'none'"] },
  { name: "style-src", sources: ["'self'"] },
  { name: "style-src-elem", sources: ["'self'", "'unsafe-inline'"] },
  { name: "style-src-attr", sources: ["'unsafe-inline'"] },
  { name: "img-src", sources: ["'self'", "data:", "blob:"] },
  { name: "font-src", sources: ["'self'"], extra: { cloudfront: ["data:"] } },
  {
    name: "connect-src",
    sources: ["'self'"],
    extra: { cloudfront: ["https://api.vinny.io", ...OAUTH_ORIGINS] },
  },
  { name: "frame-ancestors", sources: ["'none'"] },
  { name: "base-uri", sources: ["'none'"] },
  { name: "form-action", sources: ["'self'", ...OAUTH_ORIGINS] },
  { name: "object-src", sources: ["'none'"] },
  { name: "manifest-src", sources: ["'self'"] },
  { name: "worker-src", sources: ["'self'"], extra: { cloudfront: ["blob:"] } },
];

function buildCsp(target) {
  if (!TARGETS.includes(target)) {
    throw new Error(`Unknown CSP target "${target}". Use one of: ${TARGETS.join(", ")}.`);
  }
  return DIRECTIVES.map(({ name, sources, extra }) => {
    const allowed = [...sources, ...(extra?.[target] ?? [])];
    return `${name} ${allowed.join(" ")};`;
  }).join(" ");
}

module.exports = { buildCsp };
