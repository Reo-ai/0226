import Link from "next/link";
import { createScoreRule, deleteScoreRule } from "@/lib/actions";
import { requireOwnerPage } from "@/lib/auth";
import { all } from "@/lib/db";
import { SCORE_KINDS, scoreRules } from "@/lib/score";
import type { Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";

export const dynamic = "force-dynamic";

// 行動スコア：行動ごとの点数と「○点でタグ」を決める。点数の高い人ほど見込みが高い
export default async function ScoresPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireOwnerPage();
  const { error } = await searchParams;
  const rules = await scoreRules();
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  const links = await all<{ id: number; name: string }>("SELECT id, name FROM links ORDER BY id DESC");
  const forms = await all<{ id: number; title: string }>("SELECT id, title FROM forms ORDER BY id DESC");
  const top = await all<{ id: number; display_name: string | null; score: number }>(
    "SELECT id, display_name, score FROM friends WHERE blocked = 0 AND score != 0 ORDER BY score DESC LIMIT 20",
  );
  const refName = (kind: string, id: number | null) => {
    if (!id) return kind === "click" ? "どのリンクでも" : kind === "form" ? "どのフォームでも" : "";
    if (kind === "click") return links.find((l) => l.id === id)?.name ?? "（削除済み）";
    if (kind === "form") return forms.find((f) => f.id === id)?.title ?? "（削除済み）";
    return tags.find((t) => t.id === id)?.name ?? "（削除済み）";
  };
  const actions = rules.filter((r) => r.kind !== "reach");
  const reach = rules.filter((r) => r.kind === "reach");
  return (
    <>
      <h1>行動スコア</h1>
      {error && <div className="panel error">{error}</div>}

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>行動ごとの点数</h2>
        <table>
          <tbody>
            {SCORE_KINDS.map((k) => (
              <tr key={k.kind}>
                <td style={{ fontSize: 15 }}>{k.label}</td>
                <td>
                  {actions
                    .filter((r) => r.kind === k.kind)
                    .map((r) => (
                      <form key={r.id} action={deleteScoreRule} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="id" value={r.id} />
                        <b style={{ fontSize: 16 }}>{r.points > 0 ? `+${r.points}` : r.points}点</b>
                        <span className="muted">{refName(r.kind, r.ref_id)}</span>
                        <button className="ghost small">消す</button>
                      </form>
                    ))}
                </td>
                <td>
                  <form action={createScoreRule} className="row" style={{ gap: 6 }}>
                    <input type="hidden" name="kind" value={k.kind} />
                    {k.ref === "link" && (
                      <select name="ref_click" defaultValue="">
                        <option value="">どのリンクでも</option>
                        {links.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {k.ref === "form" && (
                      <select name="ref_form" defaultValue="">
                        <option value="">どのフォームでも</option>
                        {forms.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {k.ref === "tag" && <TagSelect tags={tags} name="ref_tag" empty="（タグを選ぶ）" />}
                    <input name="points" type="number" placeholder="点" style={{ width: 70 }} required />
                    <button className="small">追加</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <details>
          <summary className="hint" style={{ cursor: "pointer" }}>くわしく</summary>
          <p className="hint">
            メッセージの点数は1日1回まで入ります。マイナスの点数も使えます（例：「配信停止」タグで −10）。友だちの画面から手で増減もできます。
          </p>
        </details>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>○点になったらタグを付ける</h2>
        {reach.map((r) => (
          <form key={r.id} action={deleteScoreRule} className="row" style={{ gap: 8 }}>
            <input type="hidden" name="id" value={r.id} />
            <b style={{ fontSize: 16 }}>{r.points}点</b>
            <span>→ タグ「{refName("tag", r.ref_id)}」</span>
            <button className="ghost small">消す</button>
          </form>
        ))}
        <form action={createScoreRule} className="row">
          <input type="hidden" name="kind" value="reach" />
          <input name="points" type="number" min={1} placeholder="点" style={{ width: 80 }} required />
          <span>点になったら</span>
          <TagSelect tags={tags} name="tagId" empty="（タグを選ぶ）" />
          <button>追加</button>
        </form>
        <p className="hint" style={{ margin: 0 }}>付いたタグでステップ配信を始めたり、リッチメニューを切り替えたりできます。</p>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>点数の高い人</h2>
        <table>
          <tbody>
            {top.map((f, i) => (
              <tr key={f.id}>
                <td style={{ width: 40 }}>{i + 1}</td>
                <td>
                  <Link href={`/friends/${f.id}`}>{f.display_name || "（名前なし）"}</Link>
                </td>
                <td>
                  <b>{f.score}</b>点
                </td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr>
                <td className="muted">まだ点数の付いた人はいません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
