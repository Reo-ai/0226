import Link from "next/link";
import { listQuestions, overview, QUESTS, syncFormQuestions } from "@/lib/coach";
import QuestionCard from "./QuestionCard";

export const dynamic = "force-dynamic";

const TABS = [
  ["open", "未回答"],
  ["answered", "回答済み"],
  ["resolved", "解決済み"],
  ["", "すべて"],
] as const;

export default async function CoachHome({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; quest?: string }> }) {
  const sp = await searchParams;
  await syncFormQuestions();
  const status = sp.status ?? "open";
  const [o, list] = await Promise.all([overview(), listQuestions({ status, q: sp.q, quest: sp.quest })]);
  const yen = o.income.toLocaleString("ja-JP");
  return (
    <>
      <section className="coach-hero">
        <div className="big">
          <b>{o.open}</b>
          <span>未回答の質問</span>
        </div>
        <div>
          <b>{o.students}</b>
          <span>生徒</span>
        </div>
        <div>
          <b>{o.applies}</b>
          <span>今月の応募（LINEの報告）</span>
        </div>
        <div>
          <b>{o.won}</b>
          <span>受注した案件</span>
        </div>
        <div>
          <b>¥{yen}</b>
          <span>今月の収入</span>
        </div>
      </section>

      <div className="coach-tabs">
        {TABS.map(([v, label]) => (
          <Link key={v} href={`/coach?status=${v}`} className={status === v ? "on" : ""}>
            {label}
          </Link>
        ))}
      </div>
      <form className="coach-search">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={sp.q} placeholder="質問と回答から探す" />
        <select name="quest" defaultValue={sp.quest ?? ""} aria-label="QUESTで絞る">
          <option value="">全QUEST</option>
          {QUESTS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button className="ghost">探す</button>
      </form>

      {list.map((q) => (
        <QuestionCard key={q.id} q={q} />
      ))}
      {list.length === 0 && <p className="coach-empty">該当する質問はありません</p>}
    </>
  );
}
