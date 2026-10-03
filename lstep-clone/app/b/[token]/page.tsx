import type { Metadata } from "next";
import { cancelMyBooking, submitBooking } from "@/lib/actions";
import { bookingSettings, slotLabel, upcomingBookingsOf, upcomingSlots } from "@/lib/bookings";
import { getFriendByToken } from "@/lib/friends";
import "../../public.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ご予約", robots: { index: false } };

// 友だちが公式LINEから開く予約ページ（URLのトークンで本人を特定する。「open」は名前を入力してもらう）
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string; canceled?: string }>;
}) {
  const { token } = await params;
  const { error, done, canceled } = await searchParams;
  const friend = token === "open" ? undefined : await getFriendByToken(token);
  const cfg = await bookingSettings();
  const slots = (await upcomingSlots()).filter((s) => s.booked < s.capacity);
  const mine = friend ? await upcomingBookingsOf(friend.id) : [];
  return (
    <div className="public">
      <div className="panel stack">
        <h1>{cfg.title}</h1>
        {done && <div className="notice">予約を受け付けました。LINEにも確認のメッセージを送りました。</div>}
        {canceled && <div className="notice">予約を取り消しました。</div>}
        {error && <div className="error">{error}</div>}
        {mine.length > 0 && (
          <div className="stack">
            <h2>あなたの予約</h2>
            {mine.map((b) => (
              <form key={b.id} action={cancelMyBooking} className="row" style={{ justifyContent: "space-between" }}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="f" value={token} />
                <span>{slotLabel(b)}</span>
                <button className="ghost small">取り消す</button>
              </form>
            ))}
          </div>
        )}
        {slots.length === 0 ? (
          <p className="muted">いま予約できる日時はありません。</p>
        ) : (
          <form action={submitBooking} className="stack">
            <input type="hidden" name="f" value={token} />
            <span className="q">日時を選んでください<span className="req">必須</span></span>
            <div className="opts">
              {slots.map((s) => (
                <label key={s.id} className="row">
                  <input type="radio" name="slotId" value={s.id} required /> {slotLabel(s)}
                  {s.capacity > 1 && <span className="muted">（残り{s.capacity - s.booked}）</span>}
                </label>
              ))}
            </div>
            {!friend && (
              <label className="q">
                <span>お名前<span className="req">必須</span></span>
                <input name="name" required maxLength={50} />
              </label>
            )}
            <label className="q">
              <span>ご要望・メモ（任意）</span>
              <textarea name="note" maxLength={1000} />
            </label>
            <button>予約する</button>
          </form>
        )}
      </div>
    </div>
  );
}
