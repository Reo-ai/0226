"use client";

import { useActionState } from "react";
import { saveLineConnection } from "@/lib/actions";

export default function LineConnectForm({ connected }: { connected: boolean }) {
  const [error, action, pending] = useActionState(saveLineConnection, null);
  return (
    <form action={action} className="stack">
      <label className="stack" style={{ gap: 4 }}>
        <span>Channel ID</span>
        <input name="channelId" inputMode="numeric" placeholder={connected ? "変更するときだけ入力" : "例: 2011839529"} autoComplete="off" />
      </label>
      <label className="stack" style={{ gap: 4 }}>
        <span>Channel secret</span>
        <input type="password" name="channelSecret" placeholder={connected ? "変更するときだけ入力" : "管理画面の「コピー」ボタンで貼り付け"} autoComplete="off" />
      </label>
      <button disabled={pending}>{pending ? "確認中…" : connected ? "連携を更新する" : "公式LINEと連携する"}</button>
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
    </form>
  );
}
