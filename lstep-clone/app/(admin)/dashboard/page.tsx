import { aiConfig, aiMonthlyUsage } from "@/lib/ai";
import { all, get } from "@/lib/db";
import Link from "next/link";
import { jstDateKey, jstDayStart, jstMonthStart, pct, yen } from "@/lib/format";
import { unrepliedCount } from "@/lib/inbox";
import { getQuota } from "@/lib/line";
import { pushLimit, pushUsed } from "@/lib/quota";
import { SOURCE_LABEL } from "@/lib/ui";

const DAY = 86_400_000;

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: React.ReactNode }) {
  return (
    <div className="panel stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );
}

function Meter({ used, limit }: { used: number; limit: number }) {
  const r = limit > 0 ? used / limit : 0;
  return (
    <div className={`meter ${r >= 1 ? "over" : r >= 0.8 ? "warn" : ""}`}>
      <span style={{ width: `${Math.min(100, r * 100)}%` }} />
    </div>
  );
}

export default async function Dashboard() {
  const now = Date.now();
  const since30 = now - 30 * DAY;
  const month = jstMonthStart(now);

  const [f, used, limit, lineQuota, ai, aiCfg] = await Promise.all([
    get<{ total: number; active: number; blocked: number; new30: number; lost30: number }>(
      `SELECT COUNT(*) total, SUM(blocked = 0) active, SUM(blocked = 1) blocked,
              SUM(followed_at >= ?) new30, SUM(unfollowed_at >= ?) lost30 FROM friends`,
      since30,
      since30,
    ),
    pushUsed(),
    pushLimit(),
    getQuota(),
    aiMonthlyUsage(),
    aiConfig(),
  ]);
  const ch = await all<{ channel: string; n: number }>(
    "SELECT channel, COUNT(*) n FROM messages WHERE direction = 'out' AND created_at >= ? GROUP BY channel",
    month,
  );
  const freeSent = ch.find((r) => r.channel === "reply")?.n ?? 0;
  const pending = (await get<{ n: number; p: number }>(
    "SELECT COUNT(*) n, COUNT(DISTINCT friend_id) p FROM pending_messages WHERE expires_at > ?",
    now,
  ))!;

  // 講座の数字：タグの付いた人数で導線の各段階を数える（タグ名で判定）
  const tagCount = async (where: string, ...args: (string | number)[]) =>
    (await get<{ n: number }>(
      `SELECT COUNT(DISTINCT ft.friend_id) n FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id
       JOIN friends fr ON fr.id = ft.friend_id WHERE fr.blocked = 0 AND (${where})`,
      ...args,
    ))?.n ?? 0;
  const activeFriends = f?.active ?? 0;
  const funnel = [
    { label: "友だち（有効）", n: activeFriends, hint: "" },
    { label: "初日に返信（レベル回答）", n: await tagCount("t.name LIKE 'レベル_%'"), hint: "目安 40%以上" },
    { label: "World1 体験", n: await tagCount("t.name = 'World1体験'"), hint: "目安 25%以上" },
    { label: "講座ページを見た", n: await tagCount("t.name = 'LP閲覧'"), hint: "" },
    { label: "決済ページを見た", n: await tagCount("t.name = '決済ページ閲覧'"), hint: "" },
    { label: "購入", n: await tagCount("t.name = '購入済み'"), hint: "目安 3〜5%" },
  ];
  // 講座のタグが1つも無い場所（招待した人の公式LINEなど）では、この表を出さない
  const courseTags = (await get<{ n: number }>(
    "SELECT COUNT(*) n FROM tags WHERE name LIKE 'レベル_%' OR name IN ('World1体験','LP閲覧','決済ページ閲覧','購入済み')",
  ))?.n ?? 0;
  const today = jstDateKey(now);
  const habit = (await get<{ set: number; active: number; doneToday: number; avgStreak: number; best: number }>(
    `SELECT SUM(action != '') "set",
            SUM(action != '' AND last_done_date >= ?) active,
            SUM(last_done_date = ?) doneToday,
            ROUND(AVG(CASE WHEN action != '' THEN streak END), 1) avgStreak,
            MAX(best_streak) best
     FROM habits`,
    jstDateKey(now - 7 * DAY),
    today,
  ))!;

  // 14日間の友だち追加推移
  const days = Array.from({ length: 14 }, (_, i) => jstDateKey(now - (13 - i) * DAY));
  const adds = new Map<string, number>();
  for (const r of await all<{ followed_at: number }>("SELECT followed_at FROM friends WHERE followed_at >= ?", now - 14 * DAY)) {
    const k = jstDateKey(r.followed_at);
    adds.set(k, (adds.get(k) ?? 0) + 1);
  }
  const maxAdd = Math.max(1, ...days.map((k) => adds.get(k) ?? 0));

  const bySource = await all<{ source: string; n: number }>(
    "SELECT source, COUNT(*) n FROM messages WHERE created_at >= ? GROUP BY source ORDER BY n DESC",
    since30,
  );
  const broadcasts = await all<{ id: number; title: string; delivery: string; recipient_count: number; delivered: number; clickers: number; blocks: number }>(
    `SELECT b.id, b.title, b.delivery, b.recipient_count,
            (SELECT COUNT(*) FROM messages m WHERE m.source = 'broadcast' AND m.ref_id = b.id) delivered,
            (SELECT COUNT(DISTINCT c.friend_id) FROM link_clicks c
               WHERE c.message_source = 'broadcast' AND c.created_at >= b.sent_at
                 AND c.created_at < b.sent_at + 3 * 86400000
                 AND c.friend_id IN (SELECT m.friend_id FROM messages m WHERE m.source = 'broadcast' AND m.ref_id = b.id)) clickers,
            (SELECT COUNT(*) FROM friends fr WHERE fr.unfollowed_at >= b.sent_at
                 AND fr.unfollowed_at < b.sent_at + 86400000) blocks
     FROM broadcasts b WHERE b.status = 'sent' ORDER BY b.sent_at DESC LIMIT 8`,
  );
  const scenarios = await all<{ name: string; total: number; active: number; done: number; stopped: number }>(
    `SELECT s.name, COUNT(e.id) total, SUM(e.status = 'active') active,
            SUM(e.status = 'done') done, SUM(e.status = 'stopped') stopped
     FROM scenarios s LEFT JOIN enrollments e ON e.scenario_id = s.id GROUP BY s.id ORDER BY total DESC`,
  );
  const sources = await all<{ name: string; visits: number; friends: number; blocked: number }>(
    `SELECT s.name,
            (SELECT COUNT(*) FROM source_visits v WHERE v.source_id = s.id) visits,
            (SELECT COUNT(*) FROM friends fr WHERE fr.source_id = s.id) friends,
            (SELECT COUNT(*) FROM friends fr WHERE fr.source_id = s.id AND fr.blocked = 1) blocked
     FROM sources s ORDER BY friends DESC`,
  );

  // 今日やること：未返信・今日の予約・新しい友だち（まず一番上に、大きく）
  const dayStart = jstDayStart(Date.now());
  const unreplied = await unrepliedCount();
  const todayBookings = (await get<{ n: number }>(
    `SELECT COUNT(*) n FROM bookings b JOIN booking_slots s ON s.id = b.slot_id
     WHERE b.status = 'booked' AND s.starts_at >= ? AND s.starts_at < ?`,
    dayStart,
    dayStart + 86400_000,
  ))?.n ?? 0;
  const newFriends = (await get<{ n: number }>("SELECT COUNT(*) n FROM friends WHERE followed_at >= ?", dayStart - 86400_000))?.n ?? 0;
  return (
    <>
      <h1>ダッシュボード</h1>
      <div className="today">
        <Link href="/inbox" className={`today-card${unreplied ? " alert" : ""}`}>
          <span>未返信</span>
          <b>{unreplied}</b>
        </Link>
        <Link href="/bookings" className="today-card">
          <span>今日の予約</span>
          <b>{todayBookings}</b>
        </Link>
        <Link href="/friends" className="today-card">
          <span>新しい友だち（昨日から）</span>
          <b>{newFriends}</b>
        </Link>
      </div>
      <div className="grid">
        <div className="panel stat">
          <div className="label">今月のプッシュ通数（無料枠）</div>
          <div className="value">
            {used} <span className="muted" style={{ fontSize: 14 }}>/ {limit > 0 ? limit : "無制限"}</span>
          </div>
          {limit > 0 && <Meter used={used} limit={limit} />}
          <div className="hint">
            {lineQuota ? `LINE公式の集計: ${lineQuota.used} / ${lineQuota.limit ?? "上限なし"}` : "LINE連携後に公式集計も表示"}
          </div>
        </div>
        <Stat label="今月 無料（応答）で届けた数" value={freeSent} sub={<span className="free">通数を消費していません</span>} />
        <Stat label="反応待ち（無料で届ける予定）" value={pending.n} sub={`${pending.p}人分`} />
        <Stat label="有効友だち" value={f?.active ?? 0} sub={`累計 ${f?.total ?? 0}・30日で+${f?.new30 ?? 0}`} />
        <Stat label="ブロック率" value={pct(f?.blocked ?? 0, f?.total ?? 0)} sub={`30日のブロック ${f?.lost30 ?? 0}`} />
        <Stat
          label="今月のAI応答"
          value={`${ai.count}${aiCfg.monthlyLimit > 0 ? ` / ${aiCfg.monthlyLimit}` : ""}`}
          sub={aiCfg.enabled ? `推定 ${yen(ai.jpy)}` : "OFF（0円）"}
        />
      </div>

      <div className="grid2">
        {courseTags > 0 && (
        <div className="panel">
          <h2>講座の数字（導線の各段階）</h2>
          <table>
            <thead>
              <tr>
                <th>段階</th>
                <th>人数</th>
                <th>友だち比</th>
                <th>前の段階から</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((st, i) => (
                <tr key={st.label}>
                  <td>
                    {st.label}
                    {st.hint && <div className="hint">{st.hint}</div>}
                  </td>
                  <td>{st.n}</td>
                  <td>{i === 0 ? "-" : pct(st.n, activeFriends)}</td>
                  <td>{i === 0 || st.n > funnel[i - 1].n ? "-" : pct(st.n, funnel[i - 1].n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hint">タグ（レベル_〜・World1体験・LP閲覧・決済ページ閲覧・購入済み）が付いた人数から計算しています</div>
        </div>
        )}
        <div className="panel">
          <h2>習慣トラッカー</h2>
          <div className="grid">
            <Stat label="習慣を設定した人" value={habit.set ?? 0} />
            <Stat label="続けている人（7日以内に記録）" value={habit.active ?? 0} sub={pct(habit.active ?? 0, habit.set ?? 0)} />
            <Stat label="今日できた人" value={habit.doneToday ?? 0} />
            <Stat label="平均の連続日数" value={habit.avgStreak ?? "-"} sub={`最高 ${habit.best ?? 0}日`} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>友だち追加数（直近14日）</h2>
        <div className="bars">
          {days.map((k) => {
            const n = adds.get(k) ?? 0;
            return (
              <div className="bar" key={k} title={`${k} 追加${n}`}>
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
              <tr><th>配信</th><th>方式</th><th>到達</th><th>クリック率</th><th>24hブロック</th></tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.delivery === "reply" ? <span className="free">無料</span> : "プッシュ"}</td>
                  <td>{b.delivered} / {b.recipient_count}</td>
                  <td>{pct(b.clickers, b.delivered)}</td>
                  <td>{b.blocks}</td>
                </tr>
              ))}
              {broadcasts.length === 0 && <tr><td colSpan={5} className="muted">まだありません</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>流入経路</h2>
          <table>
            <thead><tr><th>経路</th><th>訪問</th><th>友だち</th><th>ブロック</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.name}><td>{s.name}</td><td>{s.visits}</td><td>{s.friends}</td><td>{s.blocked}</td></tr>
              ))}
              {sources.length === 0 && <tr><td colSpan={4} className="muted">まだありません</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>ステップ配信の状況</h2>
          <table>
            <thead><tr><th>シナリオ</th><th>進行中</th><th>完了</th><th>離脱</th></tr></thead>
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
          <h2>メッセージ内訳（30日）</h2>
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
