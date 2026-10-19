import Link from "next/link";
import { all, get } from "@/lib/db";
import { jstDateKey, jstDayStart, jstMonthStart, pct, yen } from "@/lib/format";
import { guideState } from "@/lib/guide";
import { PLATFORM_LABEL, scoreClass } from "@/lib/score";
import { linkStats, programStats } from "@/lib/stats";

export default async function Dashboard() {
  const month = jstMonthStart();
  const days = 30;
  const since = jstDayStart() - (days - 1) * 86_400_000;

  const clicks = (await get<{ n: number }>("SELECT COUNT(*) n FROM clicks WHERE created_at >= ?", month))?.n ?? 0;
  const conv = (await get<{ n: number; earned: number; approved: number; rejected: number }>(
    `SELECT COUNT(*) n,
       COALESCE(SUM(CASE WHEN status != 'rejected' THEN amount END), 0) earned,
       COALESCE(SUM(CASE WHEN status = 'approved' THEN amount END), 0) approved,
       COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount END), 0) rejected
     FROM conversions WHERE occurred_at >= ?`,
    month,
  ))!;
  const decided = conv.approved + conv.rejected;

  const daily = await all<{ d: number; n: number }>(
    "SELECT (created_at + 32400000) / 86400000 d, COUNT(*) n FROM clicks WHERE created_at >= ? GROUP BY d",
    since,
  );
  const byDay = new Map(daily.map((r) => [Number(r.d), r.n]));
  const bars = Array.from({ length: days }, (_, i) => {
    const t = since + i * 86_400_000;
    return { key: jstDateKey(t).slice(5), n: byDay.get(Math.floor((t + 9 * 3600_000) / 86_400_000)) ?? 0 };
  });
  const max = Math.max(1, ...bars.map((b) => b.n));

  const channels = await all<{ channel: string; n: number }>(
    "SELECT channel, COUNT(*) n FROM clicks WHERE created_at >= ? GROUP BY channel ORDER BY n DESC",
    month,
  );
  const programs = (await programStats(month)).filter((p) => p.status !== "paused").slice(0, 5);
  const links = (await linkStats(month)).slice(0, 10);
  const next = (await guideState()).find((s) => !s.done);

  return (
    <>
      <h1>ダッシュボード（今月）</h1>
      {next && (
        <div className="panel ok row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="hint">次にやること（{next.phase}）</div>
            <strong>{next.title}</strong>
          </div>
          <Link className="btn" href={next.href ?? "/guide"}>
            進める
          </Link>
        </div>
      )}
      <div className="grid">
        <div className="panel stat"><div className="label">クリック</div><div className="value">{clicks.toLocaleString()}</div></div>
        <div className="panel stat"><div className="label">成果件数（否認含む）</div><div className="value">{conv.n}</div></div>
        <div className="panel stat"><div className="label">発生報酬（否認除く）</div><div className="value">{yen(conv.earned)}</div></div>
        <div className="panel stat"><div className="label">確定報酬</div><div className="value">{yen(conv.approved)}</div></div>
        <div className="panel stat"><div className="label">承認率（金額）</div><div className="value">{pct(conv.approved, decided)}</div></div>
        <div className="panel stat"><div className="label">EPC（発生/クリック）</div><div className="value">{clicks ? yen(conv.earned / clicks) : "-"}</div></div>
      </div>

      <div className="panel">
        <h2>クリック推移（30日）</h2>
        <div className="bars">
          {bars.map((b, i) => (
            <div key={b.key} className="bar" title={`${b.key}: ${b.n}`}>
              <span className="fill" style={{ height: `${(b.n / max) * 100}%` }} />
              {i % 5 === 0 ? b.key : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>稼げている案件（実績込みEPC順）</h2>
          <table>
            <thead><tr><th>案件</th><th>クリック</th><th>成果</th><th>EPC</th></tr></thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.clicks}</td>
                  <td>{p.cv}件 / {yen(p.earned)}</td>
                  <td className={`score ${scoreClass(p.epc)}`}>{yen(p.epc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {programs.length === 0 && <p className="hint">「案件リサーチ」から案件を登録しましょう。</p>}
        </div>
        <div className="panel">
          <h2>媒体別クリック</h2>
          <table>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channel}>
                  <td>{PLATFORM_LABEL[c.channel] ?? (c.channel || "未指定")}</td>
                  <td>{c.n}</td>
                  <td className="muted">{pct(c.n, clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {channels.length === 0 && <p className="hint">まだクリックがありません。</p>}
        </div>
      </div>

      <div className="panel">
        <h2>リンク別</h2>
        <table>
          <thead><tr><th>リンク</th><th>案件</th><th>クリック</th><th>成果</th><th>CVR</th><th>EPC</th></tr></thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td>{l.name} <span className="muted">/{l.code}</span></td>
                <td>{l.program_name ?? "-"}</td>
                <td>{l.clicks}</td>
                <td>{l.cv}件 / {yen(l.earned)}</td>
                <td>{pct(l.cv, l.clicks)}</td>
                <td>{l.clicks ? yen(l.earned / l.clicks) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">成果をリンクに紐づけて登録すると、リンク別のCVR・EPCが出ます。</p>
      </div>
    </>
  );
}
