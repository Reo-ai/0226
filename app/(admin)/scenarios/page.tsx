import Link from "next/link";
import { createScenario } from "@/lib/actions";
import { db } from "@/lib/db";
import type { Scenario, Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";

const TRIGGER_LABEL = { follow: "友だち追加時", tag: "タグ付与時", manual: "手動" } as const;

export default function ScenariosPage() {
  const list = db()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM scenario_steps WHERE scenario_id = s.id) steps,
              (SELECT COUNT(*) FROM enrollments WHERE scenario_id = s.id AND status = 'active') active
       FROM scenarios s ORDER BY s.created_at DESC`,
    )
    .all() as (Scenario & { steps: number; active: number })[];
  const tags = db().prepare("SELECT * FROM tags ORDER BY name").all() as Tag[];
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  return (
    <>
      <h1>ステップ配信</h1>
      <form action={createScenario} className="panel row">
        <input name="name" placeholder="シナリオ名" required />
        <select name="trigger" defaultValue="follow">
          <option value="follow">友だち追加時に開始</option>
          <option value="tag">タグ付与時に開始</option>
          <option value="manual">手動で開始</option>
        </select>
        <TagSelect tags={tags} name="triggerTagId" empty="（タグ付与時のタグ）" />
        <button>作成</button>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>シナリオ</th><th>開始条件</th><th>ステップ数</th><th>進行中</th><th>状態</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/scenarios/${s.id}`}>{s.name}</Link></td>
                <td>
                  {TRIGGER_LABEL[s.trigger]}
                  {s.trigger === "tag" && s.trigger_tag_id ? `（${tagName.get(s.trigger_tag_id)}）` : ""}
                </td>
                <td>{s.steps}</td>
                <td>{s.active}</td>
                <td><span className={`badge ${s.enabled ? "on" : ""}`}>{s.enabled ? "有効" : "停止"}</span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="muted">まだシナリオはありません</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
