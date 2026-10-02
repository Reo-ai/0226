"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions";

type Props = { lineEnabled: boolean; lineMessage: string | null };

export default function LoginForm({ lineEnabled, lineMessage }: Props) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <div style={{ maxWidth: 360, margin: "15vh auto", padding: 16 }}>
      <div className="panel stack">
        <h1>スキルステップ ログイン</h1>
        <form action={action} className="stack">
          <input type="password" name="password" placeholder="管理パスワード" required autoFocus />
          <button disabled={pending}>ログイン</button>
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        </form>
        {lineEnabled && (
          <>
            <div className="hint" style={{ textAlign: "center" }}>
              または
            </div>
            {/* ルートハンドラへの遷移なので next/link ではなく a を使う */}
            <a className="btn" href="/api/auth/line" style={{ textAlign: "center" }}>
              LINEでログイン
            </a>
          </>
        )}
        {lineMessage && <div className="pre" style={{ color: "var(--danger)" }}>{lineMessage}</div>}
      </div>
      <Link href="/" className="hint">
        ← トップへ戻る
      </Link>
    </div>
  );
}
