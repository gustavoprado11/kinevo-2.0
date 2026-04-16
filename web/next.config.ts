import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kinevo/shared"],
  reactCompiler: true,
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lylksbtgrihzepbteest.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    // `unsafe-eval` is only needed by Next's dev/Turbopack runtime. Dropping it
    // in production closes a large XSS escalation path. `unsafe-inline` on
    // script-src is still required because Next emits inline hydration scripts;
    // migrating to nonce-based CSP is tracked as a separate follow-up.
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=(self)",
              "usb=()",
              "bluetooth=()",
              "accelerometer=()",
              "gyroscope=()",
              "magnetometer=()",
              "interest-cohort=()",
            ].join(", "),
          },
          {
            // same-origin-allow-popups keeps Stripe Checkout popups working
            // while still isolating our window from cross-origin tabs.
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' fonts.gstatic.com",
              "img-src 'self' data: blob: lylksbtgrihzepbteest.supabase.co",
              "media-src 'self' blob: lylksbtgrihzepbteest.supabase.co",
              "connect-src 'self' https://lylksbtgrihzepbteest.supabase.co wss://lylksbtgrihzepbteest.supabase.co https://api.openai.com https://api.stripe.com https://m.stripe.com",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://checkout.stripe.com https://js.stripe.com https://hooks.stripe.com https://dashboard.stripe.com",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        // API responses should never be cached by intermediaries — they
        // contain per-trainer data and the cookie-auth responses from Supabase
        // vary by user.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
