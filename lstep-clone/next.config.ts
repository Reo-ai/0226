import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // リッチメニュー画像（最大1MB）のアップロード用
    serverActions: { bodySizeLimit: "2mb" },
  },
  // 公式LINEの管理画面などからアイコン画像を読み込めるようにする（公開してよい画像だけ）
  async headers() {
    return [{ source: "/brand/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
