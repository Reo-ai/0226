import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "スキルステップ",
  // iPhone のホーム画面に置いたとき、アプリのように開く
  appleWebApp: { capable: true, title: "スキルステップ", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1f2a37", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
