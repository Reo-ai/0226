import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ScoreRadar } from "@/components/charts/score-radar";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { resetCriteria, runAssessment, saveCriteria } from "@/lib/actions/accounts";
import { platformLabel, PLATFORMS, STAGE_LABEL } from "@/lib/constants";
import { getCriteria, METRIC_LABEL, RATE_METRICS } from "@/lib/criteria";
import { prisma } from "@/lib/db";
import { fmtDateTime, pct } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { parseJson, stringListSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "アカウント戦闘力診断" };

const INDICATORS = [
  ["trafficScore", "集客力", "直近30日の表示回数"],
  ["engagementScore", "エンゲージメント", "反応数 ÷ 表示回数"],
  ["funnelScore", "収益導線", "クリック率・プロフィールからのクリック率"],
  ["offerFitScore", "案件との適合性", "ジャンルに合う案件と提携しているか"],
  ["conversionScore", "成約実績", "成約数 ÷ クリック数（30クリック以上で判定）"],
] as const;

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account: accountId } = await searchParams;
  const profile = await requireProfile();
  const accounts = await prisma.channelAccount.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "asc" } });
  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="アカウント戦闘力診断" />
        <EmptyState title="先にアカウントを登録してください" description="直近30日の表示回数・クリック数などを入力すると、収益化の準備状況を診断します。" action={{ href: "/accounts", label: "アカウントを登録する" }} />
      </>
    );
  }
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const [history, criteria] = await Promise.all([
    prisma.accountAssessment.findMany({ where: { channelAccountId: account.id }, orderBy: { assessedAt: "desc" }, take: 6 }),
    getCriteria(),
  ]);
  const last = history[0];

  return (
    <>
      <PageHeader
        title="アカウント戦闘力診断"
        description="フォロワー数ではなく、実際に見られている回数・反応・クリック・成約から収益化の準備状況を判定します。"
      />
      <nav aria-label="診断するアカウント" className="mb-6 flex flex-wrap gap-2">
        {accounts.map((a) => (
          <Link key={a.id} href={`/accounts/assessment?account=${a.id}`} className={cn("rounded-full border px-3 py-1 text-sm", a.id === account.id ? "border-primary bg-accent font-medium" : "hover:bg-muted")} aria-current={a.id === account.id ? "page" : undefined}>
            {platformLabel(a.platform)}：{a.accountName}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>診断結果</CardTitle>
              <CardDescription>{last ? `${fmtDateTime(last.assessedAt)} 時点の入力値で判定` : "まだ診断していません"}</CardDescription>
            </div>
            <form action={runAssessment}>
              <input type="hidden" name="id" value={account.id} />
              <SubmitButton size="sm">{last ? "もう一度診断" : "診断する"}</SubmitButton>
            </form>
          </CardHeader>
          <CardContent>
            {last ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="px-3 py-1 text-sm" variant={last.stage === "grown" ? "success" : last.stage === "insufficient" ? "outline" : "secondary"}>{STAGE_LABEL[last.stage]}</Badge>
                  <span className="tabular text-3xl font-bold">{last.overallScore ?? "—"}<span className="text-base font-normal text-muted-foreground"> / 100</span></span>
                  <span className="text-sm text-muted-foreground">データの信頼度 {pct(last.confidenceLevel, 0)}</span>
                </div>
                {last.stage === "insufficient" && (
                  <p className="rounded-lg bg-muted p-3 text-sm">計測できている数字が少ないため、段階を判定していません。下の改善項目の「計測」から始めましょう。</p>
                )}
                <ScoreRadar data={INDICATORS.map(([k, label]) => ({ label, score: last[k] }))} />
                <ul className="flex flex-col gap-2">
                  {INDICATORS.map(([k, label, hint]) => (
                    <li key={k}>
                      <div className="flex justify-between text-sm"><span>{label}<span className="ml-2 text-xs text-muted-foreground">{hint}</span></span><span className="tabular font-medium">{last[k] ?? "未計測"}</span></div>
                      <Progress value={last[k] ?? 0} className="mt-1" aria-label={`${label}のスコア`} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState title="「診断する」を押してください" description="登録済みの数字で、5つの指標とデータの信頼度を計算します。" />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {last && (
            <Card className="border-primary/40">
              <CardHeader><CardTitle>優先すべき改善 3つ</CardTitle></CardHeader>
              <CardContent>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                  {parseJson(stringListSchema, last.recommendations, []).map((r) => <li key={r}>{r}</li>)}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Link href={`/accounts?edit=${account.id}`} className="text-primary hover:underline">数字を更新する →</Link>
                  <Link href="/challenge" className="text-primary hover:underline">初月5万円チャレンジ →</Link>
                </div>
              </CardContent>
            </Card>
          )}
          {history.length > 1 && (
            <Card>
              <CardHeader><CardTitle>診断の履歴</CardTitle></CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between"><span className="text-muted-foreground">{fmtDateTime(h.assessedAt)}</span><span>{STAGE_LABEL[h.stage]}・{h.overallScore ?? "—"}点</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <details className="mt-8 rounded-xl border bg-card p-5">
        <summary className="cursor-pointer font-bold">評価基準を編集する</summary>
        <p className="mt-2 text-sm text-muted-foreground">各指標は「低」の値で20点、「高」の値で100点になります（間は対数で補間）。ジャンルや媒体の相場に合わせて調整できます。</p>
        <ActionForm action={saveCriteria} className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">指標</th>{PLATFORMS.map((p) => <th key={p.id} className="p-2" colSpan={2}>{p.label}（低／高）</th>)}</tr></thead>
              <tbody>
                {Object.keys(METRIC_LABEL).map((m) => {
                  const isRate = (RATE_METRICS as readonly string[]).includes(m);
                  return (
                    <tr key={m} className="border-t">
                      <th scope="row" className="p-2 text-left font-normal">{METRIC_LABEL[m]}</th>
                      {PLATFORMS.map((p) => {
                        const r = criteria.platforms[p.id]?.[m as keyof (typeof criteria.platforms)[string]];
                        return ["low", "high"].map((lh) => (
                          <td key={p.id + lh} className="p-1">
                            <Input aria-label={`${p.label} ${METRIC_LABEL[m]} ${lh === "low" ? "低" : "高"}`} name={`c.${p.id}.${m}.${lh}`} inputMode="decimal" className="h-8 w-20 px-2"
                              defaultValue={r ? String(isRate ? +(r[lh as "low" | "high"] * 100).toFixed(3) : r[lh as "low" | "high"]) : ""} />
                          </td>
                        ));
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">「成長途中」の下限点<Input name="s.growing" defaultValue={criteria.stage.growing} className="h-8 w-24" inputMode="numeric" /></label>
            <label className="flex flex-col gap-1">「成長済み」の下限点<Input name="s.grown" defaultValue={criteria.stage.grown} className="h-8 w-24" inputMode="numeric" /></label>
            <SubmitButton size="sm">基準を保存</SubmitButton>
          </div>
        </ActionForm>
        <form action={resetCriteria} className="mt-3"><Button variant="link" size="sm" className="px-0">初期値に戻す</Button></form>
      </details>
    </>
  );
}
