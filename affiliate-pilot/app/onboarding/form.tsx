"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ErrorNote } from "@/components/ui/states";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { EXPERIENCE_LEVELS, PLATFORMS } from "@/lib/constants";

function plusDays(n: number) {
  const d = new Date(Date.now() + 9 * 3600_000 + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, null);
  const [existing, setExisting] = useState(false);
  const [challenge, setChallenge] = useState(false);
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle>1. 経験と目標</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="アフィリエイト経験" htmlFor="experienceLevel" className="sm:col-span-2">
            <Select id="experienceLevel" name="experienceLevel" defaultValue="none" required>
              {EXPERIENCE_LEVELS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </Select>
          </Field>
          <Field label="目標月収（確定報酬・円）" htmlFor="targetMonthlyRevenue" hint="ASPで承認された報酬で数えます">
            <Input id="targetMonthlyRevenue" name="targetMonthlyRevenue" inputMode="numeric" defaultValue="50000" required />
          </Field>
          <Field label="目標達成期限" htmlFor="targetDate" hint={challenge ? "チャレンジは30日間" : "初心者は90日が目安"}>
            <Input id="targetDate" name="targetDate" type="date" key={challenge ? "c" : "n"} defaultValue={plusDays(challenge ? 30 : 90)} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. 使える時間と予算</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="1日の作業可能時間（分）" htmlFor="dailyWorkMinutes" hint="今日のタスクはこの時間内に収めます">
            <Select id="dailyWorkMinutes" name="dailyWorkMinutes" defaultValue="90">
              {[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m}分` : `${m / 60}時間${m % 60 ? "半" : ""}`}</option>)}
            </Select>
          </Field>
          <Field label="月額予算（円）" htmlFor="monthlyBudget" hint="0円でも始められます（無料ツール優先）">
            <Input id="monthlyBudget" name="monthlyBudget" inputMode="numeric" defaultValue="0" required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. 発信する場所とジャンル</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-medium">利用する媒体（複数可・最初に選んだものをメインにします）</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent">
                  <input type="checkbox" name="platforms" value={p.id} className="size-4 accent-[var(--primary)]" defaultChecked={p.id === "instagram"} />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="ジャンル" htmlFor="niche" hint="例: 筋トレ、転職、育児、英語学習。迷っていれば空欄でOK（攻略大学で決め方を学べます）">
            <Input id="niche" name="niche" maxLength={60} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hasExistingAccount" className="size-4 accent-[var(--primary)]" checked={existing} onChange={(e) => { setExisting(e.target.checked); if (!e.target.checked) setChallenge(false); }} />
            すでに運用中のブログ・SNSアカウントがある
          </label>
          {existing && (
            <label className="flex items-start gap-2 rounded-lg border border-primary/40 bg-accent p-3 text-sm">
              <input type="checkbox" name="challengeMode" className="mt-0.5 size-4 accent-[var(--primary)]" checked={challenge} onChange={(e) => setChallenge(e.target.checked)} />
              <span>
                <strong>初月5万円チャレンジ</strong>で始める
                <span className="block text-muted-foreground">集客力のあるアカウント向けの30日間モード。今の数字から必要なクリック数・成約数を逆算します。</span>
              </span>
            </label>
          )}
        </CardContent>
      </Card>

      <ErrorNote message={state?.error} />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "作成中…" : "ロードマップを作って始める"}</Button>
    </form>
  );
}
