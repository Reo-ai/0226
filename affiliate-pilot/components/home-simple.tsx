import { ArrowRight, CircleCheck, Flame, GraduationCap, Lightbulb, MessageCircleQuestion, PartyPopper, SkipForward } from "lucide-react";
import Link from "next/link";
import { setTaskStatus } from "@/lib/actions/tasks";
import { minutesLabel, pct, yen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskList } from "./task-list";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

type Task = { id: string; title: string; description: string; priority: number; estimatedMinutes: number; status: string; relatedFeature: string; source: string };

/** 初心者向けのホーム：今日の1歩を大きく、進み具合は4段階で */
type Rec = { id: string; title: string; description: string };

export function HomeSimple({ tasks, stage, stageLabels, confirmed, target, streak, dailyMinutes, recs }: {
  tasks: Task[]; stage: number; stageLabels: string[]; confirmed: number | null; target: number; streak: number; dailyMinutes: number; recs: Rec[];
}) {
  const todo = tasks.filter((t) => t.status === "todo");
  const next = todo[0];
  const rest = tasks.filter((t) => t !== next);
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const remaining = Math.max(0, target - (confirmed ?? 0));

  return (
    <div className="fade-in mx-auto flex max-w-3xl flex-col gap-6">
      <ol className="grid grid-cols-4 gap-1 text-center text-xs" aria-label="いまの段階">
        {stageLabels.map((l, i) => {
          const n = i + 1;
          return (
            <li key={l} className={cn("rounded-lg border px-1 py-2", n < stage && "border-success/50 bg-success/10 text-success", n === stage && "border-primary bg-accent font-bold", n > stage && "text-muted-foreground")}>
              <span className="block text-[10px]">{n < stage ? "済み" : n === stage ? "いまここ" : `${n}段階目`}</span>{l}
            </li>
          );
        })}
      </ol>

      <Card className="overflow-hidden border-primary/40">
        <CardHeader className="bg-gradient-to-r from-accent/70 to-transparent">
          <CardTitle className="text-2xl">今日やること</CardTitle>
          <CardDescription>
            {doneCount}/{tasks.length}件 完了・1日の目安 {minutesLabel(dailyMinutes)}
            {streak > 0 && <span className="ml-2 inline-flex items-center gap-1 text-warning"><Flame className="size-3.5" />{streak}日連続</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {next ? (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">今日の1歩</p>
              <h2 className="text-xl font-bold leading-snug">{next.title}</h2>
              {next.description && <p className="text-muted-foreground">{next.description}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {next.relatedFeature && <Link href={next.relatedFeature} className={cn(buttonVariants({ size: "lg" }), "text-base")}>これをやる<ArrowRight /></Link>}
                <form action={setTaskStatus}><input type="hidden" name="id" value={next.id} /><input type="hidden" name="status" value="done" /><Button variant="outline" size="lg" aria-label={`「${next.title}」を完了にする`}><CircleCheck />できた</Button></form>
                <form action={setTaskStatus}><input type="hidden" name="id" value={next.id} /><input type="hidden" name="status" value="skipped" /><Button variant="ghost" size="lg" aria-label={`「${next.title}」を今日は見送る`}><SkipForward />今日は見送る</Button></form>
                <span className="text-sm text-muted-foreground">目安 {minutesLabel(next.estimatedMinutes)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4">
              <PartyPopper className="size-6 shrink-0 text-success" />
              <p><strong>今日の分は終わりました。</strong>おつかれさまでした。余裕があれば、下の「学ぶ」で1レッスン進めるのもおすすめです。</p>
            </div>
          )}
          {rest.length > 0 && (
            <details className="mt-5 group" open={!next || doneCount > 0}>
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">そのほかの今日のタスク（{rest.length}件）</summary>
              <TaskList tasks={rest} />
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>今月の成果</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">確定した報酬</span>
            <span className="tabular text-3xl font-bold">{yen(confirmed)}</span>
          </div>
          <Progress className="h-3" value={target ? ((confirmed ?? 0) / target) * 100 : 0} aria-label="目標達成率" />
          <p className="text-sm text-muted-foreground">目標 {yen(target)}（達成率 {pct(target ? (confirmed ?? 0) / target : null, 0)}）。{remaining > 0 ? `あと ${yen(remaining)}。` : "目標に到達しました。"}報酬は、申し込みが「承認」されてから確定します。</p>
          <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">成果を記録する →</Link>
        </CardContent>
      </Card>

      {recs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-primary" />次のアクション提案</CardTitle><CardDescription>記録した成果をもとにした、改善のヒントです</CardDescription></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {recs.map((r) => (
                <li key={r.id} className="rounded-lg border p-3"><strong className="text-sm">{r.title}</strong><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/academy" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary"><GraduationCap className="size-6 text-primary" /><span><strong className="block">学ぶ</strong><span className="text-xs text-muted-foreground">用語や手順が分からないとき</span></span></Link>
        <Link href="/coach" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary"><MessageCircleQuestion className="size-6 text-primary" /><span><strong className="block">AIに相談</strong><span className="text-xs text-muted-foreground">次に何をするか迷ったとき</span></span></Link>
        <Link href="/roadmap" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary"><ArrowRight className="size-6 text-primary" /><span><strong className="block">90日ロードマップ</strong><span className="text-xs text-muted-foreground">全体の道のりを見る</span></span></Link>
      </div>
    </div>
  );
}
