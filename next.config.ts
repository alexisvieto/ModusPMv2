import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mupdf es WASM: no debe pasar por el bundler del servidor.
  serverExternalPackages: ["mupdf"],
  // Sube el logo del tenant (hasta 2 MB) por Server Action; el default es 1 MB.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
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
