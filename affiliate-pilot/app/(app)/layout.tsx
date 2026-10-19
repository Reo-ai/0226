import { Header } from "@/components/shell/header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  const sample = (await prisma.performanceRecord.count({ where: { isDemo: true } })) + (await prisma.affiliateOffer.count({ where: { isDemo: true } }));
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">本文へ移動</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        {sample > 0 && (
          <div role="note" className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm">
            サンプルデータを表示中です（実際の収益・案件ではありません）。<Link href="/settings#sample" className="font-medium underline">設定から削除</Link>
          </div>
        )}
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 pb-28 pt-6 lg:pb-12"
          style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
