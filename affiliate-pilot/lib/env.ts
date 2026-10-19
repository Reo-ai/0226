import { headers } from "next/headers";

/** 計測リンクなどに使う公開URL。APP_BASE_URL があればそれ、なければアクセス中のホスト */
export async function appBaseUrl(): Promise<string> {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
