import { notFound } from "next/navigation";
import { addStep, deleteScenario, deleteStep, toggleScenario } from "@/lib/actions";
import { db } from "@/lib/db";
import { fmtDelay } from "@/lib/format";
import type { Scenario, ScenarioStep } from "@/lib/types";

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = db().prepare("SELECT * FROM scenarios WHERE id = ?").get(Number(id)) as Scenario | undefined;
  if (!s) notFound();
  const steps = db()
    .prepare("SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY delay_minutes, id")
    .all(s.id) as ScenarioStep[];
  // 各ステップに到達した人数（= 送信済み数）
  const sent = new Map(
    (
      db()
        .prepare("SELECT ref_id, COUNT(*) n FROM messages WHERE source = 'step' AND ref_id IN (SELECT id FROM scenario_steps WHERE scenario_id = ?) GROUP BY ref_id")
        .all(s.id) as { ref_id: number; n: number }[]
    ).map((r) => [r.ref_id, r.n]),
  );

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{s.name}</h1>
        <div className="row">
          <form action={toggleScenario}>
            <input type="hidden" name="id" value={s.id} />
            <button className="ghost">{s.enabled ? "停止する" : "有効にする"}</button>
          </form>
          <form action={deleteScenario}>
            <input type="hidden" name="id" value={s.id} />
            <button className="danger">削除</button>
          </form>
        </div>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>タイミング（開始から）</th><th>内容</th><th>送信数</th><th /></tr></thead>
          <tbody>
            {steps.map((st) => (
              <tr key={st.id}>
                <td>{fmtDelay(st.delay_minutes)}</td>
                <td className="pre">{st.content}</td>
                <td>{sent.get(st.id) ?? 0}</td>
                <td>
                  <form action={deleteStep}>
                    <input type="hidden" name="id" value={st.id} />
                    <input type="hidden" name="scenarioId" value={s.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
            {steps.length === 0 && <tr><td colSpan={4} className="muted">ステップを追加してください</td></tr>}
          </tbody>
        </table>
      </div>
      <form action={addStep} className="panel stack">
        <h2>ステップを追加</h2>
        <input type="hidden" name="scenarioId" value={s.id} />
        <div className="row">
          開始から
          <input type="number" name="days" min={0} defaultValue={0} style={{ width: 70 }} /> 日
          <input type="number" name="hours" min={0} max={23} defaultValue={0} style={{ width: 70 }} /> 時間
          <input type="number" name="minutes" min={0} max={59} defaultValue={0} style={{ width: 70 }} /> 分後
        </div>
        <textarea name="content" required placeholder="{{name}}さん、ご登録ありがとうございます！" />
        <div><button>追加</button></div>
      </form>
    </>
  );
}
