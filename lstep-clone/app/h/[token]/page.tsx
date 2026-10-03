import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFriendByToken } from "@/lib/friends";
import { ALL_BADGES, habitPageData } from "@/lib/habits";
import "./habit.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "冒険の記録", robots: { index: false } };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

// 友だち本人が公式LINEから開く「習慣の記録」ページ（URLのトークンで本人を特定する）
export default async function HabitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const friend = await getFriendByToken(token);
  if (!friend) notFound();
  const { habit, doneDates, today, active, doneToday } = await habitPageData(friend.id);

  if (!habit || !habit.action) {
    return (
      <main className="hb">
        <h1>冒険の記録</h1>
        <div className="card">
          <p>まだ続ける習慣が決まっていません。</p>
          <p className="sub">公式LINEで「習慣」と送るか、メニューの「習慣の設定」から始めましょう。</p>
        </div>
      </main>
    );
  }

  const earned = new Set(habit.badges ? habit.badges.split(",") : []);
  // 直近5週間（今日の週の土曜まで）のカレンダー
  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const end = new Date(todayDate.getTime() + (6 - todayDate.getUTCDay()) * 86400_000);
  const days = Array.from({ length: 35 }, (_, i) => {
    const t = new Date(end.getTime() - (34 - i) * 86400_000);
    const key = new Date(t.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    return { key, day: Number(key.slice(8)), future: key > today, done: doneDates.has(key), isToday: key === today };
  });
  const doneToday_ = habit.last_done_date === today;

  return (
    <main className="hb">
      <p className="who">{friend.display_name || "あなた"} の冒険の記録</p>
      <h1>📒 {habit.action}</h1>

      <section className="hero">
        <div className="streak">
          <span className="fire">🔥</span>
          <span className="num">{habit.streak}</span>
          <span className="unit">日連続</span>
        </div>
        <div className="stats">
          <div>
            <b>{habit.total}</b>日<small>累計</small>
          </div>
          <div>
            <b>{habit.best_streak}</b>日<small>最高記録</small>
          </div>
          <div>
            <b>{earned.size}</b>個<small>バッジ</small>
          </div>
        </div>
        <p className={doneToday_ ? "today ok" : "today"}>
          {doneToday_ ? "✅ 今日は達成済み！" : "⏳ 今日はまだ。やったらLINEで「できた」"}
        </p>
      </section>

      <section className="card">
        <h2>達成カレンダー</h2>
        <div className="cal">
          {WEEK.map((w) => (
            <span key={w} className="w">
              {w}
            </span>
          ))}
          {days.map((d) => (
            <span key={d.key} className={`d${d.done ? " done" : ""}${d.isToday ? " now" : ""}${d.future ? " fut" : ""}`}>
              {d.done ? "✓" : d.day}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>バッジ</h2>
        <div className="badges">
          {[...ALL_BADGES.streak, ...ALL_BADGES.total].map(([n, name]) => (
            <div key={name} className={earned.has(name) ? "bd on" : "bd"}>
              <span className="ic">{earned.has(name) ? name.split(" ")[0] : "🔒"}</span>
              <span className="nm">{name.split(" ").slice(1).join(" ")}</span>
              {!earned.has(name) && <span className="need">{String(n)}日</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>みんなの冒険</h2>
        <p className="together">
          今日できた人 <b>{doneToday}</b>人 ／ 習慣を続けている人 <b>{active}</b>人
        </p>
      </section>

      <p className="foot">
        ⏰ リマインド：{habit.remind_enabled && habit.remind_time ? `毎日 ${habit.remind_time}` : "オフ"}
        <br />
        時刻の変更は LINE で「通知 21:00」、止めるときは「通知オフ」
      </p>
    </main>
  );
}
