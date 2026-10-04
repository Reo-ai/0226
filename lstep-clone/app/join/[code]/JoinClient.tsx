"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    liff?: {
      init(opts: { liffId: string }): Promise<void>;
      isLoggedIn(): boolean;
      getIDToken(): string | null;
      getAccessToken(): string | null;
    };
  }
}

/** 何があってもこの時間で LINE の友だち追加へ移動する（待たせると離脱するため） */
const MAX_WAIT_MS = 2000;

/**
 * 流入経路の記録 → 友だち追加画面へ。速さ優先：
 * - 記録は送るだけで、終わるのを待たない（sendBeacon）
 * - LINEアプリの中なら LIFF でだれかを特定、外のブラウザではログインを挟まずにすぐ移動
 * code が null のときは URL の liff.state（/habit など）から経路を読む
 */
export default function JoinClient({ liffId, code: fixedCode, addUrl }: { liffId: string; code: string | null; addUrl: string }) {
  useEffect(() => {
    let moved = false;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("liff.state") ?? "";
    const code = fixedCode ?? state.split("?")[0].replace(/^\/+/, "").split("/")[0];
    const w = params.get("w") ?? new URLSearchParams(state.split("?")[1] ?? "").get("w");
    const send = (body: Record<string, unknown>) => {
      if (!/^[\w-]+$/.test(code)) return;
      const url = w ? `/api/join?w=${encodeURIComponent(w)}` : "/api/join";
      const data = JSON.stringify({ code, ...body });
      if (!navigator.sendBeacon?.(url, new Blob([data], { type: "application/json" }))) {
        void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: data, keepalive: true });
      }
    };
    const go = () => {
      if (moved) return;
      moved = true;
      window.location.replace(addUrl);
    };
    const timer = setTimeout(() => {
      send({}); // 間に合わなかった：だれか分からないまま記録して移動
      go();
    }, MAX_WAIT_MS);

    const s = document.createElement("script");
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    s.onload = async () => {
      try {
        const liff = window.liff!;
        await liff.init({ liffId });
        if (moved) return;
        // ログイン済み（LINEアプリの中）ならだれか分かる。外のブラウザはログインを挟まない
        send(liff.isLoggedIn() ? { idToken: liff.getIDToken(), accessToken: liff.getAccessToken() } : {});
      } catch {
        if (!moved) send({});
      }
      clearTimeout(timer);
      go();
    };
    s.onerror = () => {
      clearTimeout(timer);
      send({});
      go();
    };
    document.head.appendChild(s);
    return () => clearTimeout(timer);
  }, [liffId, fixedCode, addUrl]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#06c755", color: "#fff", textAlign: "center" }}>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>LINEをひらいています…</p>
        <a href={addUrl} style={{ display: "inline-block", background: "#fff", color: "#06c755", fontWeight: 700, padding: "14px 28px", borderRadius: 999, textDecoration: "none" }}>
          LINEで友だち追加
        </a>
      </div>
    </div>
  );
}
