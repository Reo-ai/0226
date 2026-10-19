import { ArrowRight, Flag, GraduationCap, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { TaskList } from "@/components/task-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { replanToday } from "@/lib/actions/tasks";
import { monthSummary } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { daysBetween, fmtDate, minutesLabel, pct, yen } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { roadmapView } from "@/lib/roadmap";
import { ensureToday } from "@/lib/tasks";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const profile = await requireProfile();
  const [tasks, view, lessonsDone, lessonsTotal, recs] = await Promise.all([
    ensureToday(profile),
    roadmapView(profile),
    prisma.lessonProgress.count({ where: { profileId: profile.id, completionStatus: "completed" } }),
    prisma.lesson.count(),
    prisma.aIRecommendation.findMany({ where: { status: "open" }, orderBy: [{ priority: "asc" }, { createdAt: "desc" }], take: 3 }),
  ]);
  const target = view?.goal.targetMonthlyRevenue ?? 50_000;
  const month = await monthSummary(target);
  const planned = tasks.reduce((m, t) => m + t.estimatedMinutes, 0);
  const doneMin = tasks.filter((t) => t.status === "done").reduce((m, t) => m + t.estimatedMinutes, 0);
  const daysLeft = view ? daysBetween(new Date(), view.goal.targetDate) : null;

  return (
    <div className="flex flex-col gap-6">
      {welcome && (
        <Card className="border-primary/40 bg-accent">
          <CardContent className="flex items-start gap-3 pt-5">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm">
              ロードマップができました。下の「今日やること」を上から順に進めるだけでOKです。用語が分からないときは<Link href="/academy" className="font-medium text-primary underline">攻略大学</Link>の用語解説を見てください。
            </p>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="today-title">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="today-title" className="text-xl">今日やること</CardTitle>
              <CardDescription>
                {minutesLabel(planned)} / 作業可能時間 {minutesLabel(profile.dailyWorkMinutes)}（完了 {minutesLabel(doneMin)}）
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <form action={replanToday}><Button variant="outline" size="sm"><RefreshCw />組み直す</Button></form>
              <Link href="/coach" className={buttonVariants({ size: "sm" })}><Sparkles />AIで調整</Link>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={planned ? (doneMin / planned) * 100 : 0} aria-label="今日の進捗" />
            {tasks.length ? <TaskList tasks={tasks} /> : <EmptyState title="今日のタスクはありません" description="「組み直す」を押すと、今の状況から作業を提案します。" />}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>目標と実績（今月）</CardTitle>
            <CardDescription>目標 {yen(target)}／期限 {view ? fmtDate(view.goal.targetDate) : "—"}{daysLeft !== null && daysLeft >= 0 ? `（あと${daysLeft}日）` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">確定報酬</span>
                <span className="tabular text-2xl font-bold">{yen(month.totals.confirmedRevenue)}</span>
              </div>
              <Progress className="mt-2" value={(month.achievement ?? 0) * 100} aria-label="目標達成率" />
              <p className="mt-1 text-right text-xs text-muted-foreground">達成率 {pct(month.achievement)}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">発生報酬</dt><dd className="tabular font-semibold">{yen(month.totals.pendingRevenue)}</dd></div>
              <div className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">入金額</dt><dd className="tabular font-semibold">{yen(month.totals.paidRevenue)}</dd></div>
              <div className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">CVR</dt><dd className="tabular font-semibold">{pct(month.rates.cvr)}</dd></div>
            </dl>
            {month.rowCount === 0 && <p className="text-xs text-muted-foreground">まだ今月の記録がありません。<Link href="/analytics" className="text-primary underline">収益分析</Link>から記録できます。</p>}
            <p className="text-xs text-muted-foreground">発生報酬はASPの承認前の金額、確定報酬は承認済み、入金額は実際に振り込まれた金額です。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flag className="size-4" />{view?.roadmap.mode === "challenge30" ? "初月5万円チャレンジ" : "90日ロードマップ"}</CardTitle>
            {view?.phase && <CardDescription>{view.dayIndex + 1}日目・フェーズ{view.phase.no}「{view.phase.title}」</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {view ? (
              <>
                <Progress value={view.progress * 100} aria-label="ロードマップ進捗" />
                <p className="text-sm text-muted-foreground">マイルストーン達成率 {pct(view.progress, 0)}</p>
                {view.nextMilestone && (
                  <Link href={view.nextMilestone.href || "/roadmap"} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted">
                    <span><span className="text-xs text-muted-foreground">次のマイルストーン</span><br /><strong>{view.nextMilestone.title}</strong></span>
                    <ArrowRight className="size-4" />
                  </Link>
                )}
                <Link href={view.roadmap.mode === "challenge30" ? "/challenge" : "/roadmap"} className="text-sm font-medium text-primary hover:underline">全体を見る →</Link>
              </>
            ) : (
              <EmptyState title="ロードマップがありません" action={{ href: "/onboarding", label: "目標を設定する" }} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4" />次のアクション提案</CardTitle></CardHeader>
          <CardContent>
            {recs.length ? (
              <ul className="flex flex-col gap-3">
                {recs.map((r) => (
                  <li key={r.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2"><strong className="text-sm">{r.title}</strong><Badge variant="outline">{r.generatedBy === "fallback" ? "ルール" : "AI"}</Badge></div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">提案はまだありません。成果を記録すると、<Link href="/automation" className="text-primary underline">自動化センター</Link>で改善案を作れます。</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="size-4" />学習の進み具合</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={lessonsTotal ? (lessonsDone / lessonsTotal) * 100 : 0} aria-label="学習進捗" />
            <p className="text-sm text-muted-foreground">{lessonsDone} / {lessonsTotal} レッスン完了</p>
            <Link href="/academy" className="text-sm font-medium text-primary hover:underline">攻略大学へ →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
