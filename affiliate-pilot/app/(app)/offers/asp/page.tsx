import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { syncNetworks } from "@/lib/networks-sync";
import { requireProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "ASP一覧" };

export default async function NetworksPage() {
  await requireProfile();
  await syncNetworks();
  const networks = await prisma.affiliateNetwork.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { offers: true } } } });
  return (
    <>
      <PageHeader title="ASP一覧" description="主要ASPの特徴と登録の流れです。報酬額・最低支払額・審査基準などは変わるため、このアプリには載せていません。必ず公式サイトで確認してください。" />
      <div className="grid gap-4 md:grid-cols-2">
        {networks.map((n) => (
          <Card key={n.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle><Link href={`/offers/asp/${n.slug}`} className="hover:text-primary hover:underline">{n.name}</Link></CardTitle>
                <Badge variant={n.lastVerifiedAt ? "success" : "outline"}>{n.lastVerifiedAt ? `確認済み ${fmtDate(n.lastVerifiedAt)}` : "公式情報は未確認"}</Badge>
              </div>
              <CardDescription>登録した案件 {n._count.offers}件</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="line-clamp-3">{n.description}</p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/offers/asp/${n.slug}`} className="font-medium text-primary hover:underline">攻略ページ →</Link>
                <a href={n.officialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:underline"><ExternalLink className="size-3.5" />公式サイト</a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
