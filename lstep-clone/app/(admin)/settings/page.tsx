import Link from "next/link";
import { adminLineIds, lineConnected } from "@/lib/lineConfig";
import { baseUrl } from "@/lib/env";
import { deleteWorkspaceAction, issueNotifyCodeAction, removeNotifyTargetAction, renameWorkspace, saveReportSettings, saveSettings, saveStripeSettings } from "@/lib/actions";
import { buildReport, REPORT_ENABLED, REPORT_TIME } from "@/lib/report";
import { STRIPE_SECRET_KEY, STRIPE_THANKS_KEY, stripeWebhookSecret } from "@/lib/stripe";
import { requireOwnerPage, sessionUser, workspacesOf } from "@/lib/auth";
import { all, getSetting } from "@/lib/db";
import { currentNotifyCode, notifyTargets } from "@/lib/inbox";
import { currentWorkspace, MAIN, withWs } from "@/lib/workspace";
import { AI_MODELS, aiConfig, aiMonthlyUsage } from "@/lib/ai";
import { yen } from "@/lib/format";
import { pushLimit } from "@/lib/quota";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireOwnerPage();
  const { saved, error } = await searchParams;
  const ws = await currentWorkspace();
  const reportEnabled = (await getSetting(REPORT_ENABLED)) === "1";
  const reportTime = (await getSetting(REPORT_TIME)) || "08:00";
  const reportSample = await buildReport();
  const stripeSaved = Boolean(await getSetting(STRIPE_SECRET_KEY));
  const stripeReady = Boolean(await stripeWebhookSecret());
  const stripeThanks = await getSetting(STRIPE_THANKS_KEY);
  const stripeHookUrl = withWs(`${baseUrl()}/api/stripe/webhook`, ws);
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

      <form action={saveReportSettings} className="panel stack">
        <h2 style={{ margin: 0 }}>毎朝の数字レポート</h2>
        <p style={{ margin: 0 }}>友だちの増減・未返信・今日の予約を、通知先の LINE に毎朝お届けします。</p>
        <div className="row">
          <label className="row">
            <input type="checkbox" name="enabled" defaultChecked={reportEnabled} /> 毎朝届ける
          </label>
          <input type="time" name="time" defaultValue={reportTime} />
          <button className="ghost">保存</button>
        </div>
        <details>
          <summary className="hint" style={{ cursor: "pointer" }}>くわしく</summary>
          <p className="hint">届け先は「新着の通知」に登録した LINE です。1人につき1日1通の配信数を使います（月に約30通）。</p>
          <pre className="pre hint" style={{ background: "var(--bg)", padding: 8, borderRadius: 6 }}>{reportSample}</pre>
        </details>
      </form>

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

      <form id="stripe" action={saveStripeSettings} className="panel stack">
        <h2 style={{ margin: 0 }}>決済の自動判定（Stripe）</h2>
        <p style={{ margin: 0, fontSize: 15 }}>
          {stripeReady ? "✅ 設定済み：支払った友だちに「購入済み」タグが自動で付きます" : "未設定"}
        </p>
        <label className="stack" style={{ gap: 4 }}>
          <span className="hint">Stripe に登録する送信先 URL</span>
          <code style={{ userSelect: "all", wordBreak: "break-all" }}>{stripeHookUrl}</code>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="hint">署名シークレット（whsec_…）</span>
          <input name="secret" type="password" autoComplete="off" placeholder={stripeSaved ? "登録済み（変えるときだけ入力）" : "whsec_…"} />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="hint">購入した人に送るお礼（空なら送らない）</span>
          <textarea name="thanks" rows={2} defaultValue={stripeThanks} />
        </label>
        <div className="row">
          <button>保存</button>
          {stripeSaved && (
            <label className="row hint">
              <input type="checkbox" name="clearSecret" /> 登録を消す
            </label>
          )}
        </div>
        <details>
          <summary className="hint" style={{ cursor: "pointer" }}>設定のしかた</summary>
          <ol className="hint" style={{ lineHeight: 1.8 }}>
            <li>Stripe のダッシュボード →「開発者」→「Webhook」→「送信先を追加」</li>
            <li>上の URL を貼り、イベントは「checkout.session.completed」を選ぶ</li>
            <li>表示された署名シークレット（whsec_…）を上の欄に貼って保存</li>
            <li>「計測リンク」で行き先を Stripe の支払いリンク（buy.stripe.com/…）にして、本文に {"{{link:コード}}"} で送る</li>
          </ol>
          <p className="hint">支払いリンクを計測リンク経由で開くと、誰が払ったかが分かる印が自動で付きます。</p>
        </details>
      </form>

      <div className="panel stack">
        <h2>連携状況</h2>
        <div>Webhook URL: <code>{base}/api/line/webhook</code></div>
        <div>管理者のLINEユーザーID: {(await adminLineIds()).join(", ") || "未登録（最初にログインした人が管理者になります）"}</div>
        <div>
          公式LINE: {(await lineConnected()) ? "連携済み" : "未連携"}（<Link href="/line">LINE連携の画面へ</Link>）
        </div>
        <div>流入経路（LIFF）: LIFF_ID {env("LIFF_ID")} / LINE_LOGIN_CHANNEL_ID {env("LINE_LOGIN_CHANNEL_ID")} / LINE_ADD_FRIEND_URL {env("LINE_ADD_FRIEND_URL")}</div>
        <div>データの保存先: {process.env.DATABASE_URL?.startsWith("libsql") ? "Turso（消えません）" : "一時保存（消える可能性あり）"}</div>
      </div>
    </>
  );
}
