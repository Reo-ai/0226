import Link from "next/link";

type Props = { lineEnabled: boolean; lineMessage: string | null };

const LINE_GREEN = "#06c755";
const bigBtn = { textAlign: "center", padding: "12px 14px" } as const;

export default function LoginForm({ lineEnabled, lineMessage }: Props) {
  return (
    <div style={{ maxWidth: 380, margin: "12vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 14 }}>
        <h1 style={{ marginBottom: 4 }}>スキルコーチにログイン</h1>

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
      </div>
      <Link href="/" className="hint">
        ← トップへ戻る
      </Link>
    </div>
  );
}
