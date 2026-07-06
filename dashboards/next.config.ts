import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only set when building for the combined Render deployment (see
  // backend/server), where this app is mounted at /dashboard behind the
  // Express server alongside the marketing frontend. Standalone `next dev`
  // (this repo's normal local workflow) leaves NEXT_BASE_PATH unset so it
  // keeps serving at the root as before.
  basePath: process.env.NEXT_BASE_PATH || undefined,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  async rewrites() {
    // Standalone `next dev` has no Express server in front of it to own
    // /api - proxy straight to backend/server so callApi() (lib/api.ts)
    // doesn't 404 locally. Skipped in the combined Render build
    // (NEXT_BASE_PATH set) since Express already owns /api there.
    if (process.env.NEXT_BASE_PATH) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
