"use client";

import { useActionState, useRef } from "react";
import { claimWorkspaceAction } from "@/lib/actions";

/** コピーした文字から Channel ID（数字）と Channel secret（32文字）を拾う */
function pick(text: string) {
  return { id: text.match(/\b\d{8,12}\b/)?.[0], secret: text.match(/\b[0-9a-f]{32}\b/i)?.[0] };
}

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
    <form action={action} className="stack" style={{ gap: 12 }}>
      <label className="stack" style={{ gap: 4 }}>
        <span>Channel ID</span>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input ref={idRef} name="channelId" inputMode="numeric" autoComplete="off" placeholder="例：2001234567" required style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="ghost small" onClick={() => paste("id")}>
            貼り付け
          </button>
        </div>
      </label>
      <label className="stack" style={{ gap: 4 }}>
        <span>Channel secret</span>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input ref={secretRef} name="channelSecret" type="password" autoComplete="off" placeholder="32文字の英数字" required style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="ghost small" onClick={() => paste("secret")}>
            貼り付け
          </button>
        </div>
      </label>
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      <button disabled={pending} style={{ padding: 14 }}>
        {pending ? "確認しています…" : "つないで始める"}
      </button>
    </form>
  );
}
