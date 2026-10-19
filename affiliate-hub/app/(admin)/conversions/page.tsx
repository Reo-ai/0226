import { createConversion, deleteConversion, importConversions, setConversionStatus } from "@/lib/actions";
import { all } from "@/lib/db";
import { fmtDate, jstDateKey, yen } from "@/lib/format";
import { CONV_STATUS } from "@/lib/score";
import type { Conversion, Link, Program } from "@/lib/types";
import { ErrorBox, Notice, type SP } from "@/lib/ui";

export default async function ConversionsPage({ searchParams }: { searchParams: SP }) {
  const { error, notice } = await searchParams;
  const programs = await all<Program>("SELECT * FROM programs ORDER BY name");
  const links = await all<Link>("SELECT * FROM links ORDER BY name");
  const rows = await all<Conversion & { program_name: string | null; link_name: string | null }>(
    `SELECT v.*, p.name program_name, l.name link_name FROM conversions v
     LEFT JOIN programs p ON p.id = v.program_id LEFT JOIN links l ON l.id = v.link_id
     ORDER BY v.occurred_at DESC, v.id DESC LIMIT 200`,
  );

  return (
    <>
      <h1>成果</h1>
      <ErrorBox error={error} />
      <Notice notice={notice} />
      <div className="grid2">
        <form action={createConversion} className="panel stack">
          <h2>手入力</h2>
          <div className="row">
            <input type="date" name="date" defaultValue={jstDateKey(Date.now())} required />
            <select name="program_id" defaultValue="">
              <option value="">案件</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="link_id" defaultValue="">
              <option value="">リンク（分かれば）</option>
              {links.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="row">
            <input type="number" name="amount" placeholder="報酬（円）" min="0" step="any" required style={{ width: 120 }} />
            <label>件数<input type="number" name="count" defaultValue={1} min="1" max="100" style={{ width: 60 }} /></label>
            <select name="status" defaultValue="pending">
              {Object.entries(CONV_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input name="note" placeholder="メモ" />
          </div>
          <div><button>登録</button></div>
        </form>
        <form action={importConversions} className="panel stack">
          <h2>まとめて貼り付け（CSV / Excelコピー）</h2>
          <textarea name="csv" placeholder={"日付,案件名またはリンクコード,報酬,ステータス\n2026/10/01,〇〇プロテイン,1500,承認\n2026/10/03,ab12cd,3000,発生"} />
          <p className="hint">列順: 日付・案件名（またはリンクコード）・報酬・ステータス。ステータスは「承認/確定」「否認/キャンセル」「それ以外=発生」で自動判定。</p>
          <div><button>取り込む</button></div>
        </form>
      </div>

      <div className="panel">
        <table>
          <thead><tr><th>発生日</th><th>案件</th><th>リンク</th><th>報酬</th><th>状態</th><th>メモ</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.occurred_at)}</td>
                <td>{r.program_name ?? "-"}</td>
                <td>{r.link_name ?? "-"}</td>
                <td>{yen(r.amount)}</td>
                <td>
                  <form action={setConversionStatus} className="row">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status}>
                      {Object.entries(CONV_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="ghost small">変更</button>
                  </form>
                </td>
                <td className="muted">{r.note}</td>
                <td>
                  <form action={deleteConversion}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="hint">まだ成果がありません。</p>}
      </div>
    </>
  );
}
