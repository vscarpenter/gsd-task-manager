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
};

export default nextConfig;
