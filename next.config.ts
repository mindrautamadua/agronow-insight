import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mysql2 is a server-only package; keep it external so Next doesn't bundle it.
  serverExternalPackages: ["mysql2"],
  async headers() {
    return [
      {
        // Service worker harus selalu fresh & ber-MIME JS yang benar.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
