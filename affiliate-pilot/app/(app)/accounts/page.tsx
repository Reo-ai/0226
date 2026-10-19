import { Gauge, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { deleteAccount } from "@/lib/actions/accounts";
import { platformLabel, STAGE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { num } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { AccountForm } from "./account-form";

export const metadata: Metadata = { title: "アカウント" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const profile = await requireProfile();
  const accounts = await prisma.channelAccount.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" },
    include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1 } },
  });
  const editing = accounts.find((a) => a.id === edit);
  return (
    <>
      <PageHeader title="SNS・ブログアカウント" description="発信しているアカウントの直近30日の数字を登録します。戦闘力診断と初月5万円チャレンジで使います。" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          {accounts.length === 0 && <EmptyState title="まだアカウントがありません" description="右のフォームから登録してください。ブログ1つ・SNS1つからで十分です。" />}
          {accounts.map((a) => {
            const last = a.assessments[0];
            return (
              <Card key={a.id}>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{a.accountName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{platformLabel(a.platform)}{a.niche && `・${a.niche}`}{a.isDemo && "・デモ"}</p>
                  </div>
                  {last && <Badge variant={last.stage === "grown" ? "success" : last.stage === "insufficient" ? "outline" : "secondary"}>{STAGE_LABEL[last.stage]}{last.overallScore !== null && ` ${last.overallScore}点`}</Badge>}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    {[["表示回数", a.monthlyImpressions], ["反応数", a.monthlyEngagements], ["クリック", a.monthlyClicks], ["成約", a.monthlyConversions]].map(([l, v]) => (
                      <div key={l as string}><dt className="text-xs text-muted-foreground">{l}</dt><dd className="tabular">{num(v as number | null)}</dd></div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/accounts/assessment?account=${a.id}`} className={buttonVariants({ size: "sm" })}><Gauge />診断する</Link>
                    <Link href={`/accounts?edit=${a.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}><Pencil />編集</Link>
                    <ConfirmDialog
                      trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 />削除</Button>}
                      title="アカウントを削除しますか？"
                      description="診断履歴も削除されます。成果記録は残りますが、このアカウントとの紐づけは外れます。"
                      confirmLabel="削除する"
                      formAction={deleteAccount}
                      hidden={{ id: a.id }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{editing ? `「${editing.accountName}」を編集` : "アカウントを登録"}</CardTitle>
            {editing && <Link href="/accounts" className="text-sm text-primary hover:underline">新規登録に戻る</Link>}
          </CardHeader>
          <CardContent><AccountForm account={editing} defaultNiche={profile.niche} /></CardContent>
        </Card>
      </div>
    </>
  );
}
