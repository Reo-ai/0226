import { notFound } from "next/navigation";
import { addStep, deleteScenario, deleteStep, toggleScenario } from "@/lib/actions";
import { all, get } from "@/lib/db";
import { fmtDelay } from "@/lib/format";
import type { Scenario, ScenarioStep } from "@/lib/types";
import { ContentHelp, ErrorBox } from "@/lib/ui";

export default async function ScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const s = await get<Scenario>("SELECT * FROM scenarios WHERE id = ?", Number(id));
  if (!s) notFound();
  const steps = await all<ScenarioStep>(
    "SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY delay_minutes, id",
    s.id,
  );
  const sent = new Map(
    (
      await all<{ ref_id: number; n: number; free: number }>(
        `SELECT ref_id, COUNT(*) n, SUM(channel = 'reply') free FROM messages
         WHERE source = 'step' AND ref_id IN (SELECT id FROM scenario_steps WHERE scenario_id = ?) GROUP BY ref_id`,
        s.id,
      )
    ).map((r) => [r.ref_id, r]),
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
      <ErrorBox error={error} />
      <div className="panel">
        <table>
          <thead><tr><th>タイミング（開始から）</th><th>届け方</th><th>内容</th><th>送信数（うち無料）</th><th /></tr></thead>
          <tbody>
            {steps.map((st) => (
              <tr key={st.id}>
                <td>{fmtDelay(st.delay_minutes)}</td>
                <td>{st.delivery === "reply" ? <span className="free">反応時に無料</span> : "プッシュ"}</td>
                <td className="pre">{st.content}</td>
                <td>{sent.get(st.id)?.n ?? 0}（{sent.get(st.id)?.free ?? 0}）</td>
                <td>
                  <form action={deleteStep}>
                    <input type="hidden" name="id" value={st.id} />
                    <input type="hidden" name="scenarioId" value={s.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
            {steps.length === 0 && <tr><td colSpan={5} className="muted">ステップを追加してください</td></tr>}
          </tbody>
        </table>
        <p className="hint">
          「即時」のステップは友だち追加・タグ付与のきっかけになった操作への応答として<b className="free">無料</b>で届きます。
        </p>
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
        <fieldset className="stack">
          <legend>届け方（時間になったら…）</legend>
          <label className="row">
            <input type="radio" name="delivery" value="push" defaultChecked /> プッシュで送る（1通消費。無料枠が尽きたら反応待ちに自動切替）
          </label>
          <label className="row">
            <input type="radio" name="delivery" value="reply" /> <span><b className="free">無料</b>：相手の次の反応を待って届ける</span>
          </label>
        </fieldset>
        <textarea name="content" required placeholder="{{name}}さん、ご登録ありがとうございます！" />
        <ContentHelp />
        <div><button>追加</button></div>
      </form>
    </>
  );
}
