import Link from "next/link";
import { adminLineIds, lineConnected } from "@/lib/lineConfig";
import { baseUrl } from "@/lib/env";
import { deleteWorkspaceAction, issueNotifyCodeAction, removeNotifyTargetAction, renameWorkspace, saveSettings } from "@/lib/actions";
import { sessionUser, workspacesOf } from "@/lib/auth";
import { all } from "@/lib/db";
import { currentNotifyCode, notifyTargets } from "@/lib/inbox";
import { currentWorkspace, MAIN } from "@/lib/workspace";
import { AI_MODELS, aiConfig, aiMonthlyUsage } from "@/lib/ai";
import { yen } from "@/lib/format";
import { pushLimit } from "@/lib/quota";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const ws = await currentWorkspace();
  const user = await sessionUser();
  const wsName = (user ? await workspacesOf(user) : []).find((w) => w.id === ws)?.name ?? "";
  const code = await currentNotifyCode();
  const targetIds = await notifyTargets();
  const targets = targetIds.length
    ? await all<{ id: number; display_name: string }>(
        `SELECT id, display_name FROM friends WHERE id IN (${targetIds.map(() => "?").join(",")})`,
        ...targetIds,
      )
    : [];
  const cfg = await aiConfig();
  const usage = await aiMonthlyUsage();
  const limit = await pushLimit();
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const base = baseUrl();
  const env = (k: string) => (process.env[k] ? "設定済み" : "未設定");
  return (
    <>
      <h1>設定</h1>
      {saved && <div className="panel ok">保存しました（{saved}）</div>}
      {error && <div className="panel error">{error}</div>}

      <div className="panel stack">
        <h2>新着の通知</h2>
        <p className="hint" style={{ margin: 0 }}>
          自動で返事ができなかったメッセージ（未返信）が届いたら、あなたの LINE にお知らせします（1件ごとに配信数を1通使います。同じ人からは10分に1回まで）。
        </p>
        {targets.length > 0 && (
          <div className="row">
            通知先：
            {targets.map((t) => (
              <form key={t.id} action={removeNotifyTargetAction} className="row">
                <input type="hidden" name="friendId" value={t.id} />
                <span className="badge">{t.display_name || `友だち#${t.id}`}</span>
                <button className="ghost small">外す</button>
              </form>
            ))}
          </div>
        )}
        {code ? (
          <div>
            あなたの LINE から、この公式LINEに <b style={{ fontSize: 18 }}>通知登録 {code}</b> と送ってください（30分有効）。
          </div>
        ) : (
          <form action={issueNotifyCodeAction}>
            <button className="ghost">通知を受け取る LINE を登録する</button>
          </form>
        )}
      </div>

      <div className="panel stack">
        <h2>この場所</h2>
        <form action={renameWorkspace} className="row">
          <input name="name" defaultValue={wsName} maxLength={40} style={{ minWidth: 240 }} aria-label="場所の名前" />
          <button className="ghost">名前を変える</button>
        </form>
        {ws !== MAIN && (
          <details>
            <summary className="hint" style={{ cursor: "pointer" }}>この場所を削除する</summary>
            <form action={deleteWorkspaceAction} className="row" style={{ marginTop: 8 }}>
              <span className="hint">友だち・配信・設定などのデータがすべて消え、元に戻せません。確認のため「削除」と入力：</span>
              <input name="confirm" placeholder="削除" style={{ width: 80 }} />
              <button className="danger">削除する</button>
            </form>
          </details>
        )}
      </div>
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
        <div>管理者のLINEユーザーID: {(await adminLineIds()).join(", ") || "未登録（最初にログインした人が管理者になります）"}</div>
        <div>
          公式LINE: {(await lineConnected()) ? "連携済み" : "未連携"}（<Link href="/line">LINE連携の画面へ</Link>）
        </div>
        <div>流入経路（LIFF）: LIFF_ID {env("LIFF_ID")} / LINE_LOGIN_CHANNEL_ID {env("LINE_LOGIN_CHANNEL_ID")} / LINE_ADD_FRIEND_URL {env("LINE_ADD_FRIEND_URL")}</div>
        <div>
          決済の自動判定（Stripe）: {process.env.STRIPE_WEBHOOK_SECRET ? "設定済み" : "未設定"}
          <div className="hint">
            Stripe のダッシュボード →「開発者」→「Webhook」で送信先に <code>{base}/api/stripe/webhook</code> を登録し、イベントは
            「checkout.session.completed」を選ぶ。表示される署名シークレット（whsec_…）を環境変数 STRIPE_WEBHOOK_SECRET に登録すると、
            計測リンク {"{{link:checkout}}"} の行き先を Stripe の支払いリンクにした場合に、支払った友だちへ自動で「購入済み」タグが付きます。
          </div>
        </div>
        <div>データの保存先: {process.env.DATABASE_URL?.startsWith("libsql") ? "Turso（消えません）" : "一時保存（消える可能性あり）"}</div>
      </div>
    </>
  );
}
