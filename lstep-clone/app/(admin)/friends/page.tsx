import Link from "next/link";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import type { Friend, Tag } from "@/lib/types";
import { TagChip } from "@/lib/ui";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; status?: string }>;
}) {
  const { q = "", tag = "", status = "active" } = await searchParams;
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (q) {
    where.push("(display_name LIKE ? OR note LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    where.push("id IN (SELECT friend_id FROM friend_tags WHERE tag_id = ?)");
    args.push(Number(tag));
  }
  if (status === "active") where.push("blocked = 0");
  if (status === "blocked") where.push("blocked = 1");
  const friends = await all<Friend>(
    `SELECT * FROM friends ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY COALESCE(last_message_at, followed_at) DESC LIMIT 300`,
    ...args,
  );

  const tagRows = await all<Tag & { friend_id: number }>(
    "SELECT ft.friend_id, t.* FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id",
  );
  const tagsOf = new Map<number, Tag[]>();
  for (const r of tagRows) tagsOf.set(r.friend_id, [...(tagsOf.get(r.friend_id) ?? []), r]);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>友だち</h1>
        <a className="btn ghost" href="/api/export/friends">CSVダウンロード</a>
      </div>
      <form className="panel row">
        <input name="q" defaultValue={q} placeholder="名前・メモで検索" />
        <select name="tag" defaultValue={tag}>
          <option value="">すべてのタグ</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={status}>
          <option value="active">有効</option>
          <option value="blocked">ブロック</option>
          <option value="all">すべて</option>
        </select>
        <button>絞り込み</button>
        <span className="muted">{friends.length}件</span>
      </form>
      <div className="panel">
        <table>
          <thead>
            <tr><th>名前</th><th>タグ</th><th>最終メッセージ</th><th>友だち追加</th><th>状態</th></tr>
          </thead>
          <tbody>
            {friends.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={`/friends/${f.id}`} className="row">
                    {f.picture_url ? <img className="avatar" src={f.picture_url} alt="" /> : <span className="avatar" />}
                    {f.display_name || "(名前未取得)"}
                  </Link>
                </td>
                <td><div className="row">{(tagsOf.get(f.id) ?? []).map((t) => <TagChip key={t.id} tag={t} />)}</div></td>
                <td>{fmtDateTime(f.last_message_at)}</td>
                <td>{fmtDateTime(f.followed_at)}</td>
                <td>{f.blocked ? <span className="badge">ブロック</span> : <span className="badge on">有効</span>}</td>
              </tr>
            ))}
            {friends.length === 0 && <tr><td colSpan={5} className="muted">該当する友だちはいません</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
