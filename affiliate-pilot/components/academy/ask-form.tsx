"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/states";
import { askLesson } from "@/lib/actions/academy";

export function AskForm({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [state, action] = useActionState(askLesson, null);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="lessonId" value={lessonId} />
        <Textarea name="question" aria-label="質問" placeholder="例: 承認率が低い案件はどう判断すればいい？" required maxLength={500} className="min-h-16" />
        <SubmitButton size="sm" variant="outline" className="self-start" pendingLabel="考え中…">AIに質問する</SubmitButton>
      </form>
      {state?.error && <ErrorNote message={state.error} />}
      {state?.answer && (
        <div className="rounded-lg bg-muted p-3 text-sm" aria-live="polite">
          <p className="whitespace-pre-wrap">{state.answer}</p>
          {state.related && state.related.length > 0 && <p className="mt-2 text-xs text-muted-foreground">関連：{state.related.join("・")}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{state.by === "fallback" ? "レッスン内検索による回答" : "AIの回答（誤りがある可能性があります。最新の条件は公式で確認してください）"}</p>
        </div>
      )}
    </div>
  );
}
