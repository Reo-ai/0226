import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { saveAccount } from "@/lib/actions/accounts";
import { PLATFORMS } from "@/lib/constants";

type Account = {
  id: string; platform: string; accountName: string; accountUrl: string; followerCount: number | null; monthlyImpressions: number | null;
  monthlyPosts: number | null; monthlyEngagements: number | null; monthlyProfileVisits: number | null; monthlyClicks: number | null;
  monthlyConversions: number | null; niche: string; targetAudience: string;
};

const NUMS: [keyof Account, string, string][] = [
  ["followerCount", "フォロワー数／読者数", "参考値（診断には使いません）"],
  ["monthlyImpressions", "直近30日の表示回数・閲覧数", "インプレッション、ブログはPV"],
  ["monthlyPosts", "直近30日の投稿数", ""],
  ["monthlyEngagements", "直近30日の反応数", "いいね＋コメント＋保存＋シェア"],
  ["monthlyProfileVisits", "直近30日のプロフィールアクセス", ""],
  ["monthlyClicks", "直近30日のリンククリック数", ""],
  ["monthlyConversions", "直近30日の成約数（発生）", ""],
];

export function AccountForm({ account, defaultNiche }: { account?: Account; defaultNiche?: string }) {
  const k = account?.id ?? "new";
  return (
    <ActionForm action={saveAccount} resetOnSuccess={!account} key={k}>
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="媒体" htmlFor={`platform-${k}`}>
          <Select id={`platform-${k}`} name="platform" defaultValue={account?.platform ?? "instagram"}>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="アカウント名・ブログ名" htmlFor={`accountName-${k}`}>
          <Input id={`accountName-${k}`} name="accountName" defaultValue={account?.accountName} required maxLength={80} />
        </Field>
        <Field label="URL（任意）" htmlFor={`accountUrl-${k}`} className="sm:col-span-2">
          <Input id={`accountUrl-${k}`} name="accountUrl" type="url" defaultValue={account?.accountUrl} placeholder="https://" />
        </Field>
        {NUMS.map(([name, label, hint]) => (
          <Field key={name} label={label} htmlFor={`${name}-${k}`} hint={hint || undefined}>
            <Input id={`${name}-${k}`} name={name} inputMode="numeric" defaultValue={(account?.[name] as number | null) ?? ""} placeholder="空欄＝未計測" />
          </Field>
        ))}
        <Field label="ジャンル" htmlFor={`niche-${k}`}>
          <Input id={`niche-${k}`} name="niche" defaultValue={account?.niche ?? defaultNiche} maxLength={60} />
        </Field>
        <Field label="ターゲット層" htmlFor={`targetAudience-${k}`}>
          <Input id={`targetAudience-${k}`} name="targetAudience" defaultValue={account?.targetAudience} placeholder="例: 20代後半の筋トレ初心者の会社員" maxLength={200} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">分からない数字は空欄のままにしてください。0 と「未計測」は区別して扱います。</p>
      <SubmitButton className="self-start">{account ? "更新する" : "登録する"}</SubmitButton>
    </ActionForm>
  );
}
