import { createProgram, deleteProgram, runResearch, setProgramStatus } from "@/lib/actions";
import { getSetting } from "@/lib/db";
import { fmtDateTime, jstMonthStart, yen } from "@/lib/format";
import { PROGRAM_STATUS, scoreClass, unitReward } from "@/lib/score";
import { programStats } from "@/lib/stats";
import { ErrorBox, type SP } from "@/lib/ui";

export const maxDuration = 120;

export default async function ProgramsPage({ searchParams }: { searchParams: SP }) {
  const { error } = await searchParams;
  const programs = await programStats(jstMonthStart() - 60 * 86_400_000);
  const research = JSON.parse((await getSetting("research_last")) || "null") as { at: number; text: string } | null;

  return (
    <>
      <h1>案件リサーチ</h1>
      <ErrorBox error={error} />
      <div className="panel">
        <h2>案件ランキング</h2>
        <p className="hint">
          想定EPC = 1件報酬 × 想定CVR × 承認率（1クリックあたりの見込み収益）。クリック・成果が貯まるほど実績値に寄っていきます（直近約2ヶ月）。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>案件</th><th>ASP</th><th>1件報酬</th><th>承認率</th><th>想定CVR</th>
                <th>想定EPC</th><th>実績</th><th>実績込みEPC</th><th>状態</th><th />
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}
                    {p.category && <div className="hint">{p.category}</div>}
                    {p.notes && <div className="hint">{p.notes}</div>}
                  </td>
                  <td>{p.asp || "-"}</td>
                  <td>
                    {yen(unitReward(p))}
                    {p.reward_type === "rate" && <div className="hint">{p.reward}% × {yen(p.avg_price)}</div>}
                  </td>
                  <td>{p.approval_rate}%</td>
                  <td>{p.est_cvr}%</td>
                  <td className={`score ${scoreClass(p.expEpc)}`}>{yen(p.expEpc)}</td>
                  <td className="muted">{p.clicks}クリック<br />{p.cv}件 {yen(p.earned)}</td>
                  <td className={`score ${scoreClass(p.epc)}`}>{yen(p.epc)}</td>
                  <td>
                    <form action={setProgramStatus} className="row">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="status" defaultValue={p.status}>
                        {Object.entries(PROGRAM_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button className="ghost small">変更</button>
                    </form>
                  </td>
                  <td>
                    <form action={deleteProgram}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="danger small">削除</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {programs.length === 0 && <p className="hint">まだ案件がありません。下のフォームから、ASPで見つけた案件を登録しましょう。</p>}
      </div>

      <form action={createProgram} className="panel stack">
        <h2>案件を追加</h2>
        <div className="row">
          <input name="name" placeholder="商品・サービス名" required style={{ flex: 2 }} />
          <input name="asp" placeholder="ASP（A8.net 等）" list="asps" />
          <datalist id="asps">
            {["A8.net", "もしもアフィリエイト", "バリューコマース", "afb", "アクセストレード", "felmat", "Amazonアソシエイト", "楽天アフィリエイト"].map((a) => <option key={a} value={a} />)}
          </datalist>
          <input name="category" placeholder="ジャンル（筋トレ 等）" />
        </div>
        <input name="url" placeholder="アフィリエイトリンク（https://〜）" />
        <div className="row">
          <label>報酬
            <select name="reward_type" defaultValue="fixed">
              <option value="fixed">定額（円）</option>
              <option value="rate">定率（%）</option>
            </select>
          </label>
          <input name="reward" type="number" step="any" min="0" placeholder="報酬額 or 料率" required style={{ width: 130 }} />
          <label>平均単価（定率のとき）<input name="avg_price" type="number" step="any" min="0" placeholder="円" style={{ width: 100 }} /></label>
          <label>承認率 %<input name="approval_rate" type="number" step="any" min="0" max="100" defaultValue={70} style={{ width: 70 }} /></label>
          <label>想定CVR %<input name="est_cvr" type="number" step="any" min="0" max="100" defaultValue={1} style={{ width: 70 }} /></label>
          <select name="status" defaultValue="candidate">
            {Object.entries(PROGRAM_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <textarea name="notes" placeholder="メモ（特徴・ターゲット・NG表現・特単条件など。AI投稿生成でも使われます）" style={{ minHeight: 60 }} />
        <p className="hint">
          承認率・CVRが分からなければ目安で: 物販 CVR 1〜3%・承認率 80〜95%／サービス申込（無料登録）CVR 1〜5%・承認率 60〜90%／金融・脱毛など高額 CVR 0.3〜1%・承認率 30〜70%。
        </p>
        <div><button>追加</button></div>
      </form>

      <div className="panel stack" id="research">
        <h2>AIリサーチ</h2>
        <form action={runResearch} className="stack">
          <textarea name="goal" placeholder="今の目標・悩み（任意）例: TikTokで筋トレ系を発信中。月3万円を目指したい。クリックはあるが成果が出ない" style={{ minHeight: 60 }} />
          <div><button>登録案件と実績からAIに提案してもらう</button> <span className="hint">30秒ほどかかります</span></div>
        </form>
        {research && (
          <>
            <div className="hint">前回の提案: {fmtDateTime(research.at)}</div>
            <div className="output">{research.text}</div>
          </>
        )}
      </div>
    </>
  );
}
