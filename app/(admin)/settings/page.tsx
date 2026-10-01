import { saveSettings } from "@/lib/actions";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai";
import { getSetting } from "@/lib/db";

export default function SettingsPage() {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const base = process.env.BASE_URL || "http://localhost:3000";
  return (
    <>
      <h1>AI自動応答設定</h1>
      {!hasKey && (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          環境変数 <code>ANTHROPIC_API_KEY</code> が未設定のため、AI応答は動作しません。
        </div>
      )}
      <form action={saveSettings} className="panel stack">
        <label className="row">
          <input type="checkbox" name="aiEnabled" defaultChecked={getSetting("ai_enabled", "0") === "1"} />
          キーワードに一致しないメッセージにAIが返信する
        </label>
        <label className="stack">
          モデル
          <input name="aiModel" defaultValue={getSetting("ai_model") || "claude-opus-5-5"} />
        </label>
        <label className="stack">
          キャラクター・ルール（システムプロンプト）
          <textarea name="aiSystemPrompt" style={{ minHeight: 140 }} defaultValue={getSetting("ai_system_prompt") || DEFAULT_SYSTEM_PROMPT} />
        </label>
        <label className="stack">
          ナレッジ（営業時間・料金・FAQなど。AIはこの情報に基づいて回答します）
          <textarea name="aiKnowledge" style={{ minHeight: 200 }} defaultValue={getSetting("ai_knowledge")} />
        </label>
        <div><button>保存</button></div>
        <p className="hint">友だち詳細画面から、個別にAI応答をOFFにできます（有人対応に切り替える場合など）。</p>
      </form>
      <div className="panel stack">
        <h2>LINE連携情報</h2>
        <div>Webhook URL: <code>{base}/api/line/webhook</code></div>
        <div>チャネルシークレット: {process.env.LINE_CHANNEL_SECRET ? "設定済み" : "未設定"}</div>
        <div>アクセストークン: {process.env.LINE_CHANNEL_ACCESS_TOKEN ? "設定済み" : "未設定（ドライランで動作）"}</div>
      </div>
    </>
  );
}
