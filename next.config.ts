import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // ensure Turbopack uses this repo as the workspace root (avoid wrong root detection)
    root: process.cwd(),
  },
  async headers() {
    // Allow Cursor/VS Code Simple Browser (iframe) in local/dev; keep DENY in prod.
    const frameHeaders =
      process.env.NODE_ENV === "production"
        ? [{ key: "X-Frame-Options", value: "DENY" }]
        : [
            {
              key: "Content-Security-Policy",
              value:
                "frame-ancestors 'self' vscode-webview: vscode-file: http://localhost:* http://127.0.0.1:*",
            },
          ];

    return [
      {
        source: "/:path*",
        headers: [
          ...frameHeaders,
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
