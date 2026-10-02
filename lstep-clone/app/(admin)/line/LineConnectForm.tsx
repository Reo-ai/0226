"use client";

import { useActionState } from "react";
import { saveLineConnection } from "@/lib/actions";

export default function LineConnectForm({ connected }: { connected: boolean }) {
  const [error, action, pending] = useActionState(saveLineConnection, null);
  return (
    <form action={action} className="stack">
      <label className="stack" style={{ gap: 4 }}>
        <span>チャネルアクセストークン（長期）</span>
        <input type="password" name="accessToken" placeholder={connected ? "変更するときだけ入力" : "LINE Developers の「Messaging API設定」で発行"} autoComplete="off" />
      </label>
      <label className="stack" style={{ gap: 4 }}>
        <span>チャネルシークレット</span>
        <input type="password" name="channelSecret" placeholder={connected ? "変更するときだけ入力" : "LINE Developers の「チャネル基本設定」にあります"} autoComplete="off" />
      </label>
      <label className="stack" style={{ gap: 4 }}>
        <span>チャネルID（任意）</span>
        <input name="channelId" placeholder="例: 2011839529" />
      </label>
      <button disabled={pending}>{pending ? "確認中…" : connected ? "連携を更新する" : "公式LINEと連携する"}</button>
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
    </form>
  );
}
