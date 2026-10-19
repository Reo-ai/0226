import { ExternalLink, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COURSES } from "@/lib/academy";
import { markNetworkVerified } from "@/lib/actions/networks";
import { OFFER_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, yen } from "@/lib/format";
import { syncNetworks } from "@/lib/networks-sync";
import { requireProfile } from "@/lib/profile";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const n = await prisma.affiliateNetwork.findUnique({ where: { slug: (await params).slug } });
  return { title: n ? `${n.name}攻略` : "ASP" };
}

export default async function NetworkPage({ params }: Params) {
  const { slug } = await params;
  await requireProfile();
  await syncNetworks();
  const n = await prisma.affiliateNetwork.findUnique({ where: { slug }, include: { offers: { orderBy: { updatedAt: "desc" } } } });
  if (!n) notFound();
  // 攻略大学の「ASP完全攻略」から、このASPのレッスンを探す
  const asp = COURSES.find((c) => c.id === "asp");
  const key = n.name.replace(/アソシエイト|アフィリエイト|\.net/g, "").trim();
  const lesson = asp?.lessons.find((l) => l.title.includes(n.name) || l.title.includes(key));
  const steps = n.registrationGuide.split("\n").map((s) => s.replace(/^\d+\.\s*/, "")).filter(Boolean);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/offers/asp" className="text-primary hover:underline">ASP一覧</Link> / {n.name}</p>
      <PageHeader
        title={`${n.name} 攻略`}
        actions={<a href={n.officialUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}><ExternalLink />公式サイト</a>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>特徴</CardTitle></CardHeader>
            <CardContent className="text-sm leading-relaxed">{n.description}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>登録の流れ</CardTitle><CardDescription>一般的な流れです。必要な情報や審査の条件は公式サイトで確認してください。</CardDescription></CardHeader>
            <CardContent><ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>このASPで登録した案件</CardTitle>
              <Link href={`/offers?network=${n.id}`} className="text-sm text-primary hover:underline">案件分析で見る</Link>
            </CardHeader>
            <CardContent>
              {n.offers.length === 0 ? <p className="text-sm text-muted-foreground">まだありません。<Link href="/offers" className="text-primary underline">案件を登録</Link>するとき、ASPに「{n.name}」を選んでください。</p> : (
                <ul className="flex flex-col divide-y text-sm">
                  {n.offers.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/offers?edit=${o.id}`} className="font-medium hover:underline">{o.name}</Link>
                      <span className="flex items-center gap-2 text-muted-foreground"><Badge variant="outline">{OFFER_STATUS[o.partnershipStatus]}</Badge>{o.commissionAmount === null ? "報酬未登録" : yen(o.commissionAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>公式情報の確認</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p>最終確認日：<strong>{n.lastVerifiedAt ? fmtDate(n.lastVerifiedAt) : "未確認"}</strong></p>
              <p className="text-muted-foreground">報酬額・承認率・最低支払額・禁止事項などは変わることがあります。公式サイトで最新の内容を読んだら、確認日を記録しておきましょう。</p>
              <form action={markNetworkVerified} className="flex flex-wrap gap-2">
                <input type="hidden" name="slug" value={n.slug} />
                <SubmitButton size="sm" variant="outline">今日、公式サイトで確認した</SubmitButton>
                {n.lastVerifiedAt && <button name="undo" value="1" className="text-xs text-muted-foreground hover:underline cursor-pointer">未確認に戻す</button>}
              </form>
            </CardContent>
          </Card>
          {lesson && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="size-4" />攻略大学で学ぶ</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Link href={`/academy/asp/${lesson.id}`} className="font-medium text-primary hover:underline">{lesson.title} →</Link>
                <Link href="/academy/asp" className="text-muted-foreground hover:underline">講座「ASP完全攻略」全体を見る</Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
