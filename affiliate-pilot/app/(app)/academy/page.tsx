import { BookOpen, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { COURSES, syncLessons } from "@/lib/academy";
import { prisma } from "@/lib/db";
import { minutesLabel } from "@/lib/format";
import { requireProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "アフィリエイト攻略大学" };

export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const profile = await requireProfile();
  await syncLessons();
  const done = new Set((await prisma.lessonProgress.findMany({ where: { profileId: profile.id, completionStatus: "completed" }, select: { lessonId: true } })).map((p) => p.lessonId));
  const total = COURSES.reduce((n, c) => n + c.lessons.length, 0);
  const glossary = COURSES.flatMap((c) => c.lessons.flatMap((l) => l.glossary.map((g) => ({ ...g, courseId: c.id, lessonId: l.id, lessonTitle: l.title }))));
  const uniq = [...new Map(glossary.map((g) => [g.term, g])).values()].sort((a, b) => a.term.localeCompare(b.term, "ja"));
  const terms = q ? uniq.filter((g) => g.term.includes(q) || g.definition.includes(q)) : uniq;

  return (
    <>
      <PageHeader title="アフィリエイト攻略大学" description={`基礎から応用まで全${COURSES.length}講座・${total}レッスン。AIに接続していなくても読めます。各レッスンのクイズで${80}%以上取ると修了です。`} />
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="flex justify-between text-sm"><span>全体の進み具合</span><span className="tabular">{done.size} / {total} レッスン</span></div>
          <Progress className="mt-2" value={(done.size / total) * 100} aria-label="全体の学習進捗" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {COURSES.map((c) => {
          const n = c.lessons.filter((l) => done.has(l.id)).length;
          const minutes = c.lessons.reduce((m, l) => m + l.estimatedMinutes, 0);
          const complete = n === c.lessons.length;
          return (
            <Link key={c.id} href={`/academy/${c.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>第{c.no}講座</span><Badge variant="outline">{c.level}</Badge><span>{minutesLabel(minutes)}</span>{complete && <Badge variant="success"><CircleCheck className="size-3" />修了</Badge>}</div>
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{c.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={(n / c.lessons.length) * 100} aria-label={`${c.title}の進捗`} />
                  <p className="mt-1 text-xs text-muted-foreground">{n} / {c.lessons.length} レッスン</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <section id="glossary" className="mt-10">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><BookOpen className="size-5" />用語解説</h2>
        <p className="mb-3 text-sm text-muted-foreground">講座に出てくる用語をまとめています（{uniq.length}語）。</p>
        <form className="mb-4 max-w-sm" role="search"><Input name="q" defaultValue={q} placeholder="用語を検索（例: CVR、承認率）" aria-label="用語を検索" /></form>
        <dl className="grid gap-3 md:grid-cols-2">
          {terms.slice(0, q ? 100 : 40).map((g) => (
            <div key={g.term} className="rounded-lg border bg-card p-3 text-sm">
              <dt className="font-bold">{g.term}</dt>
              <dd className="mt-1 text-muted-foreground">{g.definition}<Link href={`/academy/${g.courseId}/${g.lessonId}`} className="ml-1 text-primary hover:underline">→ {g.lessonTitle}</Link></dd>
            </div>
          ))}
        </dl>
        {!q && uniq.length > 40 && <p className="mt-2 text-sm text-muted-foreground">ほかの用語は検索して表示できます。</p>}
        {q && terms.length === 0 && <p className="text-sm text-muted-foreground">「{q}」に一致する用語はありません。</p>}
      </section>
    </>
  );
}
