import { Loader2, RotateCcw, Square, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState, Notice } from "@/components/ui/states";
import { approveJob, cancelJobAction, deleteJob, deleteTemplate, rerunJobAction, runJobAction, saveTemplate, setJobStatus, setRecommendationStatus } from "@/lib/actions/automation";
import { improvementSchema, isRunning, JOB_TYPES, weeklySchema } from "@/lib/automation";
import { CONTENT_TYPES, JOB_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDateTime, minutesLabel, yen } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { evidenceSchema, parseJson } from "@/lib/schemas";
import { getTemplates } from "@/lib/template-store";
import { POST_CHECKLIST } from "@/lib/templates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "自動化センター" };
export const maxDuration = 300;

const statusVariant = (s: string) => (s === "failed" ? "destructive" : s === "awaiting_review" ? "warning" : s === "completed" || s === "approved" ? "success" : "secondary");

export default async function AutomationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireProfile();
  const [jobs, recs, offers, templates] = await Promise.all([
    prisma.automationJob.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { logs: { orderBy: { createdAt: "asc" } } } }),
    prisma.aIRecommendation.findMany({ where: { status: { in: ["open", "accepted"] }, recommendationType: { not: "coach" } }, orderBy: [{ priority: "asc" }, { createdAt: "desc" }], take: 20 }),
    prisma.affiliateOffer.findMany({ where: { partnershipStatus: { not: "rejected" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getTemplates(),
  ]);
  const focus = sp.job ?? jobs.find((j) => j.status === "awaiting_review")?.id;
  // 実行中＝このサーバーで処理中。開始済みで完了していないのに処理していないものは、再起動などで中断したもの
  const stateOf = (j: (typeof jobs)[number]) => (isRunning(j.id) ? "running" : j.status === "draft" && j.startedAt && !j.completedAt && !j.result ? "interrupted" : j.status);
  const anyRunning = jobs.some((j) => stateOf(j) === "running");

  return (
    <>
      <AutoRefresh active={anyRunning} />
      <PageHeader title="自動化センター" description="計画・下書き・集計・改善案・週次レポートを自動で作ります。AIの出力は「確認待ち」になり、承認してから反映されます。SNSへの自動投稿はしません。" />

      {sp.started === "content" && <Notice className="mb-4" message="コンテンツの下書きをバックグラウンドで作っています。完了すると下の履歴に「確認待ち」で表示されます。待つ間も他の画面を使えます。" />}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(["daily_tasks", "performance_rollup", "improvement", "weekly_report"] as const).map((t) => (
          <Card key={t}>
            <CardHeader><CardTitle className="text-base">{JOB_TYPES[t]}</CardTitle><CardDescription>{DESCRIPTION[t]}</CardDescription></CardHeader>
            <CardContent>
              <ActionForm action={runJobAction}><input type="hidden" name="jobType" value={t} /><SubmitButton size="sm" pendingLabel="実行中…" className="self-start">実行する</SubmitButton></ActionForm>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader><CardTitle className="text-base">{JOB_TYPES.content_draft}</CardTitle><CardDescription>案件を選ぶと下書きを作り、コンテンツ工房で確認待ちにします。</CardDescription></CardHeader>
          <CardContent>
            {offers.length === 0 ? <p className="text-sm text-muted-foreground"><Link href="/offers" className="text-primary underline">案件を登録</Link>すると使えます。</p> : (
              <ActionForm action={runJobAction}>
                <input type="hidden" name="jobType" value="content_draft" />
                <Select name="offerId" aria-label="案件">{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
                <Select name="contentType" aria-label="種類" defaultValue="instagram_post">{CONTENT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                <SubmitButton size="sm" pendingLabel="生成中…" className="self-start">実行する</SubmitButton>
              </ActionForm>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader><CardTitle>ジョブ履歴</CardTitle></CardHeader>
          <CardContent>
            {jobs.length === 0 ? <EmptyState title="まだジョブはありません" description="上のボタンから実行できます。" /> : (
              <ul className="flex flex-col gap-3">
                {jobs.map((j) => { const st = stateOf(j); return (
                  <li key={j.id}>
                    <details open={j.id === focus} className={cn("rounded-lg border", j.status === "awaiting_review" && "border-warning/60")}>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
                        <strong className="text-sm">{j.name}</strong>
                        {j.payload.includes('"scheduled":true') && <Badge variant="outline">定期</Badge>}
                        {st === "running" ? <Badge variant="secondary"><Loader2 className="size-3 animate-spin" />実行中</Badge> : st === "interrupted" ? <Badge variant="warning">中断</Badge> : <Badge variant={statusVariant(j.status)}>{JOB_STATUS[j.status]}</Badge>}
                        <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(j.startedAt ?? j.createdAt)}</span>
                      </summary>
                      <div className="flex flex-col gap-3 border-t p-3 text-sm">
                        <JobResult jobType={j.jobType} result={j.result} />
                        {st === "running" && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />処理しています。この画面を離れても処理は続きます。</p>}
                        {st === "interrupted" && <p className="text-warning">アプリの再起動などで処理が止まりました。「再実行」してください。</p>}
                        {j.errorMessage && <p className="text-destructive">エラー：{j.errorMessage}<br /><span className="text-muted-foreground">設定画面でAIの接続を確認するか、「再実行」を押してください。</span></p>}
                        <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <dt>開始</dt><dd>{fmtDateTime(j.startedAt)}</dd>
                          <dt>完了</dt><dd>{fmtDateTime(j.completedAt)}</dd>
                        </dl>
                        {j.logs.length > 0 && (
                          <ol className="list-decimal pl-5 text-xs text-muted-foreground">
                            {j.logs.map((l) => <li key={l.id}><strong>{l.action}</strong>：{l.result}</li>)}
                          </ol>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {st === "running" && <form action={cancelJobAction}><input type="hidden" name="id" value={j.id} /><Button size="sm" variant="outline"><Square />キャンセル</Button></form>}
                          {st !== "running" && <form action={rerunJobAction}><input type="hidden" name="id" value={j.id} /><Button size="sm" variant="outline"><RotateCcw />再実行</Button></form>}
                          {j.status === "awaiting_review" && (
                            <>
                              <form action={approveJob}><input type="hidden" name="id" value={j.id} /><Button size="sm">承認して反映</Button></form>
                              <form action={setJobStatus}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="status" value="draft" /><Button size="sm" variant="outline">差し戻す</Button></form>
                            </>
                          )}
                          {j.status === "approved" && <form action={setJobStatus}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="status" value="completed" /><Button size="sm" variant="outline">完了にする</Button></form>}
                          <form action={deleteJob}><input type="hidden" name="id" value={j.id} /><Button size="sm" variant="ghost" className="text-destructive" aria-label="ジョブを削除"><Trash2 /></Button></form>
                        </div>
                      </div>
                    </details>
                  </li>
                ); })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>改善提案</CardTitle><CardDescription>承認した改善案と週次レポートの優先行動</CardDescription></CardHeader>
            <CardContent>
              {recs.length === 0 ? <p className="text-sm text-muted-foreground">まだありません。「改善案生成」を実行して承認すると表示されます。</p> : (
                <ul className="flex flex-col gap-3">
                  {recs.map((r) => {
                    const ev = parseJson(evidenceSchema, r.evidence, { facts: [], hypotheses: [] });
                    return (
                      <li key={r.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><strong>{r.title}</strong><Badge variant="outline">{r.generatedBy === "fallback" ? "ルール" : "AI"}</Badge></div>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.description}</p>
                        {(ev.facts.length > 0 || ev.hypotheses.length > 0) && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-muted-foreground">根拠</summary>
                            {ev.facts.length > 0 && <p className="mt-1"><Badge variant="success">実績データ</Badge> {ev.facts.join("／")}</p>}
                            {ev.hypotheses.length > 0 && <p className="mt-1"><Badge variant="warning">仮説</Badge> {ev.hypotheses.join("／")}</p>}
                          </details>
                        )}
                        <div className="mt-2 flex gap-2">
                          {(["done", "dismissed"] as const).map((s) => (
                            <form key={s} action={setRecommendationStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={s} /><Button size="sm" variant={s === "done" ? "outline" : "ghost"}>{s === "done" ? "対応した" : "見送る"}</Button></form>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>投稿チェックリスト</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{POST_CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="mt-3"><CopyButton text={POST_CHECKLIST.map((c) => `□ ${c}`).join("\n")} label="チェックリストをコピー" size="default" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>定型文テンプレート</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><strong>{t.name}</strong>
                    <div className="flex gap-1"><CopyButton text={t.body} label={`「${t.name}」をコピー`} /><form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><Button size="sm" variant="ghost" aria-label={`「${t.name}」を削除`}><Trash2 /></Button></form></div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{t.body}</p>
                </div>
              ))}
              <ActionForm action={saveTemplate} resetOnSuccess className="rounded-lg border p-3">
                <Field label="テンプレートを追加" htmlFor="t-name"><Input id="t-name" name="name" placeholder="名前" required /></Field>
                <Textarea name="body" aria-label="本文" placeholder="本文" required className="min-h-16" />
                <SubmitButton size="sm" variant="outline" className="self-start">追加</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

const DESCRIPTION: Record<string, string> = {
  daily_tasks: "目標・実績・未完了タスクから、作業時間内の今日のタスクを作ります。",
  performance_rollup: "直近30日の成果を媒体別に集計します。",
  improvement: "直近14日と前の14日を比べ、実績と仮説を分けて改善案を作ります。",
  weekly_report: "1週間の実績・作業時間・完了タスクから、課題と来週の優先行動をまとめます。",
};

const withBy = <T extends z.ZodRawShape>(s: z.ZodObject<T>) => s.extend({ generatedBy: z.string().default("fallback") });

function JobResult({ jobType, result }: { jobType: string; result: string }) {
  if (!result) return null;
  if (jobType === "improvement") {
    const r = parseJson(withBy(improvementSchema), result, { facts: [], hypotheses: [], suggestions: [], generatedBy: "fallback" });
    return (
      <div className="flex flex-col gap-2">
        {r.facts.length > 0 && <div><Badge variant="success">実績データ</Badge><ul className="mt-1 list-disc pl-5">{r.facts.map((f) => <li key={f}>{f}</li>)}</ul></div>}
        {r.hypotheses.length > 0 && <div><Badge variant="warning">仮説（データにない推測）</Badge><ul className="mt-1 list-disc pl-5">{r.hypotheses.map((f) => <li key={f}>{f}</li>)}</ul></div>}
        <div><Badge>改善案</Badge><ol className="mt-1 list-decimal pl-5">{r.suggestions.map((s) => <li key={s.title}><strong>{s.title}</strong>（{minutesLabel(s.minutes)}）<br /><span className="text-muted-foreground">{s.description}</span></li>)}</ol></div>
      </div>
    );
  }
  if (jobType === "weekly_report") {
    const r = parseJson(withBy(weeklySchema).extend({ completedTasks: z.number().default(0), publications: z.number().default(0), taskMinutes: z.number().default(0), totals: z.object({ confirmedRevenue: z.number().nullable(), pendingRevenue: z.number().nullable(), workMinutes: z.number().nullable() }).partial().default({}) }), result, { summary: "", good: [], issues: [], nextWeek: [], generatedBy: "fallback", completedTasks: 0, publications: 0, taskMinutes: 0, totals: {} });
    return (
      <div className="flex flex-col gap-2">
        <p>{r.summary}</p>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-2 text-xs sm:grid-cols-4">
          <div><dt className="text-muted-foreground">確定報酬</dt><dd className="tabular">{yen(r.totals.confirmedRevenue ?? null)}</dd></div>
          <div><dt className="text-muted-foreground">発生報酬</dt><dd className="tabular">{yen(r.totals.pendingRevenue ?? null)}</dd></div>
          <div><dt className="text-muted-foreground">記録した作業時間</dt><dd>{r.totals.workMinutes == null ? "未計測" : minutesLabel(r.totals.workMinutes)}</dd></div>
          <div><dt className="text-muted-foreground">完了タスク</dt><dd>{r.completedTasks}件（{minutesLabel(r.taskMinutes)}）</dd></div>
        </dl>
        {r.good.length > 0 && <div><Badge variant="success">良かった点</Badge><ul className="mt-1 list-disc pl-5">{r.good.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        {r.issues.length > 0 && <div><Badge variant="warning">課題</Badge><ul className="mt-1 list-disc pl-5">{r.issues.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        {r.nextWeek.length > 0 && <div><Badge>来週の優先行動</Badge><ol className="mt-1 list-decimal pl-5">{r.nextWeek.map((x) => <li key={x}>{x}</li>)}</ol></div>}
      </div>
    );
  }
  if (jobType === "content_draft") {
    const r = parseJson(z.object({ draftId: z.string(), title: z.string() }), result, { draftId: "", title: "" });
    return r.draftId ? <Link href={`/content?id=${r.draftId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>「{r.title}」をコンテンツ工房で確認</Link> : null;
  }
  if (jobType === "daily_tasks") {
    const r = parseJson(z.object({ tasks: z.array(z.object({ title: z.string(), minutes: z.number() })) }), result, { tasks: [] });
    return <ul className="list-disc pl-5">{r.tasks.map((t) => <li key={t.title}>{t.title}（{minutesLabel(t.minutes)}）</li>)}</ul>;
  }
  if (jobType === "performance_rollup") {
    const r = parseJson(z.object({ byPlatform: z.array(z.object({ platform: z.string(), confirmedRevenue: z.number().nullable(), pendingRevenue: z.number().nullable(), clicks: z.number().nullable() })) }), result, { byPlatform: [] });
    return r.byPlatform.length ? <ul className="list-disc pl-5">{r.byPlatform.map((p) => <li key={p.platform}>{p.platform}：確定 {yen(p.confirmedRevenue)}・発生 {yen(p.pendingRevenue)}・クリック {p.clicks ?? "未計測"}</li>)}</ul> : <p className="text-muted-foreground">直近30日の記録はありません。</p>;
  }
  return null;
}
