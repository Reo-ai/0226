"use client";

import { useActionState, useState } from "react";
import { claimWorkspaceAction } from "@/lib/actions";

/** 「？」で開く、鍵の見つけ方 */
function Help() {
  return (
    <div className="help-box">
      <ol>
        <li>公式LINEの管理画面を開いて、つなぎたい公式LINEを選ぶ</li>
        <li>右上の「設定」→「Messaging API」</li>
        <li>Channel ID と Channel secret をコピーして、ここに貼り付け</li>
      </ol>
      <a className="btn" href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" style={{ textAlign: "center" }}>
        管理画面を開く ↗
      </a>
    </div>
  );
}

/** 公式LINEの鍵を入れる。見つけ方は「？」を押したときだけ出す */
export default function StartForm() {
  const [error, action, pending] = useActionState(claimWorkspaceAction, null);
  const [help, setHelp] = useState(false);
  const q = (
    <button type="button" className="q-btn" onClick={() => setHelp((v) => !v)} aria-label="どこで見られる？" aria-expanded={help}>
      ?
    </button>
  );
  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <label htmlFor="channelId">Channel ID</label>
          {q}
        </div>
        <input id="channelId" name="channelId" inputMode="numeric" autoComplete="off" placeholder="例：2001234567" required />
      </div>
      {help && <Help />}
      <div className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <label htmlFor="channelSecret">Channel secret</label>
          {q}
        </div>
        <input id="channelSecret" name="channelSecret" type="password" autoComplete="off" placeholder="32文字の英数字" required />
      </div>
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      <button disabled={pending} style={{ padding: 14 }}>
        {pending ? "確認しています…" : "つないで始める"}
      </button>
    </form>
  );
}
