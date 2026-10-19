import { ArrowRight, Flag, Flame, GraduationCap, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { KpiTile } from "@/components/kpi-tile";
import { ProgressRing } from "@/components/progress-ring";
import { TaskList } from "@/components/task-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { replanToday } from "@/lib/actions/tasks";
import { dailySeries, delta, groupTotals, monthSummary, totalsBetween } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { addDays, dateKey, daysBetween, fmtDate, jstDay, jstMonthStart, minutesLabel, pct, yen } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { roadmapView } from "@/lib/roadmap";
import { ensureToday } from "@/lib/tasks";
import { getUiMode } from "@/lib/ui-mode";
import { HomeSimple } from "@/components/home-simple";

/** 連続で記録した日数（今日か昨日から数える） */
function streak(days: Set<string>, today: Date): number {
  let d = days.has(dateKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(dateKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const profile = await requireProfile();
  const today = jstDay();
  const monthStart = jstMonthStart();
  const prevStart = jstMonthStart(addDays(monthStart, -1));
  const [tasks, view, lessonsDone, lessonsTotal, recs, prev, spark, recentDays] = await Promise.all([
    ensureToday(profile),
    roadmapView(profile),
    prisma.lessonProgress.count({ where: { profileId: profile.id, completionStatus: "completed" } }),
    prisma.lesson.count(),
    prisma.aIRecommendation.findMany({ where: { status: "open" }, orderBy: [{ priority: "asc" }, { createdAt: "desc" }], take: 3 }),
    totalsBetween(prevStart, monthStart),
    dailySeries(addDays(today, -29), 30),
    groupTotals("day", addDays(today, -60)),
  ]);
  const target = view?.goal.targetMonthlyRevenue ?? 50_000;
  const month = await monthSummary(target);
  const planned = tasks.reduce((m, t) => m + t.estimatedMinutes, 0);
  const doneMin = tasks.filter((t) => t.status === "done").reduce((m, t) => m + t.estimatedMinutes, 0);
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const daysLeft = view ? daysBetween(new Date(), view.goal.targetDate) : null;
  const recordStreak = streak(new Set(recentDays.map((g) => g.key)), today);

  if ((await getUiMode()) === "simple") {
    const labels = view?.roadmap.mode === "challenge30" ? ["導線づくり", "作る", "改善", "集中"] : ["土台づくり", "案件を選ぶ", "発信する", "改善する"];
    return (
      <>
        {welcome && (
          <Card className="mx-auto mb-6 max-w-3xl border-primary/40 bg-accent">
            <CardContent className="flex items-start gap-3 pt-5"><Sparkles className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm">準備ができました。「今日の1歩」から始めましょう。分からない言葉は右上の「?」か「学ぶ」で調べられます。</p></CardContent>
          </Card>
        )}
        <HomeSimple tasks={tasks} stage={view?.phase?.no ?? 1} stageLabels={labels} confirmed={month.totals.confirmedRevenue} target={target} streak={recordStreak} dailyMinutes={profile.dailyWorkMinutes} recs={recs} />
      </>
    );
  }

  return (
    <div className="fade-in flex flex-col gap-6">
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
        <Card className="overflow-hidden">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-accent/60 to-transparent pb-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={planned ? doneMin / planned : 0} label="今日の進捗" sub={`${doneCount}/${tasks.length}件`} />
              <div>
                <CardTitle id="today-title" className="text-2xl">今日やること</CardTitle>
                <CardDescription className="mt-1">
                  予定 {minutesLabel(planned)} ／ 作業可能 {minutesLabel(profile.dailyWorkMinutes)}
                  {recordStreak > 0 && <span className="ml-2 inline-flex items-center gap-1 text-warning"><Flame className="size-3.5" />{recordStreak}日連続で記録中</span>}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={replanToday}><Button variant="outline" size="sm"><RefreshCw />組み直す</Button></form>
              <Link href="/coach" className={buttonVariants({ size: "sm" })}><Sparkles />AIで調整</Link>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length ? <TaskList tasks={tasks} /> : <EmptyState title="今日のタスクはありません" description="「組み直す」を押すと、今の状況から作業を提案します。" />}
          </CardContent>
        </Card>
      </section>

      <section aria-label="今月の実績" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="確定報酬（今月）" help="confirmed" value={yen(month.totals.confirmedRevenue)} delta={delta(month.totals.confirmedRevenue, prev.confirmedRevenue)} deltaLabel="先月比" spark={spark.map((d) => d.confirmed)} hint="先月の記録がないため比較なし" />
        <KpiTile label="発生報酬（承認前）" help="pending" value={yen(month.totals.pendingRevenue)} delta={delta(month.totals.pendingRevenue, prev.pendingRevenue)} deltaLabel="先月比" spark={spark.map((d) => d.pending)} sparkColor="var(--chart-2)" hint="先月の記録がないため比較なし" />
        <KpiTile label="クリック（今月）" value={month.totals.clicks === null ? "未計測" : month.totals.clicks.toLocaleString("ja-JP")} delta={delta(month.totals.clicks, prev.clicks)} deltaLabel="先月比" spark={spark.map((d) => d.clicks)} sparkColor="var(--chart-3)" hint="先月の記録がないため比較なし" />
        <KpiTile label="目標達成率" value={pct(month.achievement)} hint={`目標 ${yen(target)}${daysLeft !== null && daysLeft >= 0 ? `・あと${daysLeft}日` : ""}`} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>目標と実績（今月）</CardTitle>
            <CardDescription>目標 {yen(target)}／期限 {view ? fmtDate(view.goal.targetDate) : "—"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">確定報酬</span>
                <span className="tabular text-3xl font-bold">{yen(month.totals.confirmedRevenue)}</span>
              </div>
              <Progress className="mt-2 h-3" value={(month.achievement ?? 0) * 100} aria-label="目標達成率" />
              <p className="mt-1 text-right text-xs text-muted-foreground">達成率 {pct(month.achievement)}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">入金額</dt><dd className="tabular font-semibold">{yen(month.totals.paidRevenue)}</dd></div>
              <div className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">CVR</dt><dd className="tabular font-semibold">{pct(month.rates.cvr)}</dd></div>
              <div className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">承認率</dt><dd className="tabular font-semibold">{pct(month.rates.approvalRate, 0)}</dd></div>
            </dl>
            {month.rowCount === 0 && <p className="text-xs text-muted-foreground">まだ今月の記録がありません。<Link href="/analytics" className="text-primary underline">収益分析</Link>から記録できます。</p>}
            <p className="text-xs text-muted-foreground">発生報酬はASPの承認前の金額、確定報酬は承認済み、入金額は実際に振り込まれた金額です。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flag className="size-4 text-primary" />{view?.roadmap.mode === "challenge30" ? "初月5万円チャレンジ" : "90日ロードマップ"}</CardTitle>
            {view?.phase && <CardDescription>{view.dayIndex + 1}日目・フェーズ{view.phase.no}「{view.phase.title}」</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {view ? (
              <>
                <div className="flex items-center gap-4">
                  <ProgressRing value={view.progress} size={72} stroke={7} label="ロードマップ進捗" />
                  <div className="text-sm">
                    <p>マイルストーン達成率 <strong className="tabular">{pct(view.progress, 0)}</strong></p>
                    <p className="text-muted-foreground">{view.totalDays - view.dayIndex - 1 > 0 ? `残り ${view.totalDays - view.dayIndex - 1}日` : "期間終了"}</p>
                  </div>
                </div>
                {view.nextMilestone && (
                  <Link href={view.nextMilestone.href || "/roadmap"} className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:border-primary hover:bg-accent/40">
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
          <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-primary" />次のアクション提案</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="size-4 text-primary" />学習の進み具合</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <ProgressRing value={lessonsTotal ? lessonsDone / lessonsTotal : 0} size={72} stroke={7} label="学習進捗" />
              <p className="text-sm">{lessonsDone} / {lessonsTotal} レッスン完了<br /><Link href="/academy" className="font-medium text-primary hover:underline">攻略大学へ →</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
