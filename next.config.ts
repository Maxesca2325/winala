import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// `npm run build:pages` → static export for GitHub Pages (no server needed: data lives in Supabase).
const STATIC_EXPORT = process.env.STATIC_EXPORT === "1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(STATIC_EXPORT && {
    output: "export",
    basePath: BASE_PATH,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
  // The site is fully static: all data and rules live in Supabase and are read
  // from the browser with the publishable key. Same build on any static host.
  poweredByHeader: false,
  experimental: {
    // Unstable 3G/4G: failed navigations and server actions wait and retry
    // when the network comes back instead of throwing.
    useOffline: true,
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    if (STATIC_EXPORT) return [];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
