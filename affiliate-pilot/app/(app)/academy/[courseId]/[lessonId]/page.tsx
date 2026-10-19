import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, Lightbulb, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskForm } from "@/components/academy/ask-form";
import { QuizForm } from "@/components/academy/quiz-form";
import { Blocks, headings, Inline } from "@/components/academy/rich-text";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findLesson, PASS_SCORE, syncLessons } from "@/lib/academy";
import { completeLesson, markSourceVerified, toggleChecklist } from "@/lib/actions/academy";
import { prisma } from "@/lib/db";
import { fmtDate, minutesLabel, pct } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { numberListSchema, parseJson } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ courseId: string; lessonId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { courseId, lessonId } = await params;
  return { title: findLesson(courseId, lessonId)?.lesson.title ?? "レッスン" };
}

const SOURCE_STATUS: Record<string, string> = { verified: "確認済み", unverified: "未確認", outdated: "古い可能性" };

export default async function LessonPage({ params }: Params) {
  const { courseId, lessonId } = await params;
  const found = findLesson(courseId, lessonId);
  if (!found) notFound();
  const { course, lesson, index } = found;
  const profile = await requireProfile();
  await syncLessons();
  // 開いたら「学習中」にする
  const progress = await prisma.lessonProgress.upsert({
    where: { profileId_lessonId: { profileId: profile.id, lessonId } },
    create: { profileId: profile.id, lessonId, completionStatus: "in_progress" },
    update: {},
  });
  const sources = await prisma.sourceReference.findMany({ where: { refKey: `lesson:${lessonId}` }, orderBy: { createdAt: "asc" } });
  const checked = parseJson(numberListSchema, progress.checklist, []);
  const completed = progress.completionStatus === "completed";
  const canComplete = (progress.quizScore ?? 0) >= PASS_SCORE;
  const prev = course.lessons[index - 1];
  const next = course.lessons[index + 1];

  return (
    <article className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm text-muted-foreground"><Link href="/academy" className="text-primary hover:underline">攻略大学</Link> / <Link href={`/academy/${course.id}`} className="text-primary hover:underline">{course.title}</Link> / レッスン{index + 1}</p>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{minutesLabel(lesson.estimatedMinutes)}</span>
          {completed ? <Badge variant="success">完了</Badge> : <Badge variant="secondary">学習中</Badge>}
          {progress.quizScore !== null && <span>クイズ最高 {pct(progress.quizScore, 0)}</span>}
        </p>
      </header>

      <Card className="mb-6 bg-accent/50">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="size-4" />学習目標</CardTitle></CardHeader>
        <CardContent><ul className="list-disc pl-5 text-sm">{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul></CardContent>
      </Card>

      <nav aria-label="目次" className="mb-6 rounded-xl border bg-muted/40 p-4 text-sm">
        <p className="mb-2 font-bold">目次 <span className="font-normal text-muted-foreground">（読了目安 {Math.max(1, Math.round(JSON.stringify(lesson.body).length / 500))}分）</span></p>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {headings(lesson.body).map((h) => <li key={h.id}><a href={`#${h.id}`} className="hover:text-primary hover:underline">{h.text}</a></li>)}
          <li><a href="#quiz" className="hover:text-primary hover:underline">理解度クイズ</a></li>
        </ol>
      </nav>
      <section aria-label="本文" className="mb-8"><Blocks blocks={lesson.body} /></section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Lightbulb className="size-5 text-primary" />具体例</h2>
        <div className="flex flex-col gap-3">{lesson.examples.map((e, i) => <p key={i} className="rounded-lg border-l-4 border-primary bg-card p-4 text-sm leading-relaxed"><Inline text={e} /></p>)}</div>
      </section>

      <section className="mb-8 rounded-xl border border-warning/50 bg-warning/10 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="size-5 text-warning" />注意事項</h2>
        <ul className="list-disc pl-5 text-sm">{lesson.cautions.map((c, i) => <li key={i}><Inline text={c} /></li>)}</ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">用語解説</h2>
        <dl className="grid gap-2 sm:grid-cols-2">{lesson.glossary.map((g) => <div key={g.term} className="rounded-lg border bg-card p-3 text-sm"><dt className="font-bold">{g.term}</dt><dd className="mt-1 text-muted-foreground">{g.definition}</dd></div>)}</dl>
      </section>

      <Card className="mb-8">
        <CardHeader><CardTitle>実践チェックリスト</CardTitle><CardDescription>{checked.length} / {lesson.checklist.length} 完了（チェックは保存されます）</CardDescription></CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {lesson.checklist.map((c, i) => {
              const on = checked.includes(i);
              return (
                <li key={i}>
                  <form action={toggleChecklist} className="flex items-start gap-2">
                    <input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="index" value={i} />
                    <button type="submit" role="checkbox" aria-checked={on} aria-label={c} className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border cursor-pointer", on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{on && "✓"}</button>
                    <span className={cn("text-sm", on && "text-muted-foreground line-through")}>{c}</span>
                  </form>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader><CardTitle>実践課題：{lesson.assignment.title}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="list-decimal pl-5 text-sm">{lesson.assignment.steps.map((s, i) => <li key={i} className="mb-1"><Inline text={s} /></li>)}</ol>
          <div className="flex flex-wrap gap-2">
            {lesson.actions.map((a) => <Link key={a.href + a.label} href={a.href} className={buttonVariants({ size: "sm" })}>{a.label}<ArrowRight /></Link>)}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8 scroll-mt-20" id="quiz">
        <CardHeader><CardTitle>理解度クイズ</CardTitle><CardDescription>{Math.round(PASS_SCORE * 100)}%以上でレッスンを完了できます。</CardDescription></CardHeader>
        <CardContent><QuizForm courseId={course.id} lessonId={lesson.id} quiz={lesson.quiz} passScore={PASS_SCORE} /></CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader><CardTitle>AIに質問する</CardTitle><CardDescription>このレッスンについて分からないことを聞けます。</CardDescription></CardHeader>
        <CardContent><AskForm courseId={course.id} lessonId={lesson.id} /></CardContent>
      </Card>

      {sources.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-bold">参考にした公式情報</h2>
          <p className="mb-3 text-xs text-muted-foreground">規約や条件は変わることがあります。リンク先で最新の内容を確認し、確認したら「確認済み」にしてください。</p>
          <ul className="flex flex-col gap-2 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3.5 shrink-0" /><span className="truncate">{s.title}</span></a>
                <Badge variant={s.verificationStatus === "verified" ? "success" : s.verificationStatus === "outdated" ? "warning" : "outline"}>{SOURCE_STATUS[s.verificationStatus]}</Badge>
                <span className="text-xs text-muted-foreground">最終確認日：{fmtDate(s.verifiedAt)}</span>
                <form action={markSourceVerified} className="ml-auto flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  <button name="status" value="verified" className="text-xs text-primary hover:underline cursor-pointer">確認済みにする</button>
                  <span className="text-xs text-muted-foreground">/</span>
                  <button name="status" value="outdated" className="text-xs text-muted-foreground hover:underline cursor-pointer">古い</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-4 border-t pt-6">
        <form action={completeLesson} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          {completed ? (
            <><Badge variant="success">このレッスンは完了しています</Badge><button name="undo" value="1" className="text-xs text-muted-foreground hover:underline cursor-pointer">未完了に戻す</button></>
          ) : (
            <><SubmitButton disabled={!canComplete}>レッスンを完了にする</SubmitButton>{!canComplete && <span className="text-sm text-muted-foreground">クイズで{Math.round(PASS_SCORE * 100)}%以上取ると押せます</span>}</>
          )}
        </form>
        <nav aria-label="前後のレッスン" className="flex justify-between gap-2">
          {prev ? <Link href={`/academy/${course.id}/${prev.id}`} className={buttonVariants({ variant: "outline" })}><ArrowLeft />前のレッスン</Link> : <span />}
          {next ? <Link href={`/academy/${course.id}/${next.id}`} className={buttonVariants()}>次のレッスン：{next.title.slice(0, 14)}{next.title.length > 14 && "…"}<ArrowRight /></Link> : <Link href={`/academy/${course.id}`} className={buttonVariants()}>講座のトップへ</Link>}
        </nav>
      </div>
    </article>
  );
}
