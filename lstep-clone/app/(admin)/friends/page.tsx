import Link from "next/link";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import type { Friend, Tag } from "@/lib/types";
import { listFields } from "@/lib/fields";
import { segmentFrom, segmentWhere } from "@/lib/segment";
import { TagChip } from "@/lib/ui";
import SegmentFields from "../SegmentFields";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) ?? null;
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : []);
  const q = one("q") ?? "";
  const status = one("status") ?? "active";
  // 昔の「?tag=ID」も使えるようにする
  const segment = segmentFrom(one, (k) => (k === "tagIds" && one("tag") ? [...many(k), one("tag")!] : many(k)));
  const [tags, sources, fields] = await Promise.all([
    all<Tag>("SELECT * FROM tags ORDER BY name"),
    all<{ id: number; name: string }>("SELECT id, name FROM sources ORDER BY id"),
    listFields(),
  ]);

  const { where, args } = segmentWhere(segment);
  if (q) {
    where.push("(f.display_name LIKE ? OR f.note LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  if (status === "active") where.push("f.blocked = 0");
  if (status === "blocked") where.push("f.blocked = 1");
  const friends = await all<Friend>(
    `SELECT f.* FROM friends f ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY COALESCE(f.last_message_at, f.followed_at) DESC LIMIT 300`,
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
      <form className="panel stack">
        <SegmentFields tags={tags} sources={sources} fields={fields} value={segment} />
        <div className="row">
        <input name="q" defaultValue={q} placeholder="名前・メモで検索" />
        <select name="status" defaultValue={status}>
          <option value="active">有効</option>
          <option value="blocked">ブロック</option>
          <option value="all">すべて</option>
        </select>
        <button>絞り込み</button>
        <span className="muted">{friends.length}件</span>
        </div>
      </form>
      <div className="panel">
        <table>
          <thead>
            <tr><th>名前</th><th>スコア</th><th>タグ</th><th>最終メッセージ</th><th>友だち追加</th><th>状態</th></tr>
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
                <td>{f.score || "-"}</td>
                <td><div className="row">{(tagsOf.get(f.id) ?? []).map((t) => <TagChip key={t.id} tag={t} />)}</div></td>
                <td>{fmtDateTime(f.last_message_at)}</td>
                <td>{fmtDateTime(f.followed_at)}</td>
                <td>{f.blocked ? <span className="badge">ブロック</span> : <span className="badge on">有効</span>}</td>
              </tr>
            ))}
            {friends.length === 0 && <tr><td colSpan={6} className="muted">該当する友だちはいません</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
