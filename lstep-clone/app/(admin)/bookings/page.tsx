import Link from "next/link";
import { adminCancelBooking, createSlotsAction, deleteSlot, saveBookingSettings } from "@/lib/actions";
import { bookingSettings, bookingsOfSlots, slotLabel, slotsForAdmin } from "@/lib/bookings";
import { all } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { jstDateKey } from "@/lib/format";
import type { Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";
import { currentWorkspace, withWs } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// 予約の受付：枠を作る → 本文に {{booking}} を書いて送る → 友だちが日時を選ぶ
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ made?: string; error?: string }> }) {
  const { made, error } = await searchParams;
  const now = Date.now();
  const cfg = await bookingSettings();
  const slots = await slotsForAdmin(now);
  const bookings = await bookingsOfSlots(slots.map((s) => s.id));
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  const openUrl = withWs(`${baseUrl()}/b/open`, await currentWorkspace());
  const upcoming = slots.filter((s) => s.starts_at > now);
  const past = slots.filter((s) => s.starts_at <= now).reverse();
  const row = (s: (typeof slots)[number]) => {
    const list = bookings.filter((b) => b.slot_id === s.id && b.status === "booked");
    return (
      <tr key={s.id}>
        <td>{slotLabel(s)}</td>
        <td>
          {s.booked} / {s.capacity}
        </td>
        <td>
          {list.length === 0 && <span className="muted">-</span>}
          {list.map((b) => (
            <div key={b.id} className="row" style={{ gap: 6 }}>
              {b.friend_id ? <Link href={`/friends/${b.friend_id}`}>{b.display_name || "友だち"}</Link> : <span>{b.name}</span>}
              {b.note && <span className="muted small">（{b.note.slice(0, 40)}）</span>}
              {s.starts_at > now && (
                <form action={adminCancelBooking}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="ghost small">取消</button>
                </form>
              )}
            </div>
          ))}
        </td>
        <td>
          <form action={deleteSlot}>
            <input type="hidden" name="id" value={s.id} />
            <button className="danger small">枠を削除</button>
          </form>
        </td>
      </tr>
    );
  };
  return (
    <>
      <h1>予約の受付</h1>
      <p className="muted">
        予約できる枠を作り、メッセージの本文に <code>{"{{booking}}"}</code> と書いて送ると、友だちごとの予約ページのURLになります。
        予約されると確認メッセージが届き、通知を登録した LINE にもお知らせします。
      </p>
      {made && <div className="panel ok">{made}件の枠を作りました。</div>}
      {error && <div className="panel error">{error}</div>}

      <form action={createSlotsAction} className="panel stack">
        <h2 style={{ margin: 0 }}>枠を作る</h2>
        <div className="row">
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">日付（複数はスペース区切り）</span>
            <input name="dates" placeholder={`${jstDateKey(now + 86400_000)} ${jstDateKey(now + 2 * 86400_000)}`} defaultValue={jstDateKey(now + 86400_000)} required style={{ minWidth: 240 }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">時刻（複数はスペース区切り）</span>
            <input name="times" placeholder="10:00 13:00 15:00" defaultValue="10:00 13:00 15:00" required />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">1枠の長さ（分）</span>
            <input name="minutes" type="number" min={5} max={1440} defaultValue={60} style={{ width: 90 }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">定員</span>
            <input name="capacity" type="number" min={1} max={1000} defaultValue={1} style={{ width: 80 }} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">毎週くり返す</span>
            <select name="weeks" defaultValue="1">
              <option value="1">くり返さない</option>
              {[2, 4, 8, 12].map((w) => (
                <option key={w} value={w}>
                  {w}週間分
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <button>枠を作る</button>
        </div>
      </form>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>これからの枠</h2>
        <table>
          <thead>
            <tr>
              <th>日時</th>
              <th>予約</th>
              <th>予約した人</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {upcoming.map(row)}
            {upcoming.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  まだ枠がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={saveBookingSettings} className="panel stack">
        <h2 style={{ margin: 0 }}>受付の設定</h2>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">ページの見出し（例：無料相談のご予約）</span>
          <input name="title" defaultValue={cfg.title} maxLength={40} />
        </label>
        <div className="row">
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">予約した人に付けるタグ</span>
            <TagSelect tags={tags} name="tagId" empty="（付けない）" defaultValue={cfg.tagId ?? undefined} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">リマインド（開始の何時間前。0で送らない）</span>
            <input name="remindHours" type="number" min={0} max={168} defaultValue={cfg.remindHours} style={{ width: 90 }} />
          </label>
        </div>
        <label className="stack" style={{ gap: 4 }}>
          <span className="small muted">予約した時のメッセージに添える文（場所・持ち物・参加URLなど）</span>
          <textarea name="confirm" defaultValue={cfg.confirm} rows={3} />
        </label>
        <div>
          <button>保存</button>
        </div>
        <p className="small muted">
          友だち以外（SNSのプロフィールなど）に貼るときの URL：<code>{openUrl}</code>（名前を入力してもらう形になります）
        </p>
      </form>

      {past.length > 0 && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>終わった枠（30日以内）</h2>
          <table>
            <tbody>{past.map(row)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
