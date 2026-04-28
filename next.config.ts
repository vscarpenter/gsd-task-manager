import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? pkg.version;

const nextConfig: NextConfig = {
  output: "export",
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
