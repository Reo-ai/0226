import Link from "next/link";
import { saveAnswer, setQuestionStatus } from "@/lib/coach-actions";
import { QUESTION_STATUS, QUESTS, type Question } from "@/lib/coach";
import { fmtDateTime } from "@/lib/format";

// 質問1件：本文を大きく、回答欄は開いたときだけ
export default function QuestionCard({ q, showStudent = true }: { q: Question; showStudent?: boolean }) {
  return (
    <article className={`q-card is-${q.status}`}>
      <div className="q-head">
        {showStudent && q.friend_id && (
          <Link href={`/coach/students/${q.friend_id}`} className="q-who">
            {q.picture_url && <img className="avatar" src={q.picture_url} alt="" />}
            {q.display_name || "(名前未取得)"}
          </Link>
        )}
        <span className={`pill s-${q.status}`}>{QUESTION_STATUS[q.status]}</span>
        {q.quest && <span className="pill">{q.quest}</span>}
        <span className="coach-space" />
        <span className="q-meta">
          {q.source === "form" ? "質問フォーム" : "LINE"}・{fmtDateTime(q.created_at)}
        </span>
      </div>
      <p className="q-body">{q.body}</p>
      {q.answer && <p className="q-answer">{q.answer}</p>}
      <details className="q-more">
        <summary>{q.answer ? "回答を直す" : "回答を書く"}</summary>
        <form action={saveAnswer} className="q-form">
          <input type="hidden" name="id" value={q.id} />
          <textarea name="answer" defaultValue={q.answer} placeholder="回答を記録します（LINEには送られません）" />
          <div className="row">
            <select name="quest" defaultValue={q.quest} aria-label="どのQUESTの質問か">
              <option value="">QUESTを選ぶ</option>
              {QUESTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <button>保存</button>
          </div>
        </form>
        <div className="row q-actions">
          {q.status !== "resolved" && <StatusButton id={q.id} status="resolved" label="解決済みにする" />}
          {q.status !== "open" && <StatusButton id={q.id} status="open" label="未回答に戻す" />}
          {q.status !== "hidden" && <StatusButton id={q.id} status="hidden" label="質問ではない" />}
        </div>
      </details>
    </article>
  );
}

function StatusButton({ id, status, label }: { id: number; status: string; label: string }) {
  return (
    <form action={setQuestionStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="ghost small">{label}</button>
    </form>
  );
}
