import { saveSettings } from "@/lib/actions";
import { AI_MODELS, aiConfig, aiMonthlyUsage } from "@/lib/ai";
import { yen } from "@/lib/format";
import { pushLimit } from "@/lib/quota";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const cfg = await aiConfig();
  const usage = await aiMonthlyUsage();
  const limit = await pushLimit();
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const base = process.env.BASE_URL || "http://localhost:3000";
  const env = (k: string) => (process.env[k] ? "設定済み" : "未設定");
  return (
    <>
      <h1>設定</h1>
      {saved && <div className="panel ok">保存しました（{saved}）</div>}
      <form action={saveSettings} className="stack">
        <div className="panel stack">
          <h2>LINE通数</h2>
          <label className="row">
            月のプッシュ上限
            <input type="number" name="pushLimit" min={0} defaultValue={limit} style={{ width: 100 }} /> 通
          </label>
          <p className="hint">
            無料のコミュニケーションプランは月200通。0にすると上限チェックを無効化（有料プラン用）。
            上限に達するとプッシュは止まり、ステップ配信は自動的に「次の反応時に無料で届ける」方式に切り替わります。
          </p>
        </div>

        <div className="panel stack">
          <h2>AI自動応答</h2>
          {!hasKey && <div className="error">環境変数 ANTHROPIC_API_KEY が未設定のため、AI応答は動作しません（AIなしなら完全0円で運用できます）。</div>}
          <label className="row">
            <input type="checkbox" name="aiEnabled" defaultChecked={cfg.enabled} />
            キーワードに一致しないメッセージにAIが返信する（応答メッセージなのでLINE通数は無料）
          </label>
          <label className="stack">
            モデル
            <select name="aiModel" defaultValue={cfg.model}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} 入力${m.input}/出力${m.output}（100万トークンあたり）
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            月間のAI返信上限
            <input type="number" name="aiMonthlyLimit" min={0} defaultValue={cfg.monthlyLimit} style={{ width: 100 }} /> 回
            <span className="hint">（0で無制限。上限に達したらAIは止まりキーワード応答のみ）</span>
          </label>
          <div className="hint">
            今月: {usage.count}回・推定 {yen(usage.jpy)}（1ドル=150円換算）。Anthropic Consoleで支払い上限も設定しておくと安心です。
          </div>
          <label className="stack">
            キャラクター・ルール（システムプロンプト）
            <textarea name="aiSystemPrompt" style={{ minHeight: 140 }} defaultValue={cfg.systemPrompt} />
          </label>
          <label className="stack">
            ナレッジ（営業時間・料金・FAQなど。AIはこの情報に基づいて回答。キャッシュされるので長くても割安）
            <textarea name="aiKnowledge" style={{ minHeight: 200 }} defaultValue={cfg.knowledge} />
          </label>
        </div>
        <div><button>保存</button></div>
      </form>

      <div className="panel stack">
        <h2>連携状況</h2>
        <div>Webhook URL: <code>{base}/api/line/webhook</code></div>
        <div>チャネルシークレット: {env("LINE_CHANNEL_SECRET")}</div>
        <div>アクセストークン: {process.env.LINE_CHANNEL_ACCESS_TOKEN ? "設定済み" : "未設定（ドライランで動作）"}</div>
        <div>流入経路（LIFF）: LIFF_ID {env("LIFF_ID")} / LINE_LOGIN_CHANNEL_ID {env("LINE_LOGIN_CHANNEL_ID")} / LINE_ADD_FRIEND_URL {env("LINE_ADD_FRIEND_URL")}</div>
        <div>DB: {process.env.DATABASE_URL?.startsWith("libsql") ? "Turso" : "ローカルファイル"}</div>
      </div>
    </>
  );
}
