import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { startChallenge } from "@/lib/actions/challenge";
import { PLATFORMS } from "@/lib/constants";

type Offer = { id: string; name: string; commissionAmount: number | null; approvalRate: number | null };
type Account = { platform: string; followerCount: number | null; monthlyImpressions: number | null; monthlyClicks: number | null; monthlyConversions: number | null; niche: string } | undefined;

export function StartChallengeForm({ offers, account, dailyWorkMinutes, niche }: { offers: Offer[]; account: Account; dailyWorkMinutes: number; niche: string }) {
  const v = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));
  return (
    <ActionForm action={startChallenge}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="対象媒体" htmlFor="ch-platform">
          <Select id="ch-platform" name="platform" defaultValue={account?.platform ?? "instagram"}>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="フォロワー数" htmlFor="ch-f" hint="参考値"><Input id="ch-f" name="followerCount" inputMode="numeric" defaultValue={v(account?.followerCount)} placeholder="空欄＝未計測" /></Field>
        <Field label="直近30日の表示回数" htmlFor="ch-i"><Input id="ch-i" name="impressions30d" inputMode="numeric" defaultValue={v(account?.monthlyImpressions)} placeholder="空欄＝未計測" /></Field>
        <Field label="直近30日のリンククリック数" htmlFor="ch-c"><Input id="ch-c" name="clicks30d" inputMode="numeric" defaultValue={v(account?.monthlyClicks)} placeholder="空欄＝未計測" /></Field>
        <Field label="直近30日の成約実績（件）" htmlFor="ch-cv"><Input id="ch-cv" name="conversions30d" inputMode="numeric" defaultValue={v(account?.monthlyConversions)} placeholder="空欄＝未計測" /></Field>
        <Field label="ジャンル" htmlFor="ch-n"><Input id="ch-n" name="niche" defaultValue={account?.niche || niche} maxLength={60} /></Field>
        <Field label="紹介予定の案件" htmlFor="ch-o" hint={offers.length ? undefined : "案件分析で登録すると選べます"}>
          <Select id="ch-o" name="affiliateOfferId" defaultValue="">
            <option value="">未定</option>
            {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="1件あたりの確定報酬（円）" htmlFor="ch-r" hint="空欄なら案件の登録値を使います"><Input id="ch-r" name="commissionPerApproval" inputMode="numeric" placeholder="例: 3000" /></Field>
        <Field label="想定承認率（%）" htmlFor="ch-a" hint="分からなければ空欄"><Input id="ch-a" name="approvalRate" inputMode="decimal" placeholder="例: 80" /></Field>
        <Field label="想定CTR（%）" htmlFor="ch-ctr" hint="空欄なら実績から計算"><Input id="ch-ctr" name="ctr" inputMode="decimal" /></Field>
        <Field label="想定CVR（%）" htmlFor="ch-cvr" hint="空欄なら実績から計算"><Input id="ch-cvr" name="cvr" inputMode="decimal" /></Field>
        <Field label="1日の作業時間（分）" htmlFor="ch-m"><Input id="ch-m" name="dailyWorkMinutes" inputMode="numeric" defaultValue={dailyWorkMinutes} required /></Field>
        <Field label="報酬の承認時期" htmlFor="ch-t" hint="例: 発生から約60日で確定（ASPの案件ページで確認）" className="sm:col-span-2 lg:col-span-3">
          <Input id="ch-t" name="approvalTimingNote" maxLength={200} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">確定報酬はASPの承認後に計上されます。承認まで1〜3か月かかる案件では、30日以内に確定報酬が発生しないことがあります。</p>
      <SubmitButton className="self-start" size="lg" pendingLabel="診断中…">診断してチャレンジを始める</SubmitButton>
    </ActionForm>
  );
}
