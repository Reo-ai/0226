import { AlertTriangle, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Simulator } from "@/components/simulator";
import { TaskList } from "@/components/task-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { records } from "@/lib/analytics";
import { READINESS_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { daysBetween, fmtDate, num, pct, yen } from "@/lib/format";
import { goalAchievement, simulate, totals } from "@/lib/metrics";
import { activeGoal, requireProfile } from "@/lib/profile";
import { roadmapView } from "@/lib/roadmap";
import { evidenceSchema, parseJson, stringListSchema } from "@/lib/schemas";
import { ensureToday } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { StartChallengeForm } from "./start-form";

export const metadata: Metadata = { title: "初月5万円チャレンジ" };
export const maxDuration = 300;

const recEvidence = evidenceSchema.extend({ nextActions: stringListSchema.default([]) });

export default async function ChallengePage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams;
  const profile = await requireProfile();
  const goal = await activeGoal(profile.id);
  const challenge = goal?.challengeMode ? await prisma.challenge.findUnique({ where: { goalId: goal.id }, include: { offer: true } }) : null;

  if (!challenge || start === "new") {
    const [offers, account] = await Promise.all([
      prisma.affiliateOffer.findMany({ where: { partnershipStatus: { in: ["approved", "applied", "candidate"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, commissionAmount: true, approvalRate: true } }),
      prisma.channelAccount.findFirst({ where: { profileId: profile.id }, orderBy: { monthlyImpressions: "desc" } }),
    ]);
    return (
      <>
        <PageHeader title="初月5万円チャレンジ" description="すでに集客できているアカウント向けの30日間モード。今の数字を入力すると、収益化の準備状況を診断し、30日間の行動計画と今日のタスクを作ります。" />
        <Card className="mb-6">
          <CardHeader><CardTitle>チャレンジを始める</CardTitle><CardDescription>分からない項目は空欄でOK（未計測として扱います）。</CardDescription></CardHeader>
          <CardContent><StartChallengeForm offers={offers} account={account ?? undefined} dailyWorkMinutes={profile.dailyWorkMinutes} niche={profile.niche} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>逆算シミュレーター</CardTitle><CardDescription>目標から、必要な表示回数・クリック数・成約数を逆算します。</CardDescription></CardHeader>
          <CardContent><Simulator /></CardContent>
        </Card>
      </>
    );
  }

  const end = new Date(challenge.startDate.getTime() + 30 * 86_400_000);
  const [rows, tasks, view, recs] = await Promise.all([
    records(challenge.startDate, end),
    ensureToday(profile),
    roadmapView(profile, "challenge30"),
    prisma.aIRecommendation.findMany({ where: { recommendationType: { in: ["challenge", "analytics", "weekly"] }, status: "open" }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const t = totals(rows);
  const target = goal!.targetMonthlyRevenue;
  const daysLeft = Math.max(0, 29 - daysBetween(challenge.startDate, new Date()));
  const sim = simulate({
    targetConfirmedRevenue: target,
    confirmedPerConversion: challenge.commissionPerApproval,
    approvalRate: challenge.approvalRate,
    cvr: challenge.cvr,
    ctr: challenge.ctr,
  });
  const achievement = goalAchievement(t.confirmedRevenue, target);

  return (
    <>
      <PageHeader
        title="初月5万円チャレンジ"
        description={`${fmtDate(challenge.startDate)}開始・あと${daysLeft}日。計算上の必要数と実績は分けて表示しています。`}
        actions={<Link href="/challenge?start=new" className="text-sm text-primary hover:underline">条件を変えて始め直す</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">月間目標</p><p className="tabular text-2xl font-bold">{yen(target)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">現在の確定報酬（実績）</p><p className="tabular text-2xl font-bold">{yen(t.confirmedRevenue)}</p><Progress className="mt-2" value={(achievement ?? 0) * 100} aria-label="目標達成率" /><p className="mt-1 text-xs text-muted-foreground">達成率 {pct(achievement)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">現在の発生報酬（実績・未確定）</p><p className="tabular text-2xl font-bold">{yen(t.pendingRevenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">残り日数</p><p className="tabular text-2xl font-bold">{daysLeft}日</p></CardContent></Card>
      </div>

      {challenge.approvalTimingNote ? (
        <p className="mb-6 rounded-lg border bg-muted/50 p-3 text-sm">報酬の承認時期：{challenge.approvalTimingNote}</p>
      ) : (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          報酬の承認時期が未確認です。承認まで時間がかかる案件では、30日以内に確定報酬が発生しないことがあります。ASPの案件ページで確認してください。
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>必要数（計算）と実績</CardTitle><CardDescription>必要数は開始時の仮定（報酬{yen(challenge.commissionPerApproval)}・CTR {pct(challenge.ctr, 2)}・CVR {pct(challenge.cvr, 2)}・承認率 {pct(challenge.approvalRate, 0)}）によるシミュレーションです。</CardDescription></CardHeader>
            <CardContent>
              {sim.ok ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">指標</th><th className="py-1 text-right">必要数（計算）</th><th className="py-1 text-right">実績</th><th className="py-1 text-right">進み具合</th></tr></thead>
                  <tbody className="tabular">
                    {[
                      ["表示回数", sim.impressions, t.impressions],
                      ["クリック数", sim.clicks, t.clicks],
                      ["発生成約数", sim.conversions, t.conversions],
                      ["承認済み成約数", sim.approvedConversions, t.approvedConversions],
                    ].map(([l, need, act]) => (
                      <tr key={l as string} className="border-t">
                        <td className="py-2">{l}</td>
                        <td className="py-2 text-right">{num(need as number)}</td>
                        <td className="py-2 text-right">{num(act as number | null)}</td>
                        <td className="py-2 text-right">{pct(act === null ? null : (act as number) / (need as number), 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">必要数を計算できません（{sim.missing.join("・")}が未入力）。下のシミュレーターで仮定を入れて確認するか、<Link href="/challenge?start=new" className="text-primary underline">条件を入れ直して</Link>ください。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>今日のタスク</CardTitle></CardHeader>
            <CardContent><TaskList tasks={tasks} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>30日間の行動計画</CardTitle></CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {view?.phases.map((p) => (
                  <li key={p.no} className={cn("rounded-lg border p-3", view.phase?.no === p.no && "border-primary")}>
                    <div className="flex flex-wrap items-center gap-2"><strong>第{p.no}週：{p.title}</strong>{view.phase?.no === p.no && <Badge>今週</Badge>}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{p.goal}</p>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {p.milestones.map((m) => (
                        <li key={m.key} className="flex items-center gap-2">
                          {m.done ? <CircleCheck className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
                          <Link href={m.href || "/challenge"} className={cn("hover:underline", m.done && "text-muted-foreground line-through")}>{m.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>現状分析</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Badge variant={challenge.readiness === "ready" ? "success" : "warning"} className="self-start">{READINESS_LABEL[challenge.readiness]}</Badge>
              <dl className="grid grid-cols-2 gap-2">
                <div><dt className="text-xs text-muted-foreground">開始時の表示回数</dt><dd className="tabular">{num(challenge.impressions30d)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">開始時のクリック</dt><dd className="tabular">{num(challenge.clicks30d)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">紹介案件</dt><dd>{challenge.offer?.name ?? "未定"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">1日の作業</dt><dd>{challenge.dailyWorkMinutes}分</dd></div>
              </dl>
              {challenge.readiness === "offer" && <Link href="/offers" className="font-medium text-primary hover:underline">案件を選ぶ →</Link>}
              {challenge.readiness === "funnel" && <Link href="/academy/sales" className="font-medium text-primary hover:underline">収益導線の作り方を学ぶ →</Link>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>直近の改善提案</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {recs.length === 0 && <p className="text-sm text-muted-foreground">成果を記録すると、自動化センターで改善案を作れます。</p>}
              {recs.map((r) => {
                const ev = parseJson(recEvidence, r.evidence, { facts: [], hypotheses: [], nextActions: [] });
                return (
                  <article key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2"><strong>{r.title}</strong><Badge variant="outline">{r.generatedBy === "fallback" ? "ルール" : "AI"}</Badge></div>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.description}</p>
                    {ev.nextActions.length > 0 && <ul className="mt-2 list-disc pl-5">{ev.nextActions.map((a) => <li key={a}>{a}</li>)}</ul>}
                    {ev.hypotheses.length > 0 && <p className="mt-2 text-xs text-muted-foreground">仮説：{ev.hypotheses.join("／")}</p>}
                  </article>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>逆算シミュレーター</CardTitle><CardDescription>仮定を変えて試せます（保存はされません）。</CardDescription></CardHeader>
            <CardContent>
              <Simulator compact defaults={{ target, commission: challenge.commissionPerApproval, ctr: challenge.ctr, cvr: challenge.cvr, approval: challenge.approvalRate, impressions: challenge.impressions30d, clicks: challenge.clicks30d }} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
