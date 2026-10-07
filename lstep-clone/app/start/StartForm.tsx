"use client";

import { useActionState, useRef } from "react";
import { claimWorkspaceAction } from "@/lib/actions";

/** コピーした文字から Channel ID（数字）と Channel secret（32文字）を拾う */
function pick(text: string) {
  return { id: text.match(/\b\d{8,12}\b/)?.[0], secret: text.match(/\b[0-9a-f]{32}\b/i)?.[0] };
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="step">
      <div className="step-n">{n}</div>
      <div className="step-body">
        <div className="step-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** 公式LINEの鍵を、手順どおりにコピー＆貼り付けしてもらう */
export default function StartForm() {
  const [error, action, pending] = useActionState(claimWorkspaceAction, null);
  const idRef = useRef<HTMLInputElement>(null);
  const secretRef = useRef<HTMLInputElement>(null);
  const paste = async (target: "id" | "secret") => {
    try {
      const text = await navigator.clipboard.readText();
      const p = pick(text);
      if (p.id && idRef.current && (target === "id" || !idRef.current.value)) idRef.current.value = p.id;
      if (p.secret && secretRef.current && (target === "secret" || !secretRef.current.value)) secretRef.current.value = p.secret;
      if (!p.id && !p.secret) (target === "id" ? idRef : secretRef).current!.value = text.trim();
    } catch {
      alert("貼り付けできませんでした。入力欄を長押しして「ペースト」してください");
    }
  };
  return (
    <form action={action} className="stack" style={{ gap: 20 }}>
      <Step n={1} title="公式LINEの管理画面を開く">
        <a className="btn ghost" href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" style={{ textAlign: "center" }}>
          管理画面を開く ↗
        </a>
      </Step>

      <Step n={2} title="「設定 → Messaging API」の2つを貼り付け">
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input ref={idRef} name="channelId" inputMode="numeric" autoComplete="off" placeholder="Channel ID" required style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="ghost" onClick={() => paste("id")}>
            貼り付け
          </button>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input ref={secretRef} name="channelSecret" type="password" autoComplete="off" placeholder="Channel secret" required style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="ghost" onClick={() => paste("secret")}>
            貼り付け
          </button>
        </div>
      </Step>

      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      <button disabled={pending} style={{ padding: 16, fontSize: 17 }}>
        {pending ? "確認しています…" : "つないで始める"}
      </button>
    </form>
  );
}
