import Link from "next/link";
import { listStudents, syncFormQuestions } from "@/lib/coach";

export const dynamic = "force-dynamic";

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  await syncFormQuestions();
  const list = await listStudents(sp.q);
  return (
    <>
      <h1 className="coach-h1">生徒</h1>
      <form className="coach-search">
        <input name="q" defaultValue={sp.q} placeholder="名前で探す" />
        <button className="ghost">探す</button>
      </form>
      <div className="s-list">
        {list.map((s) => (
          <Link key={s.id} href={`/coach/students/${s.id}`} className="s-row">
            {s.picture_url ? <img className="avatar" src={s.picture_url} alt="" /> : <span className="avatar" />}
            <b className="s-name">{s.display_name || "(名前未取得)"}</b>
            {s.open_count > 0 && <span className="pill s-open">未回答 {s.open_count}</span>}
            <span className="coach-space" />
            <span className="s-num">
              <b>{s.question_count}</b>質問
            </span>
            <span className="s-num">
              <b>{s.month_applies}</b>今月の応募
            </span>
            <span className="s-num">
              <b>{s.won_count}</b>受注
            </span>
            <span className="s-num">
              <b>¥{s.month_income.toLocaleString("ja-JP")}</b>今月の収入
            </span>
          </Link>
        ))}
        {list.length === 0 && <p className="coach-empty">生徒はまだいません</p>}
      </div>
    </>
  );
}
