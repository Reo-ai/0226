import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // リッチメニュー画像（最大1MB）のアップロード用
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
