import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  typedRoutes: true,
  reactCompiler: true
  // Note: Turbopack in Next.js 16 has built-in caching enabled by default
  // No additional configuration needed for file system caching

  // IMPORTANT: Security headers cannot be set here for static exports
  // They must be configured at the CDN/hosting level (CloudFront, Netlify, Vercel, etc.)
  // See SECURITY_HEADERS.md for CloudFront configuration instructions
};

export default nextConfig;
