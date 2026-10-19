"use client";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { num } from "@/lib/format";
import { optionalInt, percentToRate, simulate } from "@/lib/metrics";

export type SimDefaults = {
  target?: number | null;
  commission?: number | null;
  ctr?: number | null; // 0〜1
  cvr?: number | null;
  approval?: number | null;
  impressions?: number | null;
  clicks?: number | null;
};

const p = (r: number | null | undefined) => (r === null || r === undefined ? "" : String(+(r * 100).toFixed(3)));
const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** 逆算シミュレーター（入力された仮定に基づく計算。予測ではない） */
export function Simulator({ defaults = {}, compact = false }: { defaults?: SimDefaults; compact?: boolean }) {
  const id = useId();
  const [v, setV] = useState({
    target: n(defaults.target ?? 50000),
    commission: n(defaults.commission),
    ctr: p(defaults.ctr),
    cvr: p(defaults.cvr),
    approval: p(defaults.approval),
    impressions: n(defaults.impressions),
    clicks: n(defaults.clicks),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const r = simulate({
    targetConfirmedRevenue: optionalInt(v.target),
    confirmedPerConversion: optionalInt(v.commission),
    ctr: percentToRate(v.ctr),
    cvr: percentToRate(v.cvr),
    approvalRate: percentToRate(v.approval),
    currentImpressions: optionalInt(v.impressions),
    currentClicks: optionalInt(v.clicks),
  });
  const fields: [keyof typeof v, string, string][] = [
    ["target", "目標確定報酬（円）", ""],
    ["commission", "1件あたりの確定報酬（円）", "ASPの案件ページで確認"],
    ["ctr", "CTR（%）", "表示 → リンククリックの割合"],
    ["cvr", "CVR（%）", "クリック → 成約（発生）の割合"],
    ["approval", "承認率（%）", "発生 → 承認（確定）の割合"],
    ["impressions", "現在の表示回数（30日）", "任意"],
    ["clicks", "現在のクリック数（30日）", "任意"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
        {fields.map(([k, label, hint]) => (
          <Field key={k} label={label} htmlFor={`${id}-${k}`} hint={hint || undefined}>
            <Input id={`${id}-${k}`} inputMode="decimal" value={v[k]} onChange={set(k)} placeholder="未入力" />
          </Field>
        ))}
      </div>
      <div aria-live="polite" className="rounded-lg border bg-muted/50 p-4">
        {r.ok ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["必要表示回数", r.impressions, "回"],
                ["必要クリック数", r.clicks, "回"],
                ["必要発生成約数", r.conversions, "件"],
                ["必要承認済み成約数", r.approvedConversions, "件"],
              ].map(([l, val, u]) => (
                <div key={l as string}>
                  <dt className="text-xs text-muted-foreground">{l}</dt>
                  <dd className="tabular text-xl font-bold">{num(val as number)}<span className="text-sm font-normal">{u}</span></dd>
                </div>
              ))}
            </dl>
            {(r.impressionsGap !== null || r.clicksGap !== null) && (
              <p className="mt-3 text-sm">
                今の数字と比べると、{r.impressionsGap !== null && <>表示回数は<strong>{r.impressionsGap.toFixed(1)}倍</strong></>}
                {r.impressionsGap !== null && r.clicksGap !== null && "、"}
                {r.clicksGap !== null && <>クリック数は<strong>{r.clicksGap.toFixed(1)}倍</strong></>}が必要です。
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">入力した仮定に基づくシミュレーションです。収益の予測や保証ではありません。</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">計算できません：{r.missing.join("・")}を0より大きい値で入力してください（率は0〜100%）。</p>
        )}
      </div>
    </div>
  );
}
