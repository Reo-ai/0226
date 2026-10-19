import { CircleCheck, Circle, CircleDot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { findCourse, syncLessons } from "@/lib/academy";
import { prisma } from "@/lib/db";
import { minutesLabel, pct } from "@/lib/format";
import { requireProfile } from "@/lib/profile";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }): Promise<Metadata> {
  return { title: findCourse((await params).courseId)?.title ?? "講座" };
}

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = findCourse(courseId);
  if (!course) notFound();
  const profile = await requireProfile();
  await syncLessons();
  const progress = await prisma.lessonProgress.findMany({ where: { profileId: profile.id, lesson: { courseId } } });
  const by = new Map(progress.map((p) => [p.lessonId, p]));
  const done = course.lessons.filter((l) => by.get(l.id)?.completionStatus === "completed").length;
  const next = course.lessons.find((l) => by.get(l.id)?.completionStatus !== "completed");

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/academy" className="text-primary hover:underline">攻略大学</Link> / 第{course.no}講座</p>
      <PageHeader title={course.title} description={course.summary} actions={next && <Link href={`/academy/${course.id}/${next.id}`} className={buttonVariants()}>{done ? "続きから学ぶ" : "学習を始める"}</Link>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader><CardTitle>レッスン一覧</CardTitle></CardHeader>
          <CardContent>
            <ol className="flex flex-col divide-y">
              {course.lessons.map((l, i) => {
                const p = by.get(l.id);
                const status = p?.completionStatus ?? "not_started";
                return (
                  <li key={l.id}>
                    <Link href={`/academy/${course.id}/${l.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                      {status === "completed" ? <CircleCheck className="size-5 shrink-0 text-success" /> : status === "in_progress" ? <CircleDot className="size-5 shrink-0 text-primary" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0 flex-1"><span className="text-xs text-muted-foreground">レッスン{i + 1}</span><br /><span className="font-medium">{l.title}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{minutesLabel(l.estimatedMinutes)}{p?.quizScore != null && `・クイズ ${pct(p.quizScore, 0)}`}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>進み具合</CardTitle></CardHeader>
            <CardContent>
              <Progress value={(done / course.lessons.length) * 100} aria-label="講座の進捗" />
              <p className="mt-2 text-sm text-muted-foreground">{done} / {course.lessons.length} レッスン完了{done === course.lessons.length && "・修了しました"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>この講座で学べること</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex gap-2"><Badge variant="outline">{course.level}</Badge><span className="text-muted-foreground">{minutesLabel(course.lessons.reduce((m, l) => m + l.estimatedMinutes, 0))}</span></div>
              <ul className="list-disc pl-5">{course.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
              <p><strong>修了条件：</strong>{course.completion}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>関連ツール</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {course.tools.map((t) => <Link key={t.href + t.label} href={t.href} className={buttonVariants({ variant: "outline", size: "sm" })}>{t.label}</Link>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
