import { Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ClicksChart, RevenueChart } from "@/components/charts/lazy";
import { KpiTile } from "@/components/kpi-tile";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { deleteRecord, importRecords, saveRecord } from "@/lib/actions/analytics";
import { dailySeries, delta, groupTotals, totalsBetween, type Group } from "@/lib/analytics";
import { platformLabel, PLATFORMS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, dateKey, daysBetween, fmtDate, jstDay, jstMonthStart, minutesLabel, num, pct, yen } from "@/lib/format";
import { goalAchievement, rates } from "@/lib/metrics";
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
  const tomorrow = addDays(today, 1);
  const from = period === "month" ? jstMonthStart() : period === "all" ? new Date(0) : addDays(today, -Number(period) + 1);
  // 比較用の前期間（同じ長さ）。全期間のときは比較しない
  const prevFrom = period === "month" ? jstMonthStart(addDays(from, -1)) : period === "all" ? null : addDays(from, -Number(period));

  const [t, prev, goal, accounts, offers, pubs, clickRows, byPlatform, byOfferRaw, weeks, months, rowCount, firstRecord] = await Promise.all([
    totalsBetween(from),
    prevFrom ? totalsBetween(prevFrom, from) : null,
    activeGoal(profile.id),
    prisma.channelAccount.findMany({ where: { profileId: profile.id }, select: { id: true, accountName: true, platform: true } }),
    prisma.affiliateOffer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.publication.findMany({ orderBy: { publishedAt: "desc" }, take: 50, include: { draft: { select: { title: true } } } }),
    prisma.linkClick.groupBy({ by: ["platform"], where: { createdAt: { gte: from } }, _count: { _all: true } }),
    groupTotals("platform", from),
    groupTotals("offer", from),
    groupTotals("week", from),
    groupTotals("month", from),
    prisma.performanceRecord.count({ where: { recordDate: { gte: from } } }),
    prisma.performanceRecord.findFirst({ orderBy: { recordDate: "asc" }, select: { recordDate: true } }),
  ]);
  const r = rates(t);
  const target = goal?.targetMonthlyRevenue ?? 50_000;
  const monthT = period === "month" ? t : await totalsBetween(jstMonthStart());
  const achievement = goalAchievement(monthT.confirmedRevenue, target);
  const days = period === "all" ? Math.min(180, Math.max(30, firstRecord ? daysBetween(firstRecord.recordDate, today) + 1 : 30)) : daysBetween(from, today) + 1;
  const seriesFrom = period === "all" ? addDays(tomorrow, -days) : from;
  const daily = await dailySeries(seriesFrom, days);
  const offerName = (id: string) => offers.find((o) => o.id === id)?.name ?? "案件未指定";
  const platforms = byPlatform.map((g) => ({ ...g, label: platformLabel(g.key) }));
  const byOffer = byOfferRaw.map((g) => ({ ...g, label: g.key ? offerName(g.key) : "案件未指定" }));
  const rows = rowCount ? await prisma.performanceRecord.findMany({ where: { recordDate: { gte: from } }, orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }], take: 200 }) : [];
  const dl = (k: keyof typeof t) => (prev ? delta(t[k], prev[k]) : null);
  const prevLabel = period === "month" ? "先月比" : `前${period}日比`;

  return (
    <div className="fade-in">
      <PageHeader
        title="収益分析センター"
        description="発生報酬（承認前）・確定報酬（承認済み）・入金額を分けて記録します。空欄は「未計測」として0と区別し、分母が0や未計測の率は計算しません。"
        actions={<a href="/api/analytics/export" className={buttonVariants({ variant: "outline" })}><Download />CSVエクスポート</a>}
      />

      <nav aria-label="期間" className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map(([k, l]) => (
          <Link key={k} href={`/analytics?period=${k}`} aria-current={period === k ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", period === k ? "border-primary bg-accent font-medium" : "hover:bg-muted")}>{l}</Link>
        ))}
      </nav>

      <section aria-label="指標" className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="確定報酬" value={yen(t.confirmedRevenue)} delta={dl("confirmedRevenue")} deltaLabel={prevLabel} spark={daily.map((d) => d.confirmed)} hint={prev ? "前の期間の記録がないため比較なし" : undefined} />
        <KpiTile label="発生報酬" value={yen(t.pendingRevenue)} delta={dl("pendingRevenue")} deltaLabel={prevLabel} spark={daily.map((d) => d.pending)} sparkColor="var(--chart-2)" hint={prev ? "前の期間の記録がないため比較なし" : undefined} />
        <KpiTile label="クリック" value={num(t.clicks)} delta={dl("clicks")} deltaLabel={prevLabel} spark={daily.map((d) => d.clicks)} sparkColor="var(--chart-3)" hint={prev ? "前の期間の記録がないため比較なし" : undefined} />
        <KpiTile label="入金額" value={yen(t.paidRevenue)} delta={dl("paidRevenue")} deltaLabel={prevLabel} hint="振り込まれた金額" />
        <KpiTile label="CTR" value={pct(r.ctr, 2)} hint="クリック ÷ 表示回数" />
        <KpiTile label="CVR" value={pct(r.cvr, 2)} hint="発生成約 ÷ クリック" />
        <KpiTile label="承認率" value={pct(r.approvalRate, 0)} hint="承認済み ÷ 発生" />
        <KpiTile label="目標達成率（今月）" value={pct(achievement)} hint={`目標 ${yen(target)}`} />
      </section>
      <p className="mb-6 text-xs text-muted-foreground">
        表示回数 {num(t.impressions)}・発生成約 {num(t.conversions)}・承認済み {num(t.approvedConversions)}・作業時間 {t.workMinutes === null ? "未計測" : minutesLabel(t.workMinutes)}・1時間あたり確定報酬 {yen(r.confirmedPerHour)}
        {clickRows.length > 0 && <>／計測リンクのクリック（参考）：{clickRows.map((c) => `${platformLabel(c.platform)} ${c._count._all}`).join("・")}</>}
      </p>

      {rowCount === 0 ? (
        <EmptyState title="この期間の記録はまだありません" description="下のフォームから、ASPやSNSの管理画面の数字を記録しましょう。分からない値は空欄でOKです。" />
      ) : (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2"><CardHeader><CardTitle>日別の報酬</CardTitle></CardHeader><CardContent><RevenueChart data={daily.map((d) => ({ label: d.date, pending: d.pending, confirmed: d.confirmed }))} /></CardContent></Card>
          <Card><CardHeader><CardTitle>週別の報酬</CardTitle></CardHeader><CardContent><RevenueChart height={220} data={weeks.slice(-26).map(toBar)} /></CardContent></Card>
          <Card><CardHeader><CardTitle>月別の報酬</CardTitle></CardHeader><CardContent><RevenueChart height={220} data={months.slice(-24).map(toBar)} /></CardContent></Card>
          <Card className="lg:col-span-2"><CardHeader><CardTitle>日別クリック</CardTitle></CardHeader><CardContent><ClicksChart data={daily.map((d) => ({ label: d.date, clicks: d.clicks }))} /></CardContent></Card>
          <BreakdownCard title="媒体別" groups={platforms} />
          <BreakdownCard title="案件別" groups={byOffer} />
          <WorkTimeCard weeks={weeks.slice(-12)} platforms={platforms} />
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
          <CardHeader><CardTitle>記録一覧（{rowCount.toLocaleString("ja-JP")}件{rowCount > 200 && "・新しい200件を表示"}）</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">日付</th><th className="p-2">媒体</th><th className="p-2">案件</th>{RECORD_FIELDS.map(([k, l]) => <th key={k} className="p-2 text-right">{l.replace("（分）", "")}</th>)}<th className="p-2" /></tr></thead>
              <tbody className="tabular">
                {rows.map((x) => (
                  <tr key={x.id} className="border-b">
                    <td className="p-2">{fmtDate(x.recordDate)}{x.isDemo && <span className="ml-1 rounded bg-warning/20 px-1 text-xs">サンプル</span>}</td>
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
    </div>
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
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2" /><th className="p-2 text-right">確定報酬</th><th className="p-2 text-right">発生報酬</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">CVR</th><th className="p-2 text-right">承認率</th><th className="p-2 text-right">作業時間</th><th className="p-2 text-right">1時間あたり確定</th></tr></thead>
          <tbody className="tabular">
            {sorted.map((g) => (
              <tr key={g.key} className="border-b">
                <th scope="row" className="max-w-40 truncate p-2 text-left font-normal">{g.label}</th>
                <td className="p-2 text-right">{yen(g.totals.confirmedRevenue)}</td>
                <td className="p-2 text-right">{yen(g.totals.pendingRevenue)}</td>
                <td className="p-2 text-right">{pct(g.rates.ctr, 2)}</td>
                <td className="p-2 text-right">{pct(g.rates.cvr, 2)}</td>
                <td className="p-2 text-right">{pct(g.rates.approvalRate, 0)}</td>
                <td className="p-2 text-right">{g.totals.workMinutes === null ? "未計測" : minutesLabel(g.totals.workMinutes)}</td>
                <td className="p-2 text-right">{yen(g.rates.confirmedPerHour)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** 作業時間分析：週ごとの作業時間と、時間あたりの確定報酬が高い媒体 */
function WorkTimeCard({ weeks, platforms }: { weeks: Group[]; platforms: Group[] }) {
  const measured = weeks.filter((w) => w.totals.workMinutes !== null);
  const best = [...platforms].filter((p) => p.rates.confirmedPerHour !== null).sort((a, b) => b.rates.confirmedPerHour! - a.rates.confirmedPerHour!)[0];
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>作業時間分析</CardTitle><CardDescription>成果記録に作業時間（分）を入れると、時間の使い方を比べられます。</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {measured.length === 0 ? <p className="text-muted-foreground">作業時間がまだ記録されていません。</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">週</th><th className="p-2 text-right">作業時間</th><th className="p-2 text-right">確定報酬</th><th className="p-2 text-right">1時間あたり確定</th><th className="p-2 text-right">発生報酬</th></tr></thead>
              <tbody className="tabular">
                {measured.map((w) => (
                  <tr key={w.key} className="border-b"><th scope="row" className="p-2 text-left font-normal">{w.label}</th><td className="p-2 text-right">{minutesLabel(w.totals.workMinutes!)}</td><td className="p-2 text-right">{yen(w.totals.confirmedRevenue)}</td><td className="p-2 text-right">{yen(w.rates.confirmedPerHour)}</td><td className="p-2 text-right">{yen(w.totals.pendingRevenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {best && <p>時間あたりの確定報酬がいちばん高い媒体は<strong>{best.label}</strong>（{yen(best.rates.confirmedPerHour)}／時間）です。<span className="text-muted-foreground">記録された数字からの計算で、今後も同じ結果になるとは限りません。</span></p>}
      </CardContent>
    </Card>
  );
}
