import { db } from "@/lib/db";
import { jstDateKey, pct } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/ui";

const DAY = 86_400_000;

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="panel stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const d = db();
  const now = Date.now();
  const since30 = now - 30 * DAY;

  const f = d
    .prepare(
      `SELECT COUNT(*) total, SUM(blocked = 0) active, SUM(blocked = 1) blocked,
              SUM(followed_at >= ?) new30, SUM(unfollowed_at >= ?) lost30
       FROM friends`,
    )
    .get(since30, since30) as { total: number; active: number; blocked: number; new30: number; lost30: number };

  // 14日間の友だち追加/ブロック推移
  const days = Array.from({ length: 14 }, (_, i) => jstDateKey(now - (13 - i) * DAY));
  const adds = new Map<string, number>();
  const blocks = new Map<string, number>();
  for (const r of d.prepare("SELECT followed_at FROM friends WHERE followed_at >= ?").all(now - 14 * DAY) as {
    followed_at: number;
  }[]) {
    const k = jstDateKey(r.followed_at);
    adds.set(k, (adds.get(k) ?? 0) + 1);
  }
  for (const r of d.prepare("SELECT unfollowed_at FROM friends WHERE unfollowed_at >= ?").all(now - 14 * DAY) as {
    unfollowed_at: number;
  }[]) {
    const k = jstDateKey(r.unfollowed_at);
    blocks.set(k, (blocks.get(k) ?? 0) + 1);
  }
  const maxAdd = Math.max(1, ...days.map((k) => adds.get(k) ?? 0));

  const bySource = d
    .prepare(
      "SELECT source, COUNT(*) n FROM messages WHERE created_at >= ? GROUP BY source ORDER BY n DESC",
    )
    .all(since30) as { source: string; n: number }[];
  const sourceCount = (s: string) => bySource.find((r) => r.source === s)?.n ?? 0;
  const outPush = sourceCount("manual") + sourceCount("broadcast") + sourceCount("step");
  const autoHandled = sourceCount("auto") + sourceCount("ai");

  const links = d
    .prepare(
      `SELECT l.name, l.code, COUNT(c.id) clicks, COUNT(DISTINCT c.friend_id) uniq
       FROM links l LEFT JOIN link_clicks c ON c.link_id = l.id
       GROUP BY l.id ORDER BY clicks DESC LIMIT 10`,
    )
    .all() as { name: string; code: string; clicks: number; uniq: number }[];

  const broadcasts = d
    .prepare(
      `SELECT b.id, b.title, b.recipient_count, b.sent_at,
              (SELECT COUNT(DISTINCT c.friend_id) FROM link_clicks c JOIN friends fr ON fr.id = c.friend_id
                 WHERE c.message_source = 'broadcast' AND c.created_at >= b.sent_at
                   AND c.created_at < b.sent_at + 3 * 86400000) clickers,
              (SELECT COUNT(*) FROM friends fr WHERE fr.unfollowed_at >= b.sent_at
                   AND fr.unfollowed_at < b.sent_at + 86400000) blocks
       FROM broadcasts b WHERE b.status = 'sent' ORDER BY b.sent_at DESC LIMIT 8`,
    )
    .all() as { id: number; title: string; recipient_count: number; sent_at: number; clickers: number; blocks: number }[];

  const scenarios = d
    .prepare(
      `SELECT s.name, COUNT(e.id) total, SUM(e.status = 'active') active,
              SUM(e.status = 'done') done, SUM(e.status = 'stopped') stopped
       FROM scenarios s LEFT JOIN enrollments e ON e.scenario_id = s.id
       GROUP BY s.id ORDER BY total DESC`,
    )
    .all() as { name: string; total: number; active: number; done: number; stopped: number }[];

  return (
    <>
      <h1>ダッシュボード</h1>
      <div className="grid">
        <Stat label="有効友だち" value={f.active ?? 0} sub={`累計 ${f.total}`} />
        <Stat label="30日の新規追加" value={f.new30 ?? 0} />
        <Stat label="30日のブロック" value={f.lost30 ?? 0} sub={`ブロック率 ${pct(f.blocked ?? 0, f.total)}`} />
        <Stat label="30日の受信メッセージ" value={sourceCount("user")} />
        <Stat label="30日のプッシュ送信" value={outPush} sub="配信数（従量課金対象）" />
        <Stat
          label="自動対応（無料応答）"
          value={autoHandled}
          sub={`AI ${sourceCount("ai")} / キーワード ${sourceCount("auto")}`}
        />
      </div>

      <div className="panel">
        <h2>友だち追加数（直近14日）</h2>
        <div className="bars">
          {days.map((k) => {
            const n = adds.get(k) ?? 0;
            const b = blocks.get(k) ?? 0;
            return (
              <div className="bar" key={k} title={`${k} 追加${n} / ブロック${b}`}>
                <span>{n || ""}</span>
                <span className="fill" style={{ height: `${(n / maxAdd) * 100}%` }} />
                <span>{k.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>一斉配信の成果（直近）</h2>
          <table>
            <thead>
              <tr><th>配信</th><th>送信数</th><th>クリック率(3日)</th><th>24hブロック</th></tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.recipient_count}</td>
                  <td>{pct(b.clickers, b.recipient_count)}</td>
                  <td>{b.blocks}</td>
                </tr>
              ))}
              {broadcasts.length === 0 && <tr><td colSpan={4} className="muted">まだありません</td></tr>}
            </tbody>
          </table>
          <p className="hint">クリック率は本文に {"{{link:コード}}"} を入れた場合に計測されます。</p>
        </div>

        <div className="panel">
          <h2>計測リンク</h2>
          <table>
            <thead><tr><th>リンク</th><th>クリック</th><th>ユニーク</th></tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.code}><td>{l.name}</td><td>{l.clicks}</td><td>{l.uniq}</td></tr>
              ))}
              {links.length === 0 && <tr><td colSpan={3} className="muted">まだありません</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>ステップ配信の状況</h2>
          <table>
            <thead><tr><th>シナリオ</th><th>進行中</th><th>完了</th><th>離脱(ブロック等)</th></tr></thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.active ?? 0}</td>
                  <td>{s.done ?? 0}</td>
                  <td>{s.stopped ?? 0} ({pct(s.stopped ?? 0, s.total)})</td>
                </tr>
              ))}
              {scenarios.length === 0 && <tr><td colSpan={4} className="muted">まだありません</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>送信内訳（30日）</h2>
          <table>
            <tbody>
              {bySource.map((r) => (
                <tr key={r.source}><td>{SOURCE_LABEL[r.source] ?? r.source}</td><td>{r.n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
