import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
