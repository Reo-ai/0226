"use client";
import { CircleCheck, CircleX } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote } from "@/components/ui/states";
import { submitQuiz } from "@/lib/actions/academy";
import { cn } from "@/lib/utils";

type Q = { question: string; choices: string[]; explanation: string };

export function QuizForm({ courseId, lessonId, quiz, passScore }: { courseId: string; lessonId: string; quiz: Q[]; passScore: number }) {
  const [state, action] = useActionState(submitQuiz, null);
  const result = state && "results" in state ? state : null;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      {quiz.map((q, i) => {
        const r = result?.results[i];
        return (
          <fieldset key={i} className="rounded-lg border p-4">
            <legend className="px-1 font-medium">Q{i + 1}. {q.question}</legend>
            <div className="mt-2 flex flex-col gap-2">
              {q.choices.map((c, j) => (
                <label key={j} className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm has-checked:border-primary", r && j === r.answer && "border-success bg-success/10", r && j === r.chosen && !r.correct && "border-destructive bg-destructive/10")}>
                  <input type="radio" name={`q${i}`} value={j} required className="mt-0.5 accent-[var(--primary)]" />
                  {c}
                </label>
              ))}
            </div>
            {r && (
              <p className={cn("mt-3 flex items-start gap-2 text-sm", r.correct ? "text-success" : "text-destructive")}>
                {r.correct ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleX className="mt-0.5 size-4 shrink-0" />}
                <span><strong>{r.correct ? "正解" : "不正解"}</strong>　<span className="text-foreground">{q.explanation}</span></span>
              </p>
            )}
          </fieldset>
        );
      })}
      {state && "error" in state && <ErrorNote message={state.error} />}
      {result && (
        <p role="status" className={cn("rounded-lg p-3 text-sm font-medium", result.passed ? "bg-success/15" : "bg-warning/15")}>
          正答率 {Math.round(result.score * 100)}%　{result.passed ? "合格です。下の「レッスンを完了にする」を押してください。" : `合格は${Math.round(passScore * 100)}%以上です。解説を読んで、もう一度挑戦しましょう。`}
        </p>
      )}
      <SubmitButton className="self-start" pendingLabel="採点中…">{result ? "もう一度採点する" : "採点する"}</SubmitButton>
    </form>
  );
}
