import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: Local Windows builds may fail due to Turbopack symlink issues
  // Build works correctly on Vercel (Linux environment)
};

export default nextConfig;
