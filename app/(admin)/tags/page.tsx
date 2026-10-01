import { createTag, deleteTag } from "@/lib/actions";
import { db } from "@/lib/db";
import type { Tag } from "@/lib/types";
import { TagChip } from "@/lib/ui";

export default function TagsPage() {
  const tags = db()
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM friend_tags ft JOIN friends f ON f.id = ft.friend_id
                     WHERE ft.tag_id = t.id AND f.blocked = 0) n
       FROM tags t ORDER BY t.name`,
    )
    .all() as (Tag & { n: number })[];
  return (
    <>
      <h1>タグ</h1>
      <form action={createTag} className="panel row">
        <input name="name" placeholder="タグ名（例: 購入済み）" required />
        <input type="color" name="color" defaultValue="#06c755" />
        <button>追加</button>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>タグ</th><th>ID</th><th>人数（有効）</th><th /></tr></thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.id}>
                <td><TagChip tag={t} /></td>
                <td className="muted">{t.id}</td>
                <td>{t.n}</td>
                <td>
                  <form action={deleteTag}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">リッチメニュー等のポストバック <code>tag=ID</code> でもタグを付与できます。</p>
      </div>
    </>
  );
}
