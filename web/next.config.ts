import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kinevo/shared"],
  reactCompiler: false,
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
