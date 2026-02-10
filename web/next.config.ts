import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: false,
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
