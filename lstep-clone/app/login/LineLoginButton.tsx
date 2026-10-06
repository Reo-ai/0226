"use client";

import { useEffect, useRef, useState } from "react";

const LINE_GREEN = "#06c755";

/** ホーム画面に置いたアプリとして開いているか（iPhone / Android） */
function isStandalone() {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches
  );
}

/**
 * 「公式LINEアカウントでログイン」
 * - 普通のブラウザ：この画面のまま LINE ログインへ
 * - ホーム画面のアプリ：LINE ログインは外のブラウザで開き、この画面は番号を出して完了を待つ
 *   （iPhone はアプリと Safari でログイン状態が別々なので、待っている側でログインを完了させる）
 */
export default function LineLoginButton() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const waiting = useRef(false);
  const poll = async () => {
    try {
      const j = (await (await fetch("/api/auth/line/poll", { cache: "no-store" })).json()) as { state: string; code?: string; next?: string };
      if (j.state === "done" && j.next) window.location.replace(j.next);
      else if (j.state === "waiting") {
        waiting.current = true;
        setCode(j.code ?? null);
      } else if (waiting.current) {
        // 待っている間に、同じ画面（同じログイン状態）の中でログインが済んだ → そのまま開く
        window.location.replace("/dashboard");
      } else setCode(null);
      return j.state;
    } catch {
      return "error";
    }
  };
  const startPolling = () => {
    if (timer.current) return;
    timer.current = setInterval(poll, 2000);
  };

  useEffect(() => {
    // 前に始めたログインが残っていれば、続きを待つ
    void poll().then((s) => s === "waiting" && startPolling());
    const onShow = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function start() {
    setBusy(true);
    try {
      const j = (await (await fetch("/api/auth/line", { method: "POST" })).json()) as { url?: string; error?: string };
      if (!j.url) return alert(j.error ?? "ログインを始められませんでした");
      if (isStandalone()) {
        window.open(j.url, "_blank");
        await poll();
        startPolling();
      } else {
        window.location.href = j.url;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <button onClick={start} disabled={busy} style={{ textAlign: "center", padding: 14, background: LINE_GREEN, borderColor: LINE_GREEN }}>
        公式LINEアカウントでログイン
      </button>
      {code && (
        <div className="panel" style={{ textAlign: "center", margin: 0 }}>
          <div>LINEでのログインを待っています…</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: ".2em", margin: "6px 0" }}>{code}</div>
          <div className="hint">ログイン後に開いた画面にこの番号が出たら「同じなので続ける」を押してください</div>
        </div>
      )}
    </div>
  );
}
