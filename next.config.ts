import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Real builds pin this via scripts/generate-build-info.cjs -> .build-env.sh, so the
// fallback only ever applies to `next dev`. It must not read the clock: the dev
// server inlines this value into both the prerendered markup and the client
// chunk, and those two are compiled at different moments — spanning a UTC
// midnight (or reusing a cached render from a previous day) made them disagree
// and React reported a hydration mismatch on every load.
const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "dev";
const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? pkg.version;

const nextConfig: NextConfig = {
  output: "export",
  // Pin the workspace root so Turbopack stops inferring it from stray lockfiles
  // (e.g. ~/bun.lock) higher up the tree.
  turbopack: { root: __dirname },
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  typedRoutes: true,
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  }

  // IMPORTANT: Security headers cannot be set here for static exports
  // They must be configured at the CDN/hosting level (CloudFront, Netlify, Vercel, etc.)
  // See SECURITY_HEADERS.md for CloudFront configuration instructions
};

export default nextConfig;
