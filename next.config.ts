import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers de seguridad para todas las rutas (A-05 del security review).
  // Sin CSP por ahora: requiere afinarse para Next (inline) + recharts + la
  // inyección white-label; se deja para post-demo.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
