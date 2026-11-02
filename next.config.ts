import type { NextConfig } from "next";
const config: NextConfig = {
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID,
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "sharp$": false, "onnxruntime-node$": false };
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
  async rewrites() {
    const origin = process.env.API_ORIGIN || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : null);
    return origin ? [{ source: "/api/:path*", destination: `${origin}/api/:path*` }] : [];
  },
};
export default config;
