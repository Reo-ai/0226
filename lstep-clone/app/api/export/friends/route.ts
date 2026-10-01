import { isAuthed } from "@/lib/auth";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { toCsv } from "@/lib/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return new Response("unauthorized", { status: 401 });
  const rows = await all<{
    id: number;
    display_name: string;
    blocked: number;
    followed_at: number;
    last_message_at: number | null;
    note: string;
    source: string | null;
    tags: string | null;
  }>(
    `SELECT f.id, f.display_name, f.blocked, f.followed_at, f.last_message_at, f.note, s.name source,
            (SELECT GROUP_CONCAT(t.name, ' / ') FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id = f.id) tags
     FROM friends f LEFT JOIN sources s ON s.id = f.source_id ORDER BY f.id`,
  );
  const csv = toCsv([
    ["ID", "表示名", "状態", "友だち追加日時", "最終メッセージ", "流入経路", "タグ", "メモ"],
    ...rows.map((r) => [
      r.id,
      r.display_name,
      r.blocked ? "ブロック" : "有効",
      fmtDateTime(r.followed_at),
      fmtDateTime(r.last_message_at),
      r.source ?? "",
      r.tags ?? "",
      r.note,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="friends.csv"',
    },
  });
}
