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
};

export default nextConfig;
