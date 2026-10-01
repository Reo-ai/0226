import Link from "next/link";
import { cancelBroadcast } from "@/lib/actions";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import type { Broadcast, Tag } from "@/lib/types";

const STATUS: Record<Broadcast["status"], string> = {
  scheduled: "予約中",
  sending: "送信中",
  sent: "送信済み",
  canceled: "取消",
  failed: "失敗",
};

export default function BroadcastsPage() {
  const list = db().prepare("SELECT * FROM broadcasts ORDER BY scheduled_at DESC LIMIT 100").all() as Broadcast[];
  const tags = new Map((db().prepare("SELECT * FROM tags").all() as Tag[]).map((t) => [t.id, t.name]));
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>一斉配信</h1>
        <Link className="btn" href="/broadcasts/new">新規配信</Link>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>タイトル</th><th>対象</th><th>配信日時</th><th>状態</th><th>送信数</th><th /></tr></thead>
          <tbody>
            {list.map((b) => {
              const ids = JSON.parse(b.tag_ids) as number[];
              return (
                <tr key={b.id}>
                  <td>
                    <div>{b.title}</div>
                    <div className="hint pre">{b.content.slice(0, 80)}</div>
                  </td>
                  <td>{ids.length ? ids.map((id) => tags.get(id) ?? "?").join(", ") : "全員"}</td>
                  <td>{fmtDateTime(b.sent_at ?? b.scheduled_at)}</td>
                  <td>{STATUS[b.status]}</td>
                  <td>{b.status === "sent" ? b.recipient_count : "-"}</td>
                  <td>
                    {b.status === "scheduled" && (
                      <form action={cancelBroadcast}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="danger small">取消</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={6} className="muted">まだ配信はありません</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
