import type { MetadataRoute } from "next";

// スマホのホーム画面に置いたとき、アプリのように全画面で開く
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "スキルステップ",
    short_name: "スキルステップ",
    description: "公式LINEの配信・返信をスマホで",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#1f2a37",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
