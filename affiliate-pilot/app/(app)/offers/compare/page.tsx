import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { evaluateOfferFit } from "@/lib/actions/offers";
import { totalsBetween } from "@/lib/analytics";
import { OFFER_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, num, pct, yen } from "@/lib/format";
import { optionalInt, percentToRate, rates } from "@/lib/metrics";
import { expectedEpc, fitSchema, offerSimulation } from "@/lib/offers";
import { requireProfile } from "@/lib/profile";
import { parseJson } from "@/lib/schemas";

export const metadata: Metadata = { title: "案件比較" };
export const maxDuration = 300;

const fitEvalSchema = fitSchema.omit({ score: true });

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await requireProfile();
  const ids = ([] as string[]).concat(sp.ids ?? []).slice(0, 6);
  const all = await prisma.affiliateOffer.findMany({ orderBy: { name: "asc" }, include: { network: true } });
  const offers = ids.length ? all.filter((o) => ids.includes(o.id)) : all.filter((o) => o.partnershipStatus !== "rejected").slice(0, 4);

  // CVR の初期値は直近90日の実績（なければ空欄＝入力してもらう）
  const recent = rates(await totalsBetween(addDays(new Date(), -90)));
  const clicksIn = typeof sp.clicks === "string" ? sp.clicks : "1000";
  const cvrIn = typeof sp.cvr === "string" ? sp.cvr : recent.cvr !== null ? String(+(recent.cvr * 100).toFixed(2)) : "";
  const clicks = optionalInt(clicksIn);
  const cvr = percentToRate(cvrIn);

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="案件比較" />
        <EmptyState title="比較する案件がありません" action={{ href: "/offers", label: "案件を登録する" }} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="案件比較" description="同じ仮定（クリック数・CVR）で並べて、確定報酬の見込みを比べます。承認率が未登録の案件は確定報酬を計算しません。" />

      <form className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-4">
        <fieldset>
          <legend className="text-sm font-medium">比較する案件（最大6件）</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {all.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-accent">
                <input type="checkbox" name="ids" value={o.id} defaultChecked={offers.some((x) => x.id === o.id)} className="size-4 accent-[var(--primary)]" />
                {o.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="想定クリック数（月）" htmlFor="clicks"><Input id="clicks" name="clicks" inputMode="numeric" defaultValue={clicksIn} className="w-32" /></Field>
          <Field label="想定CVR（%）" htmlFor="cvr" hint={recent.cvr !== null ? `直近90日の実績 ${pct(recent.cvr, 2)}` : "実績がないため仮定を入力"}><Input id="cvr" name="cvr" inputMode="decimal" defaultValue={cvrIn} className="w-32" /></Field>
          <Button type="submit" variant="secondary">再計算</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th scope="col" className="p-3 font-medium text-muted-foreground">項目</th>
              {offers.map((o) => <th key={o.id} scope="col" className="p-3 font-bold">{o.name}<div className="text-xs font-normal text-muted-foreground">{o.network?.name ?? "ASP未選択"}</div></th>)}
            </tr>
          </thead>
          <tbody className="tabular">
            {[
              ["提携状態", (o: (typeof offers)[number]) => OFFER_STATUS[o.partnershipStatus]],
              ["1件の報酬", (o: (typeof offers)[number]) => (o.commissionAmount === null ? "未登録" : yen(o.commissionAmount))],
              ["承認率", (o: (typeof offers)[number]) => (o.approvalRate === null ? "未登録" : pct(o.approvalRate, 0))],
              ["想定EPC（1クリックの確定見込み）", (o: (typeof offers)[number]) => { const e = expectedEpc(o, cvr); return e === null ? "計算不能" : yen(e); }],
              ["見込み発生成約数", (o: (typeof offers)[number]) => { const s = offerSimulation(o, clicks, cvr); return s ? `${num(s.conversions)}件` : "計算不能"; }],
              ["見込み発生報酬", (o: (typeof offers)[number]) => { const s = offerSimulation(o, clicks, cvr); return s ? yen(s.pending) : "計算不能"; }],
              ["見込み確定報酬", (o: (typeof offers)[number]) => { const s = offerSimulation(o, clicks, cvr); return s?.confirmed !== null && s ? yen(s.confirmed) : "計算不能"; }],
              ["承認時期", (o: (typeof offers)[number]) => o.approvalTiming || "未確認"],
              ["成果条件", (o: (typeof offers)[number]) => o.conversionConditions || "未登録"],
              ["否認条件", (o: (typeof offers)[number]) => o.rejectionConditions || "未登録"],
              ["対象ユーザー", (o: (typeof offers)[number]) => o.targetAudience || "未登録"],
            ].map(([label, f]) => (
              <tr key={label as string} className="border-b align-top">
                <th scope="row" className="p-3 text-left font-normal text-muted-foreground">{label as string}</th>
                {offers.map((o) => <td key={o.id} className="max-w-64 p-3 whitespace-pre-wrap">{(f as (o: (typeof offers)[number]) => string)(o)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">見込み額は入力した仮定に基づく計算です。収益の予測や保証ではありません。</p>

      <h2 className="mt-8 mb-3 text-lg font-bold">適合性評価とおすすめ理由</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((o) => {
          const ev = parseJson(fitEvalSchema, o.fitEvaluation, { reasons: [], concerns: [], checkItems: [] });
          return (
            <Card key={o.id}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{o.name}</CardTitle>
                  <CardDescription>{o.fitScore === null ? "未評価" : `適合度 ${o.fitScore}点`}{o.fitEvaluatedBy && `（${o.fitEvaluatedBy === "fallback" ? "ルール" : "AI"}で評価）`}</CardDescription>
                </div>
                <form action={evaluateOfferFit}>
                  <input type="hidden" name="id" value={o.id} />
                  <SubmitButton size="sm" variant="outline" pendingLabel="評価中…"><Sparkles />{o.fitScore === null ? "評価する" : "再評価"}</SubmitButton>
                </form>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {ev.reasons.length > 0 && <div><Badge variant="success">おすすめ理由</Badge><ul className="mt-1 list-disc pl-5">{ev.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>}
                {ev.concerns.length > 0 && <div><Badge variant="warning">懸念点</Badge><ul className="mt-1 list-disc pl-5">{ev.concerns.map((r) => <li key={r}>{r}</li>)}</ul></div>}
                {ev.checkItems.length > 0 && <div><Badge variant="outline">ASPで確認すること</Badge><ul className="mt-1 list-disc pl-5">{ev.checkItems.map((r) => <li key={r}>{r}</li>)}</ul></div>}
                {o.fitScore === null && <p className="text-muted-foreground">「評価する」を押すと、ジャンル・ターゲット・提携状態・承認率から相性を評価します。</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-sm"><Link href="/offers" className="text-primary hover:underline">← 案件一覧に戻る</Link></p>
    </>
  );
}
