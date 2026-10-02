import { getFollowerStats, getQuota } from "@/lib/line";
import { lineConfig, lineConnected } from "@/lib/lineConfig";
import LineConnectForm from "./LineConnectForm";

export const dynamic = "force-dynamic";

export default async function LinePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const cfg = await lineConfig();
  const connected = await lineConnected();
  const [stats, quota] = connected ? await Promise.all([getFollowerStats(), getQuota()]) : [null, null];

  return (
    <>
      <h1>LINE連携</h1>
      {ok && <div className="panel ok">公式LINEと連携しました。友だち追加やメッセージがこのツールに記録されます。</div>}

      <div className="panel">
        <h2>連携中の公式LINE</h2>
        {connected ? (
          <div className="row" style={{ gap: 14 }}>
            {cfg.pictureUrl && <img src={cfg.pictureUrl} alt="" className="avatar" style={{ width: 48, height: 48 }} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{cfg.displayName || "（名前未取得）"}</div>
              <div className="muted">{cfg.basicId}</div>
            </div>
          </div>
        ) : (
          <p className="muted">まだ連携していません。下の欄に、公式LINEの2つの値を貼り付けてください（最初の1回だけ）。</p>
        )}
      </div>

      {connected && (
        <div className="grid">
          <div className="panel stat">
            <div className="label">友だち数（LINE公式の集計）</div>
            <div className="value">{stats ? stats.followers.toLocaleString() : "-"}</div>
            <div className="hint">{stats ? `${stats.date.slice(4, 6)}/${stats.date.slice(6)} 時点・連携前からの友だちも含む` : "集計待ち（翌日に表示）"}</div>
          </div>
          <div className="panel stat">
            <div className="label">ブロック数</div>
            <div className="value">{stats ? stats.blocks.toLocaleString() : "-"}</div>
          </div>
          <div className="panel stat">
            <div className="label">今月の配信数（LINE公式）</div>
            <div className="value">
              {quota ? quota.used.toLocaleString() : "-"}
              {quota?.limit ? <span className="muted" style={{ fontSize: 14 }}> / {quota.limit.toLocaleString()}</span> : null}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>{connected ? "連携を更新する" : "公式LINEと連携する"}</h2>
        <ol className="hint" style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            <a href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer">
              公式LINEの管理画面 ↗
            </a>
            を開き、右上の「設定」→ 左の「Messaging API」を開く
          </li>
          <li>「Channel ID」と「Channel secret」の「コピー」を押して、下に貼り付ける</li>
        </ol>
        <LineConnectForm connected={connected} />
        <p className="hint">
          連携すると、LINEからの受信先（Webhook）も自動で設定されます。連携より前の友だち一覧・トーク履歴は LINE
          の仕様で取得できないため、連携後の友だち追加・メッセージから記録されます。
        </p>
      </div>
    </>
  );
}
