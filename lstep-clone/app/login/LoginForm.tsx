import Link from "next/link";
import LineLoginButton from "./LineLoginButton";

type Props = { lineEnabled: boolean; lineMessage: string | null };

const bigBtn = { textAlign: "center", padding: "14px", fontSize: 15 } as const;

export default function LoginForm({ lineEnabled, lineMessage }: Props) {
  return (
    <div style={{ maxWidth: 380, margin: "12vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 14 }}>
        <h1 style={{ marginBottom: 4 }}>スキルステップにログイン</h1>

                {lineEnabled ? (
          <LineLoginButton />
        ) : (
          <button disabled style={{ ...bigBtn, opacity: 0.5, cursor: "not-allowed" }}>
            公式LINEアカウントでログイン（準備中）
          </button>
        )}

        {lineMessage && <div className="pre" style={{ color: "var(--danger)" }}>{lineMessage}</div>}
      </div>
      <Link href="/" className="hint">
        ← トップへ戻る
      </Link>
    </div>
  );
}
