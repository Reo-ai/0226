import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "LINE配信管理" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
