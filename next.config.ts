import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  // Keep the development overlay from covering the atlas's bottom-left disclosure.
  devIndicators: false,
  ...(distDir ? { distDir } : {}),
  allowedDevOrigins: [
    "127.0.0.1",
    "172.23.117.103",
  ],
};

export default nextConfig;
