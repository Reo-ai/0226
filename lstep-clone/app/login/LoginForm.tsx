"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions";

type Props = { lineEnabled: boolean; lineMessage: string | null };

const LINE_GREEN = "#06c755";
const bigBtn = { textAlign: "center", padding: "12px 14px" } as const;

export default function LoginForm({ lineEnabled, lineMessage }: Props) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <div style={{ maxWidth: 380, margin: "12vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 14 }}>
        <h1 style={{ marginBottom: 4 }}>スキルステップにログイン</h1>

        {/* ルートハンドラへの遷移なので next/link ではなく a を使う */}
        {lineEnabled ? (
          <a className="btn" href="/api/auth/line" style={{ ...bigBtn, background: LINE_GREEN, borderColor: LINE_GREEN }}>
            LINEでログイン
          </a>
        ) : (
          <button disabled style={{ ...bigBtn, opacity: 0.5, cursor: "not-allowed" }}>
            LINEでログイン（準備中）
          </button>
        )}

        <a className="btn ghost" href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" style={bigBtn}>
          公式LINEの管理画面にログイン ↗
        </a>
        <div className="hint">公式LINE（LINE Official Account Manager）は別タブで開きます。</div>

        {lineMessage && <div className="pre" style={{ color: "var(--danger)" }}>{lineMessage}</div>}

        <details open={Boolean(error)}>
          <summary className="hint" style={{ cursor: "pointer" }}>
            管理者パスワードでログイン
          </summary>
          <form action={action} className="stack" style={{ marginTop: 10 }}>
            <input type="password" name="password" placeholder="管理パスワード" required />
            <button className="ghost" disabled={pending}>
              パスワードでログイン
            </button>
            {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
          </form>
        </details>
      </div>
      <Link href="/" className="hint">
        ← トップへ戻る
      </Link>
    </div>
  );
}
