"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    liff?: {
      init(opts: { liffId: string }): Promise<void>;
      isLoggedIn(): boolean;
      login(opts?: { redirectUri?: string }): void;
      getIDToken(): string | null;
    };
  }
}

/** LIFFでLINEのユーザーIDを取得して経路を記録し、友だち追加画面へ移動する */
export default function JoinClient({ liffId, code, addUrl }: { liffId: string; code: string; addUrl: string }) {
  const [msg, setMsg] = useState("読み込み中…");
  useEffect(() => {
    const go = () => {
      window.location.href = addUrl;
    };
    const s = document.createElement("script");
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    s.onload = async () => {
      try {
        const liff = window.liff!;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, idToken: liff.getIDToken() }),
        });
      } catch (e) {
        console.error(e);
      }
      go();
    };
    s.onerror = go;
    document.head.appendChild(s);
    const t = setTimeout(() => setMsg("友だち追加画面へ移動します…"), 1500);
    return () => clearTimeout(t);
  }, [liffId, code, addUrl]);
  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <p>{msg}</p>
      <a href={addUrl}>移動しない場合はこちら</a>
    </div>
  );
}
