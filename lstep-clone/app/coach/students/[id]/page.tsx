import Link from "next/link";
import { notFound } from "next/navigation";
import { addEarning, addJob, deleteEarning, deleteJob, setJobStatus } from "@/lib/coach-actions";
import { JOB_STATUS, listQuestions, monthKey, studentDetail, syncFormQuestions, type JobStatus } from "@/lib/coach";
import { jstDateKey } from "@/lib/format";
import { getFriend } from "@/lib/friends";
import QuestionCard from "../../QuestionCard";

export const dynamic = "force-dynamic";

export default async function Student({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const friend = await getFriend(id);
  if (!friend) notFound();
  await syncFormQuestions();
  const [questions, d] = await Promise.all([listQuestions({ friendId: id }), studentDetail(id)]);
  const month = monthKey();
  const byMonth = new Map<string, number>();
  for (const e of d.earnings) byMonth.set(e.month, (byMonth.get(e.month) ?? 0) + e.amount);
  const total = [...byMonth.values()].reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...byMonth.values());
  const monthApplies = d.applies.find((a) => a.month === month)?.n ?? 0;
  return (
    <>
      <Link href="/coach/students" className="coach-back">
        ‹ 生徒の一覧
      </Link>
      <header className="st-head">
        {friend.picture_url && <img className="avatar big" src={friend.picture_url} alt="" />}
        <h1 className="coach-h1">{friend.display_name || "(名前未取得)"}</h1>
        <span className="coach-space" />
        <Link className="btn ghost" href={`/friends/${friend.id}`}>
          LINEのトークを見る
        </Link>
      </header>
      <section className="coach-hero small">
        <div>
          <b>¥{(byMonth.get(month) ?? 0).toLocaleString("ja-JP")}</b>
          <span>今月の収入</span>
        </div>
        <div>
          <b>¥{total.toLocaleString("ja-JP")}</b>
          <span>累計の収入</span>
        </div>
        <div>
          <b>{monthApplies}</b>
          <span>今月の応募（LINEの報告）</span>
        </div>
        <div>
          <b>{d.jobs.filter((j) => j.status === "won").length}</b>
          <span>受注した案件</span>
        </div>
      </section>

      <div className="st-grid">
        <section>
          <h2 className="coach-h2">質問と回答（{questions.length}）</h2>
          {questions.map((q) => (
            <QuestionCard key={q.id} q={q} showStudent={false} />
          ))}
          {questions.length === 0 && <p className="coach-empty">質問はまだありません</p>}
        </section>

        <aside>
          <h2 className="coach-h2">応募した案件（{d.jobs.length}）</h2>
          <div className="box">
            {d.jobs.map((j) => (
              <div className="job" key={j.id}>
                <div className="job-title">{j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title}</div>
                <div className="q-meta">
                  {j.site && `${j.site}・`}
                  {j.applied_on}
                </div>
                <div className="row">
                  <form action={setJobStatus} className="row">
                    <input type="hidden" name="id" value={j.id} />
                    <select name="status" defaultValue={j.status} aria-label="案件の状況">
                      {(Object.keys(JOB_STATUS) as JobStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {JOB_STATUS[k]}
                        </option>
                      ))}
                    </select>
                    <button className="ghost small">更新</button>
                  </form>
                  <form action={deleteJob}>
                    <input type="hidden" name="id" value={j.id} />
                    <button className="ghost small">削除</button>
                  </form>
                </div>
              </div>
            ))}
            <details className="q-more">
              <summary>＋ 案件を足す</summary>
              <form action={addJob} className="q-form">
                <input type="hidden" name="friendId" value={id} />
                <input name="title" placeholder="案件名" required />
                <input name="site" placeholder="サイト（例：クラウドワークス）" />
                <input name="url" type="url" placeholder="募集ページのURL（なくても可）" />
                <input name="appliedOn" type="date" defaultValue={jstDateKey(Date.now())} aria-label="応募した日" />
                <button>追加</button>
              </form>
            </details>
          </div>

          <h2 className="coach-h2">月の収入</h2>
          <div className="box">
            {[...byMonth.entries()].map(([m, v]) => (
              <div className="bar" key={m}>
                <span>{m}</span>
                <i style={{ width: `${(v / max) * 100}%` }} />
                <b>¥{v.toLocaleString("ja-JP")}</b>
              </div>
            ))}
            {d.earnings.length > 0 && (
              <details className="q-more">
                <summary>内訳を見る</summary>
                {d.earnings.map((e) => (
                  <div className="row earning" key={e.id}>
                    <span>{e.month}</span>
                    <b>¥{e.amount.toLocaleString("ja-JP")}</b>
                    <span className="q-meta">{e.note}</span>
                    <span className="coach-space" />
                    <form action={deleteEarning}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="ghost small">削除</button>
                    </form>
                  </div>
                ))}
              </details>
            )}
            <details className="q-more">
              <summary>＋ 収入を足す</summary>
              <form action={addEarning} className="q-form">
                <input type="hidden" name="friendId" value={id} />
                <input name="month" type="month" defaultValue={month} aria-label="月" required />
                <input name="amount" type="number" min="1" placeholder="金額（円）" required />
                <input name="note" placeholder="メモ（案件名など）" />
                <button>追加</button>
              </form>
            </details>
          </div>
        </aside>
      </div>
    </>
  );
}
