import { CheckCheck, ExternalLink, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { createTrackingLink, deleteOffer, deleteTrackingLink, evaluateOfferFit, importOffers, markVerified, setOfferStatus } from "@/lib/actions/offers";
import { OFFER_STATUS, PLATFORMS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/env";
import { fmtDate, pct, yen } from "@/lib/format";
import { syncNetworks } from "@/lib/networks-sync";
import { requireProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { OfferForm } from "./offer-form";

export const metadata: Metadata = { title: "案件分析" };
export const maxDuration = 300;

const STALE_DAYS = 30;

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireProfile();
  await syncNetworks();
  const q = (sp.q ?? "").trim();
  const where = {
    ...(sp.status ? { partnershipStatus: sp.status } : {}),
    ...(sp.network ? { affiliateNetworkId: sp.network } : {}),
    ...(sp.category ? { category: sp.category } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { category: { contains: q } }, { targetAudience: { contains: q } }, { notes: { contains: q } }] } : {}),
  };
  const [offers, networks, categories, links, base] = await Promise.all([
    prisma.affiliateOffer.findMany({ where, orderBy: [{ fitScore: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }], include: { network: true } }),
    prisma.affiliateNetwork.findMany({ orderBy: { name: "asc" } }),
    prisma.affiliateOffer.findMany({ distinct: ["category"], select: { category: true }, where: { category: { not: "" } } }),
    prisma.trackingLink.findMany({ orderBy: { createdAt: "desc" }, include: { offer: true, _count: { select: { clicks: true } } } }),
    appBaseUrl(),
  ]);
  const editing = sp.edit ? await prisma.affiliateOffer.findUnique({ where: { id: sp.edit } }) : null;
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="案件分析"
        description="ASP案件を登録・比較します。報酬額や条件はASPで確認した値だけを入力し、推測では埋めません。"
        actions={<Link href="/offers/compare" className={buttonVariants({ variant: "outline" })}>案件を比較する</Link>}
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <Field label="キーワード" htmlFor="q" className="min-w-40 flex-1"><Input id="q" name="q" defaultValue={q} placeholder="案件名・ジャンル・対象ユーザー" /></Field>
        <Field label="提携状態" htmlFor="f-status">
          <Select id="f-status" name="status" defaultValue={sp.status ?? ""}><option value="">すべて</option>{Object.entries(OFFER_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </Field>
        <Field label="ASP" htmlFor="f-net">
          <Select id="f-net" name="network" defaultValue={sp.network ?? ""}><option value="">すべて</option>{networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select>
        </Field>
        <Field label="ジャンル" htmlFor="f-cat">
          <Select id="f-cat" name="category" defaultValue={sp.category ?? ""}><option value="">すべて</option>{categories.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}</Select>
        </Field>
        <Button type="submit" variant="secondary">絞り込む</Button>
        {(q || sp.status || sp.network || sp.category) && <Link href="/offers" className={buttonVariants({ variant: "ghost" })}>解除</Link>}
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          {offers.length === 0 && <EmptyState title={q || sp.status ? "条件に合う案件はありません" : "まだ案件がありません"} description="ASPの管理画面で見つけた案件を、右のフォームかCSVで登録しましょう。" />}
          {offers.length > 0 && (
            <div className="flex flex-col gap-4">
              {offers.map((o) => {
                const stale = !o.lastVerifiedAt || now - o.lastVerifiedAt.getTime() > STALE_DAYS * 86_400_000;
                return (
                  <Card key={o.id}>
                    <CardHeader className="flex-row items-start gap-3">
                      <input type="checkbox" name="ids" value={o.id} form="compare-form" aria-label={`「${o.name}」を比較に入れる`} className="mt-1 size-4 accent-[var(--primary)]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{o.name}</CardTitle>
                          <Badge variant={o.partnershipStatus === "approved" ? "success" : o.partnershipStatus === "rejected" ? "destructive" : "secondary"}>{OFFER_STATUS[o.partnershipStatus]}</Badge>
                          {o.isDemo && <Badge variant="outline">デモ</Badge>}
                          {o.fitScore !== null && <Badge variant="outline">適合 {o.fitScore}点</Badge>}
                        </div>
                        <CardDescription>{o.network?.name ?? "ASP未選択"}{o.category && `・${o.category}`}{o.targetAudience && `・対象：${o.targetAudience}`}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div><dt className="text-xs text-muted-foreground">1件の報酬</dt><dd className="tabular font-semibold">{o.commissionAmount === null ? "未登録" : yen(o.commissionAmount)}{o.commissionType === "rate" && <span className="block text-xs font-normal text-muted-foreground">{pct(o.commissionRate)} × {yen(o.averageOrderValue)}</span>}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">承認率</dt><dd className="tabular">{o.approvalRate === null ? "未登録" : pct(o.approvalRate, 0)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">承認時期</dt><dd>{o.approvalTiming || "未確認"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">最終確認日</dt><dd className={cn(stale && "text-warning")}>{fmtDate(o.lastVerifiedAt)}{stale && "（要確認）"}</dd></div>
                      </dl>
                      {(o.conversionConditions || o.rejectionConditions) && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground">成果条件・否認条件</summary>
                          <p className="mt-1"><strong>成果：</strong>{o.conversionConditions || "未登録"}</p>
                          <p className="mt-1"><strong>否認：</strong>{o.rejectionConditions || "未登録"}</p>
                        </details>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {o.offerUrl && <a href={o.offerUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonVariants({ size: "sm", variant: "ghost" })}><ExternalLink />開く</a>}
                        <Link href={`/offers?edit=${o.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}><Pencil />編集</Link>
                        <form action={evaluateOfferFit}><input type="hidden" name="id" value={o.id} /><SubmitButton size="sm" variant="outline" pendingLabel="評価中…"><Sparkles />適合性を評価</SubmitButton></form>
                        <form action={markVerified}><input type="hidden" name="id" value={o.id} /><Button size="sm" variant="ghost"><CheckCheck />今日確認した</Button></form>
                        <Select aria-label="提携状態を変更" name="status" defaultValue={o.partnershipStatus} className="h-8 w-auto py-0 text-xs" form={`st-${o.id}`}>
                          {Object.entries(OFFER_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                        <Button size="sm" variant="ghost" form={`st-${o.id}`}>状態を更新</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <form id="compare-form" action="/offers/compare" className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
                <Button type="submit" className="shadow-lg">チェックした案件を比較</Button>
              </form>
            </div>
          )}
          {/* 状態変更・削除はカードの外のフォームに紐づける（入れ子フォームを避けるため） */}
          {offers.map((o) => (
            <form key={o.id} id={`st-${o.id}`} action={setOfferStatus} hidden>
              <input type="hidden" name="id" value={o.id} />
            </form>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{editing ? "案件を編集" : "案件を登録"}</CardTitle>
              {editing && (
                <div className="flex gap-3 text-sm">
                  <Link href="/offers" className="text-primary hover:underline">新規登録に戻る</Link>
                  <ConfirmDialog trigger={<button className="flex items-center gap-1 text-destructive hover:underline cursor-pointer"><Trash2 className="size-3.5" />この案件を削除</button>} title="案件を削除しますか？" description="計測リンクや成果記録との紐づけは外れます（記録自体は残ります）。" confirmLabel="削除する" formAction={deleteOffer} hidden={{ id: editing.id }} />
                </div>
              )}
            </CardHeader>
            <CardContent><OfferForm offer={editing ?? undefined} networks={networks} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>CSVでまとめて登録</CardTitle><CardDescription>1行目に見出しを入れてください。使える見出し：ASP名・案件名・ジャンル・商品URL・報酬単価・成果条件・否認条件・承認率・提携状態・対象ユーザー・承認時期・最終確認日</CardDescription></CardHeader>
            <CardContent>
              <ActionForm action={importOffers} resetOnSuccess>
                <Textarea name="csv" aria-label="CSV" className="min-h-28 font-mono text-xs" placeholder={"ASP名,案件名,ジャンル,報酬単価,承認率,提携状態\nA8.net,〇〇（ASPで確認した名前）,筋トレ,3000,80,提携済み"} required />
                <SubmitButton variant="outline" className="self-start">取り込む</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          <Card id="links">
            <CardHeader><CardTitle>計測リンク</CardTitle><CardDescription>ASPのリンクを直接貼らず、このリンクを経由させると媒体別のクリック数が分かります。</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ActionForm action={createTrackingLink} resetOnSuccess>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select name="offerId" aria-label="案件" defaultValue=""><option value="">案件を選ぶ（任意）</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
                  <Select name="platform" aria-label="既定の媒体" defaultValue=""><option value="">媒体（任意）</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
                  <Input name="url" aria-label="リンク先" placeholder="リンク先（空欄なら案件のURL）" className="sm:col-span-2" />
                  <Input name="name" aria-label="リンク名" placeholder="リンク名（任意）" />
                  <Input name="code" aria-label="コード" placeholder="コード（空欄で自動）" />
                </div>
                <SubmitButton variant="outline" size="sm" className="self-start">作成</SubmitButton>
              </ActionForm>
              {links.length === 0 ? <p className="text-sm text-muted-foreground">まだありません。</p> : (
                <ul className="flex flex-col divide-y text-sm">
                  {links.map((l) => {
                    const url = `${base}/go/${l.code}`;
                    return (
                      <li key={l.id} className="flex flex-col gap-1 py-2">
                        <div className="flex items-center justify-between gap-2"><strong className="truncate">{l.name}</strong><span className="tabular shrink-0 text-muted-foreground">{l._count.clicks}クリック</span></div>
                        <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded bg-muted px-1.5 py-0.5 text-xs">{url}</code><CopyButton text={url} /></div>
                        <p className="text-xs text-muted-foreground">媒体を分けるには末尾に <code>?ch=instagram</code> のように付けます。</p>
                        <form action={deleteTrackingLink}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-destructive hover:underline cursor-pointer">削除</button></form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
