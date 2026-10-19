import { CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { toggleMilestone } from "@/lib/actions/roadmap";
import { addDays, fmtDate, pct } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { roadmapView } from "@/lib/roadmap";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "90日ロードマップ" };

export default async function RoadmapPage() {
  const profile = await requireProfile();
  const view = await roadmapView(profile);
  if (!view) return <EmptyState title="ロードマップがありません" action={{ href: "/onboarding", label: "目標を設定する" }} />;
  const isChallenge = view.roadmap.mode === "challenge30";
  return (
    <>
      <PageHeader
        title={isChallenge ? "30日チャレンジ計画" : "90日攻略ロードマップ"}
        description={`${fmtDate(view.roadmap.startDate)} 〜 ${fmtDate(view.roadmap.endDate)}（今日は${view.dayIndex + 1}日目）。マイルストーンはデータから自動で判定し、判定できないものは手動でチェックできます。`}
      />
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="flex items-baseline justify-between text-sm"><span>全体の達成率</span><strong className="tabular text-lg">{pct(view.progress, 0)}</strong></div>
          <Progress className="mt-2" value={view.progress * 100} aria-label="ロードマップ全体の達成率" />
        </CardContent>
      </Card>
      <ol className="flex flex-col gap-4">
        {view.phases.map((p) => {
          const current = view.phase?.no === p.no;
          const past = view.dayIndex > p.endDay;
          return (
            <li key={p.no}>
              <Card className={cn(current && "border-primary ring-1 ring-primary/30")}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>フェーズ{p.no}：{p.title}</CardTitle>
                    {current && <Badge>いまここ</Badge>}
                    {past && <Badge variant="outline">期間終了</Badge>}
                  </div>
                  <CardDescription>
                    {p.startDay + 1}〜{p.endDay + 1}日目（{fmtDate(addDays(view.roadmap.startDate, p.startDay))}〜{fmtDate(addDays(view.roadmap.startDate, p.endDay))}）／{p.goal}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {p.milestones.map((m) => (
                      <li key={m.key} className="flex items-center gap-3">
                        <form action={toggleMilestone}>
                          <input type="hidden" name="key" value={`${view.roadmap.id}:${m.key}`} />
                          <button type="submit" aria-label={`「${m.title}」のチェックを切り替える`} className="text-primary cursor-pointer">
                            {m.done ? <CircleCheck className="size-5" /> : <Circle className="size-5 text-muted-foreground" />}
                          </button>
                        </form>
                        <span className={cn("text-sm", m.done && "text-muted-foreground line-through")}>{m.title}</span>
                        {!m.done && m.href && <Link href={m.href} className="ml-auto text-xs font-medium text-primary hover:underline">進める →</Link>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}
