import Link from "next/link";
import { cancelBroadcast } from "@/lib/actions";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import type { Broadcast, Tag } from "@/lib/types";
import { parseSegment } from "@/lib/segment";

const STATUS: Record<Broadcast["status"], string> = {
  scheduled: "予約中",
  sending: "送信中",
  sent: "送信済み",
  canceled: "取消",
  failed: "失敗",
};

export default async function BroadcastsPage() {
  const list = await all<Broadcast & { delivered: number }>(
    `SELECT b.*, (SELECT COUNT(*) FROM messages m WHERE m.source = 'broadcast' AND m.ref_id = b.id) delivered
     FROM broadcasts b ORDER BY scheduled_at DESC LIMIT 100`,
  );
  const tags = new Map((await all<Tag>("SELECT * FROM tags")).map((t) => [t.id, t.name]));
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>一斉配信</h1>
        <Link className="btn" href="/broadcasts/new">新規配信</Link>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>タイトル</th><th>対象</th><th>方式</th><th>配信日時</th><th>状態</th><th>到達/対象</th><th /></tr></thead>
          <tbody>
            {list.map((b) => {
              const seg = parseSegment(b.tag_ids);
              const ids = seg.tagIds;
              const extra = [seg.excludeTagIds.length ? `除外 ${seg.excludeTagIds.map((id) => tags.get(id) ?? "?").join("・")}` : "", seg.sourceId ? "流入元指定" : "", seg.habitMin ? `習慣${seg.habitMin}日以上` : "", seg.addedWithinDays ? `追加${seg.addedWithinDays}日以内` : "", seg.fieldId ? "友だち情報" : ""].filter(Boolean).join("／");
              const cancellable = b.status === "scheduled" || (b.delivery === "reply" && b.status === "sent");
              return (
                <tr key={b.id}>
                  <td>
                    <div>{b.title}</div>
                    <div className="hint pre">{b.content.slice(0, 80)}</div>
                    {b.error && <div className="hint" style={{ color: "var(--danger)" }}>{b.error}</div>}
                  </td>
                  <td>
                    {ids.length ? ids.map((id) => tags.get(id) ?? "?").join(seg.tagMode === "all" ? " かつ " : ", ") : "全員"}
                    {extra && <div className="hint">{extra}</div>}
                  </td>
                  <td>{b.delivery === "reply" ? <span className="free">反応時に無料</span> : "プッシュ"}</td>
                  <td>{fmtDateTime(b.sent_at ?? b.scheduled_at)}</td>
                  <td>{STATUS[b.status]}</td>
                  <td>{b.status === "sent" || b.status === "canceled" ? `${b.delivered} / ${b.recipient_count}` : "-"}</td>
                  <td>
                    {cancellable && (
                      <form action={cancelBroadcast}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="danger small">{b.status === "scheduled" ? "取消" : "未配達分を取消"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="muted">まだ配信はありません</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
