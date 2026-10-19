import type { Metadata } from "next";
import { getProfile } from "@/lib/profile";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "初期設定" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await getProfile();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}>
      <p className="text-sm font-medium text-primary">Affiliate Pilot AI</p>
      <h1 className="mt-1 text-2xl font-bold">{profile?.onboardedAt ? "目標と条件を設定し直す" : "はじめに、あなたの状況を教えてください"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        入力内容から「今日やること」と攻略ロードマップを作ります。あとから設定画面で変更できます。収益の達成を保証するものではありません。
      </p>
      <OnboardingForm />
    </main>
  );
}
