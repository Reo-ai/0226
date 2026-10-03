import { crossTable, type Dim } from "@/lib/analytics";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

// クロス分析：2つの切り口で友だちを数える表
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ row?: string; col?: string; pct?: string }> }) {
  const sp = await searchParams;
  const fields = await all<{ id: number; name: string }>("SELECT id, name FROM custom_fields ORDER BY id");
  const dims: [Dim, string][] = [
    ["source", "流入元"],
    ["tag", "タグ"],
    ["month", "友だち追加の月"],
    ["score", "行動スコア"],
    ["booked", "予約"],
    ...fields.map((f) => [`field:${f.id}` as Dim, `情報欄：${f.name}`] as [Dim, string]),
  ];
  const valid = (v: string | undefined, d: Dim): Dim => (dims.some(([k]) => k === v) ? (v as Dim) : d);
  const row = valid(sp.row, "source");
  const col = valid(sp.col, "tag");
  const pct = sp.pct !== "0";
  const t = await crossTable(row, col);
  const max = Math.max(1, ...t.rows.flatMap((r) => t.cols.map((c) => t.counts[r]?.[c] ?? 0)));
  const Select = ({ name, value }: { name: string; value: Dim }) => (
    <select name={name} defaultValue={value} style={{ fontSize: 15 }}>
      {dims.map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <h1>クロス分析</h1>
      <form className="panel row" style={{ gap: 10 }}>
        <span style={{ fontSize: 15 }}>行</span>
        <Select name="row" value={row} />
        <span style={{ fontSize: 15 }}>× 列</span>
        <Select name="col" value={col} />
        <select name="pct" defaultValue={pct ? "1" : "0"}>
          <option value="1">人数と割合</option>
          <option value="0">人数だけ</option>
        </select>
        <button>集計する</button>
      </form>
      <div className="panel" style={{ overflowX: "auto" }}>
        {t.total === 0 ? (
          <p className="muted">まだ友だちがいません</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th />
                {t.cols.map((c) => (
                  <th key={c} style={{ whiteSpace: "nowrap" }}>
                    {c}
                  </th>
                ))}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r}>
                  <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>{r}</th>
                  {t.cols.map((c) => {
                    const n = t.counts[r]?.[c] ?? 0;
                    return (
                      <td key={c} style={{ background: n ? `rgba(6,199,85,${(0.08 + (0.5 * n) / max).toFixed(2)})` : undefined, textAlign: "right" }}>
                        <b style={{ fontSize: 15 }}>{n || ""}</b>
                        {pct && n > 0 && <div className="muted" style={{ fontSize: 11 }}>{Math.round((n / t.rowTotals[r]) * 100)}%</div>}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right" }}>
                    <b>{t.rowTotals[r]}</b>
                  </td>
                </tr>
              ))}
              <tr>
                <th style={{ textAlign: "left" }}>合計</th>
                {t.cols.map((c) => (
                  <td key={c} style={{ textAlign: "right" }}>
                    <b>{t.colTotals[c]}</b>
                  </td>
                ))}
                <td style={{ textAlign: "right" }}>
                  <b>{t.total}</b>
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <details style={{ marginTop: 8 }}>
          <summary className="hint" style={{ cursor: "pointer" }}>くわしく</summary>
          <p className="hint">
            ブロックしていない友だちを数えます。割合は「その行の人数のうち何%か」です。タグや複数選択の答えは1人が複数の列に入るので、列を足しても合計と合わないことがあります。
          </p>
        </details>
      </div>
    </>
  );
}
