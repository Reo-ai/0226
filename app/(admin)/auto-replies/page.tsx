import { createAutoReply, deleteAutoReply, toggleAutoReply } from "@/lib/actions";
import { db } from "@/lib/db";
import type { AutoReply, Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";

export default function AutoRepliesPage() {
  const rules = db().prepare("SELECT * FROM auto_replies ORDER BY id").all() as AutoReply[];
  const tags = db().prepare("SELECT * FROM tags ORDER BY name").all() as Tag[];
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  return (
    <>
      <h1>キーワード自動応答</h1>
      <p className="muted">
        キーワードに一致しないメッセージは、AI設定がONならAIが返信します。応答メッセージは配信数にカウントされません。
      </p>
      <form action={createAutoReply} className="panel stack">
        <div className="row">
          <input name="keyword" placeholder="キーワード" required />
          <select name="matchType" defaultValue="exact">
            <option value="exact">完全一致</option>
            <option value="contains">部分一致</option>
          </select>
          付与タグ: <TagSelect tags={tags} name="addTagId" />
        </div>
        <textarea name="reply" placeholder="返信内容" required />
        <div><button>追加</button></div>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>キーワード</th><th>返信</th><th>付与タグ</th><th>反応数</th><th /></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.keyword} <span className="hint">({r.match_type === "exact" ? "完全" : "部分"})</span></td>
                <td className="pre">{r.reply}</td>
                <td>{r.add_tag_id ? tagName.get(r.add_tag_id) : "-"}</td>
                <td>{r.hit_count}</td>
                <td className="row">
                  <form action={toggleAutoReply}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="ghost small">{r.enabled ? "ON" : "OFF"}</button>
                  </form>
                  <form action={deleteAutoReply}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
