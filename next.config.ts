import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack to avoid Windows symlink issues
  experimental: {
    // Use webpack instead of Turbopack
  },
};

export default nextConfig;
