import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { saveOffer } from "@/lib/actions/offers";
import { OFFER_STATUS } from "@/lib/constants";
import { dateKey } from "@/lib/format";

type Offer = {
  id: string; affiliateNetworkId: string | null; name: string; category: string; offerUrl: string; commissionType: string; commissionAmount: number | null;
  commissionRate: number | null; averageOrderValue: number | null; conversionConditions: string; rejectionConditions: string; approvalRate: number | null;
  targetAudience: string; partnershipStatus: string; approvalTiming: string; notes: string; lastVerifiedAt: Date | null;
};

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const pc = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(+(v * 100).toFixed(2)));

/** 案件の登録・編集。最初は4項目だけ、残りは「くわしく入力」を開いたときだけ表示する */
export function OfferForm({ offer, networks }: { offer?: Offer; networks: { id: string; name: string }[] }) {
  const k = offer?.id ?? "new";
  const hasDetails = !!offer && !!(offer.category || offer.offerUrl || offer.conversionConditions || offer.rejectionConditions || offer.approvalRate !== null || offer.targetAudience || offer.approvalTiming || offer.notes || offer.commissionType === "rate");
  return (
    <ActionForm action={saveOffer} resetOnSuccess={!offer} key={k}>
      {offer && <input type="hidden" name="id" value={offer.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="案件名（商品・サービス名）" htmlFor={`o-name-${k}`} className="sm:col-span-2"><Input id={`o-name-${k}`} name="name" defaultValue={offer?.name} required maxLength={120} placeholder="ASPに表示されている名前" /></Field>
        <Field label="ASP" htmlFor={`o-net-${k}`}>
          <Select id={`o-net-${k}`} name="affiliateNetworkId" defaultValue={offer?.affiliateNetworkId ?? ""}>
            <option value="">選択しない</option>
            {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </Select>
        </Field>
        <Field label="1件の報酬（円）" htmlFor={`o-amt-${k}`} hint="ASPで確認した値。定率の案件は「くわしく入力」で"><Input id={`o-amt-${k}`} name="commissionAmount" inputMode="numeric" defaultValue={offer?.commissionType === "rate" ? "" : s(offer?.commissionAmount)} /></Field>
        <Field label="提携状態" htmlFor={`o-st-${k}`}>
          <Select id={`o-st-${k}`} name="partnershipStatus" defaultValue={offer?.partnershipStatus ?? "candidate"}>
            {Object.entries(OFFER_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="最終確認日" htmlFor={`o-lv-${k}`}><Input id={`o-lv-${k}`} name="lastVerifiedAt" type="date" defaultValue={offer?.lastVerifiedAt ? dateKey(offer.lastVerifiedAt) : dateKey(new Date())} /></Field>
      </div>
      <details className="rounded-lg border p-3" open={hasDetails}>
        <summary className="cursor-pointer text-sm font-medium">くわしく入力する（ジャンル・URL・成果条件・承認率・定率など）</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="ジャンル" htmlFor={`o-cat-${k}`}><Input id={`o-cat-${k}`} name="category" defaultValue={offer?.category} maxLength={60} /></Field>
          <Field label="対象ユーザー" htmlFor={`o-tg-${k}`}><Input id={`o-tg-${k}`} name="targetAudience" defaultValue={offer?.targetAudience} maxLength={200} /></Field>
          <Field label="商品URL・広告リンク" htmlFor={`o-url-${k}`} className="sm:col-span-2"><Input id={`o-url-${k}`} name="offerUrl" type="url" defaultValue={offer?.offerUrl} placeholder="https://" /></Field>
          <Field label="報酬の種類" htmlFor={`o-type-${k}`}>
            <Select id={`o-type-${k}`} name="commissionType" defaultValue={offer?.commissionType ?? "fixed"}>
              <option value="fixed">定額（1件◯円）</option>
              <option value="rate">定率（購入額の◯%）</option>
            </Select>
          </Field>
          <Field label="承認率（%）" htmlFor={`o-appr-${k}`} hint="ASPに掲載がなければ空欄"><Input id={`o-appr-${k}`} name="approvalRate" inputMode="decimal" defaultValue={pc(offer?.approvalRate)} /></Field>
          <Field label="料率（%・定率のとき）" htmlFor={`o-rate-${k}`}><Input id={`o-rate-${k}`} name="commissionRate" inputMode="decimal" defaultValue={pc(offer?.commissionRate)} /></Field>
          <Field label="平均購入額（円・定率のとき）" htmlFor={`o-aov-${k}`}><Input id={`o-aov-${k}`} name="averageOrderValue" inputMode="numeric" defaultValue={s(offer?.averageOrderValue)} /></Field>
          <Field label="成果条件" htmlFor={`o-cc-${k}`} className="sm:col-span-2"><Textarea id={`o-cc-${k}`} name="conversionConditions" defaultValue={offer?.conversionConditions} className="min-h-16" placeholder="例: 新規の無料会員登録完了" /></Field>
          <Field label="否認条件" htmlFor={`o-rc-${k}`} className="sm:col-span-2"><Textarea id={`o-rc-${k}`} name="rejectionConditions" defaultValue={offer?.rejectionConditions} className="min-h-16" placeholder="例: 重複・いたずら・既存会員" /></Field>
          <Field label="承認時期" htmlFor={`o-at-${k}`}><Input id={`o-at-${k}`} name="approvalTiming" defaultValue={offer?.approvalTiming} placeholder="例: 発生から約60日" maxLength={200} /></Field>
          <Field label="メモ" htmlFor={`o-nt-${k}`} className="sm:col-span-2"><Textarea id={`o-nt-${k}`} name="notes" defaultValue={offer?.notes} className="min-h-16" placeholder="NG表現、特徴、特別単価の条件など" /></Field>
        </div>
      </details>
      <p className="text-xs text-muted-foreground">報酬額・条件は、ASPの案件ページで確認した値だけを入力してください。分からない項目は空欄のままでOKです。</p>
      <SubmitButton className="self-start">{offer ? "更新する" : "登録する"}</SubmitButton>
    </ActionForm>
  );
}
