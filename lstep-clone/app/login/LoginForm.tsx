import Link from "next/link";

type Props = { lineEnabled: boolean; officialUrl: string | null; lineMessage: string | null };

const LINE_GREEN = "#06c755";
const bigBtn = { textAlign: "center", padding: "12px 14px" } as const;
const disabledBtn = { ...bigBtn, opacity: 0.5, cursor: "not-allowed" } as const;

export default function LoginForm({ lineEnabled, officialUrl, lineMessage }: Props) {
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
          <button disabled style={disabledBtn}>
            LINEでログイン（準備中）
          </button>
        )}

        {officialUrl ? (
          <a className="btn ghost" href={officialUrl} style={bigBtn}>
            公式LINEでログイン
          </a>
        ) : (
          <button disabled className="ghost" style={disabledBtn}>
            公式LINEでログイン（準備中）
          </button>
        )}
        <div className="hint">
          公式LINEでログイン：トークに「ログイン」と入った状態で開くので、そのまま送信してください。届いたリンクを開くと管理画面に入れます（10分間・1回だけ有効）。
        </div>

        {lineMessage && <div className="pre" style={{ color: "var(--danger)" }}>{lineMessage}</div>}
      </div>
      <Link href="/" className="hint">
        ← トップへ戻る
      </Link>
    </div>
  );
}
