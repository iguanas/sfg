import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: Use `npm run build` (webpack) for Windows compatibility
  // Turbopack has symlink issues on Windows without admin privileges
  // Use `npm run build:turbo` for Turbopack builds on Linux/Vercel
};

export default nextConfig;
