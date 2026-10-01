import { createLink, deleteLink } from "@/lib/actions";
import { db } from "@/lib/db";
import type { Link, Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";

export default function LinksPage() {
  const links = db()
    .prepare(
      `SELECT l.*, COUNT(c.id) clicks, COUNT(DISTINCT c.friend_id) uniq
       FROM links l LEFT JOIN link_clicks c ON c.link_id = l.id GROUP BY l.id ORDER BY l.created_at DESC`,
    )
    .all() as (Link & { clicks: number; uniq: number })[];
  const tags = db().prepare("SELECT * FROM tags ORDER BY name").all() as Tag[];
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  return (
    <>
      <h1>クリック計測リンク</h1>
      <p className="muted">
        配信本文に <code>{"{{link:コード}}"}</code> と書くと、友だちごとの計測URLに置き換わります。クリックした人にタグを自動付与できます。
      </p>
      <form action={createLink} className="panel row">
        <input name="name" placeholder="名前（例: LP）" />
        <input name="url" placeholder="https://..." required style={{ minWidth: 260 }} />
        <input name="code" placeholder="コード（任意）" style={{ width: 120 }} />
        クリック時タグ: <TagSelect tags={tags} name="addTagId" />
        <button>作成</button>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>名前</th><th>差し込みコード</th><th>遷移先</th><th>付与タグ</th><th>クリック</th><th>ユニーク</th><th /></tr></thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td><code>{`{{link:${l.code}}}`}</code></td>
                <td style={{ wordBreak: "break-all" }}>{l.url}</td>
                <td>{l.add_tag_id ? tagName.get(l.add_tag_id) : "-"}</td>
                <td>{l.clicks}</td>
                <td>{l.uniq}</td>
                <td>
                  <form action={deleteLink}>
                    <input type="hidden" name="id" value={l.id} />
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
