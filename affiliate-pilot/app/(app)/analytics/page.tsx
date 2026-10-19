import { Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ClicksChart } from "@/components/charts/clicks-chart";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { deleteRecord, importRecords, saveRecord } from "@/lib/actions/analytics";
import { byMonth, byWeek, dailySeries, groupBy, records, type Group } from "@/lib/analytics";
import { platformLabel, PLATFORMS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, dateKey, daysBetween, fmtDate, jstDay, jstMonthStart, minutesLabel, num, pct, yen } from "@/lib/format";
import { goalAchievement, rates, totals } from "@/lib/metrics";
import { activeGoal, requireProfile } from "@/lib/profile";
import { RECORD_FIELDS } from "@/lib/records";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "収益分析" };

const PERIODS = [
  ["month", "今月"],
  ["30", "30日"],
  ["90", "90日"],
  ["all", "全期間"],
] as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const period = PERIODS.some(([k]) => k === sp.period) ? sp.period! : "month";
  const today = jstDay();
  const from = period === "month" ? jstMonthStart() : period === "all" ? new Date(0) : addDays(today, -Number(period) + 1);
  const [rows, goal, accounts, offers, pubs, clickRows] = await Promise.all([
    records(from),
    activeGoal(profile.id),
    prisma.channelAccount.findMany({ where: { profileId: profile.id }, select: { id: true, accountName: true, platform: true } }),
    prisma.affiliateOffer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.publication.findMany({ orderBy: { publishedAt: "desc" }, take: 50, include: { draft: { select: { title: true } } } }),
    prisma.linkClick.groupBy({ by: ["platform"], where: { createdAt: { gte: from } }, _count: { _all: true } }),
  ]);
  const t = totals(rows);
  const r = rates(t);
  const target = goal?.targetMonthlyRevenue ?? 50_000;
  const monthT = totals(rows.filter((x) => x.recordDate >= jstMonthStart()));
  const achievement = goalAchievement(monthT.confirmedRevenue, target);
  const days = period === "all" ? Math.min(180, Math.max(1, rows.length ? daysBetween(rows[0].recordDate, today) + 1 : 30)) : daysBetween(from, today) + 1;
  const seriesFrom = period === "all" ? addDays(today, -days + 1) : from;
  const daily = dailySeries(rows, seriesFrom, days);
  const offerName = (id: string) => offers.find((o) => o.id === id)?.name ?? "案件未指定";
  const byPlatform = groupBy(rows, (x) => x.platform, platformLabel);
  const byOffer = groupBy(rows, (x) => x.affiliateOfferId ?? "", (k) => (k ? offerName(k) : "案件未指定"));

  return (
    <>
      <PageHeader
        title="収益分析センター"
        description="発生報酬（承認前）・確定報酬（承認済み）・入金額を分けて記録します。空欄は「未計測」として0と区別し、分母が0や未計測の率は計算しません。"
        actions={<a href="/api/analytics/export" className={buttonVariants({ variant: "outline" })}><Download />CSVエクスポート</a>}
      />

      <nav aria-label="期間" className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map(([k, l]) => (
          <Link key={k} href={`/analytics?period=${k}`} aria-current={period === k ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", period === k ? "border-primary bg-accent font-medium" : "hover:bg-muted")}>{l}</Link>
        ))}
      </nav>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["発生報酬", yen(t.pendingRevenue)],
          ["確定報酬", yen(t.confirmedRevenue)],
          ["入金額", yen(t.paidRevenue)],
          ["目標達成率（今月）", pct(achievement)],
          ["CTR", pct(r.ctr, 2)],
          ["CVR", pct(r.cvr, 2)],
          ["承認率", pct(r.approvalRate, 0)],
          ["1時間あたり確定報酬", yen(r.confirmedPerHour)],
        ].map(([l, v]) => (
          <Card key={l}><CardContent className="px-4 pt-4 pb-4"><p className="text-xs text-muted-foreground">{l}</p><p className="tabular mt-1 text-lg font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <p className="-mt-3 mb-6 text-xs text-muted-foreground">
        表示回数 {num(t.impressions)}・クリック {num(t.clicks)}・発生成約 {num(t.conversions)}・承認済み {num(t.approvedConversions)}・作業時間 {t.workMinutes === null ? "未計測" : minutesLabel(t.workMinutes)}
        {clickRows.length > 0 && <>／計測リンクのクリック（参考）：{clickRows.map((c) => `${platformLabel(c.platform)} ${c._count._all}`).join("・")}</>}
      </p>

      {rows.length === 0 ? (
        <EmptyState title="この期間の記録はまだありません" description="下のフォームから、ASPやSNSの管理画面の数字を記録しましょう。分からない値は空欄でOKです。" />
      ) : (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2"><CardHeader><CardTitle>日別の報酬</CardTitle></CardHeader><CardContent><RevenueChart data={daily.map((d) => ({ label: d.date, pending: d.pending, confirmed: d.confirmed }))} /></CardContent></Card>
          <Card><CardHeader><CardTitle>週別の報酬</CardTitle></CardHeader><CardContent><RevenueChart height={220} data={byWeek(rows).map(toBar)} /></CardContent></Card>
          <Card><CardHeader><CardTitle>月別の報酬</CardTitle></CardHeader><CardContent><RevenueChart height={220} data={byMonth(rows).map(toBar)} /></CardContent></Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>日別クリック</CardTitle></CardHeader><CardContent><ClicksChart data={daily.map((d) => ({ label: d.date, clicks: d.clicks }))} /></CardContent></Card>
          <BreakdownCard title="媒体別" groups={byPlatform} />
          <BreakdownCard title="案件別" groups={byOffer} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>成果を記録</CardTitle><CardDescription>同じ日・媒体・アカウント・案件・公開の組み合わせは上書きされます（二重集計を防ぐため）。</CardDescription></CardHeader>
          <CardContent>
            <ActionForm action={saveRecord}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="日付" htmlFor="r-date"><Input id="r-date" name="recordDate" type="date" defaultValue={dateKey(addDays(today, -1))} required /></Field>
                <Field label="媒体" htmlFor="r-platform"><Select id="r-platform" name="platform" defaultValue={profile.platforms[0] ?? "blog"}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
                <Field label="アカウント" htmlFor="r-acc"><Select id="r-acc" name="channelAccountId" defaultValue=""><option value="">指定しない</option>{accounts.map((a) => <option key={a.id} value={a.id}>{platformLabel(a.platform)}：{a.accountName}</option>)}</Select></Field>
                <Field label="案件" htmlFor="r-offer"><Select id="r-offer" name="affiliateOfferId" defaultValue=""><option value="">指定しない</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
                <Field label="投稿（公開URL）" htmlFor="r-pub" className="sm:col-span-2"><Select id="r-pub" name="publicationId" defaultValue=""><option value="">指定しない</option>{pubs.map((p) => <option key={p.id} value={p.id}>{p.draft.title}（{fmtDate(p.publishedAt)}）</option>)}</Select></Field>
                {RECORD_FIELDS.map(([k, l]) => (
                  <Field key={k} label={l} htmlFor={`r-${k}`}><Input id={`r-${k}`} name={k} inputMode="numeric" placeholder="空欄＝未計測" /></Field>
                ))}
                <Field label="メモ" htmlFor="r-note" className="sm:col-span-2"><Input id="r-note" name="note" maxLength={500} /></Field>
              </div>
              <SubmitButton className="self-start">記録する</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>CSVインポート</CardTitle><CardDescription>1行目に見出し：日付・媒体・アカウント・案件・公開URL・表示回数・クリック数・発生成約数・承認済み成約数・発生報酬・確定報酬・入金額・作業時間（分）・メモ（エクスポートしたCSVと同じ形式）</CardDescription></CardHeader>
            <CardContent>
              <ActionForm action={importRecords} resetOnSuccess>
                <Textarea name="csv" aria-label="CSV" className="min-h-28 font-mono text-xs" required placeholder={"日付,媒体,案件,クリック数,発生報酬,確定報酬\n2026/10/01,Instagram,〇〇,52,3000,"} />
                <SubmitButton variant="outline" className="self-start">取り込む</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>改善提案</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">記録をもとに、実績データと仮説を分けた改善案を作ります。</p>
              <Link href="/automation" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>自動化センターで改善案を作る</Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {rows.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>記録一覧（{rows.length}件）</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">日付</th><th className="p-2">媒体</th><th className="p-2">案件</th>{RECORD_FIELDS.map(([k, l]) => <th key={k} className="p-2 text-right">{l.replace("（分）", "")}</th>)}<th className="p-2" /></tr></thead>
              <tbody className="tabular">
                {[...rows].reverse().slice(0, 200).map((x) => (
                  <tr key={x.id} className="border-b">
                    <td className="p-2">{fmtDate(x.recordDate)}</td>
                    <td className="p-2">{platformLabel(x.platform)}</td>
                    <td className="max-w-40 truncate p-2">{x.affiliateOfferId ? offerName(x.affiliateOfferId) : "—"}</td>
                    {RECORD_FIELDS.map(([k]) => <td key={k} className={cn("p-2 text-right", x[k] === null && "text-muted-foreground")}>{x[k] === null ? "—" : k.endsWith("Revenue") ? yen(x[k]) : num(x[k])}</td>)}
                    <td className="p-2"><form action={deleteRecord}><input type="hidden" name="id" value={x.id} /><button aria-label="この記録を削除" className="text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 className="size-4" /></button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">「—」は未計測です。</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function toBar(g: Group) {
  return { label: g.label, pending: g.totals.pendingRevenue, confirmed: g.totals.confirmedRevenue };
}

function BreakdownCard({ title, groups }: { title: string; groups: Group[] }) {
  const sorted = [...groups].sort((a, b) => (b.totals.confirmedRevenue ?? -1) - (a.totals.confirmedRevenue ?? -1));
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2" /><th className="p-2 text-right">確定報酬</th><th className="p-2 text-right">発生報酬</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">CVR</th><th className="p-2 text-right">承認率</th></tr></thead>
          <tbody className="tabular">
            {sorted.map((g) => (
              <tr key={g.key} className="border-b">
                <th scope="row" className="max-w-40 truncate p-2 text-left font-normal">{g.label}</th>
                <td className="p-2 text-right">{yen(g.totals.confirmedRevenue)}</td>
                <td className="p-2 text-right">{yen(g.totals.pendingRevenue)}</td>
                <td className="p-2 text-right">{pct(g.rates.ctr, 2)}</td>
                <td className="p-2 text-right">{pct(g.rates.cvr, 2)}</td>
                <td className="p-2 text-right">{pct(g.rates.approvalRate, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
