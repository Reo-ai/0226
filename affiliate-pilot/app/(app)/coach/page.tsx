import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { TaskList } from "@/components/task-list";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { askCoachAction } from "@/lib/actions/coach";
import { addManualTask, aiReplanToday } from "@/lib/actions/tasks";
import { monthSummary } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { fmtDateTime, minutesLabel, pct, yen } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { evidenceSchema, parseJson, stringListSchema } from "@/lib/schemas";
import { ensureToday } from "@/lib/tasks";
import { activeGoal } from "@/lib/profile";

export const metadata: Metadata = { title: "AI司令塔" };
export const maxDuration = 300;

const coachEvidence = evidenceSchema.extend({ nextActions: stringListSchema.default([]) });

export default async function CoachPage() {
  const profile = await requireProfile();
  const [tasks, goal, answers, backlog, weekly] = await Promise.all([
    ensureToday(profile),
    activeGoal(profile.id),
    prisma.aIRecommendation.findMany({ where: { recommendationType: "coach" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.task.findMany({ where: { profileId: profile.id, status: "todo", taskDate: null }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], take: 10 }),
    prisma.automationJob.findFirst({ where: { jobType: "weekly_report", status: { in: ["completed", "awaiting_review", "approved"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const target = goal?.targetMonthlyRevenue ?? 50_000;
  const month = await monthSummary(target);
  const planned = tasks.reduce((m, t) => m + t.estimatedMinutes, 0);

  return (
    <>
      <PageHeader title="AI司令塔" description="進捗と実績から、今日の作業を優先度順に並べます。AIに接続していなくても、ルールで計画を作ります。" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>今日のタスク</CardTitle>
              <CardDescription>{minutesLabel(planned)} / {minutesLabel(profile.dailyWorkMinutes)}（作業可能時間を超えないように選んでいます）</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {tasks.length ? <TaskList tasks={tasks} /> : <EmptyState title="今日のタスクはありません" />}
              <ActionForm action={aiReplanToday} className="rounded-lg border p-3">
                <Field label="AIに今日の計画を組み直してもらう" htmlFor="note" hint="手動で追加したタスクは残し、残りの時間に提案を詰めます">
                  <Textarea id="note" name="note" placeholder="例: 今日は30分しかない／動画を作りたい／案件選びで迷っている" className="min-h-16" />
                </Field>
                <SubmitButton className="self-start" pendingLabel="考え中…（ローカルAIは1〜2分かかることがあります）">組み直す</SubmitButton>
              </ActionForm>
              <ActionForm action={addManualTask} resetOnSuccess className="rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                  <Field label="自分でタスクを追加" htmlFor="title"><Input id="title" name="title" placeholder="例: プロフィール画像を変える" required /></Field>
                  <Field label="分" htmlFor="estimatedMinutes"><Input id="estimatedMinutes" name="estimatedMinutes" inputMode="numeric" defaultValue="15" className="w-20" /></Field>
                  <Field label="優先度" htmlFor="priority">
                    <Select id="priority" name="priority" defaultValue="3">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
                  </Field>
                  <SubmitButton variant="outline">追加</SubmitButton>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          {backlog.length > 0 && (
            <Card>
              <CardHeader><CardTitle>持ち越しのタスク</CardTitle><CardDescription>今日の時間に入りきらなかったもの。明日以降に自動で組み込みます。</CardDescription></CardHeader>
              <CardContent><TaskList tasks={backlog} /></CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>目標と実績</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">目標（月）</dt><dd className="tabular text-lg font-bold">{yen(target)}</dd></div>
                <div><dt className="text-muted-foreground">今月の確定報酬</dt><dd className="tabular text-lg font-bold">{yen(month.totals.confirmedRevenue)}</dd></div>
                <div><dt className="text-muted-foreground">達成率</dt><dd className="tabular font-semibold">{pct(month.achievement)}</dd></div>
                <div><dt className="text-muted-foreground">1時間あたり確定報酬</dt><dd className="tabular font-semibold">{yen(month.rates.confirmedPerHour)}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>AIコーチに質問</CardTitle><CardDescription>今の進捗と実績を踏まえて答えます。</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ActionForm action={askCoachAction} resetOnSuccess>
                <Textarea name="question" aria-label="質問" placeholder="例: クリックはあるのに成約しません。何から見直せばいい？" required maxLength={1000} />
                <SubmitButton className="self-start" pendingLabel="考え中…">質問する</SubmitButton>
              </ActionForm>
              {answers.map((a) => {
                const ev = parseJson(coachEvidence, a.evidence, { facts: [], hypotheses: [], nextActions: [] });
                return (
                  <article key={a.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="line-clamp-1">Q. {a.title}</strong>
                      <Badge variant="outline">{a.generatedBy === "fallback" ? "ルール" : "AI"}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{a.description}</p>
                    {ev.nextActions.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">{ev.nextActions.map((x) => <li key={x}>{x}</li>)}</ul>
                    )}
                    {(ev.facts.length > 0 || ev.hypotheses.length > 0) && (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">根拠（実績データ／仮説）</summary>
                        {ev.facts.length > 0 && <p className="mt-1"><strong>実績データ：</strong>{ev.facts.join("／")}</p>}
                        {ev.hypotheses.length > 0 && <p className="mt-1"><strong>仮説：</strong>{ev.hypotheses.join("／")}</p>}
                      </details>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</p>
                  </article>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>週次振り返り</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {weekly ? (
                <p>最新の週次レポート：{fmtDateTime(weekly.completedAt ?? weekly.createdAt)}　<Link href={`/automation?job=${weekly.id}`} className="font-medium text-primary underline">開く</Link></p>
              ) : (
                <p className="text-muted-foreground">まだありません。<Link href="/automation" className="text-primary underline">自動化センター</Link>で作成できます。</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
