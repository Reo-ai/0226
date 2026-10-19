import { describe, expect, it } from "vitest";
import { approvalRate, confirmedPerHour, ctr, cvr, goalAchievement, percentToRate, ratio, simulate, sumMeasured, totals } from "@/lib/metrics";

describe("率の計算", () => {
  it("CTR = クリック ÷ 表示回数", () => expect(ctr(150, 10_000)).toBeCloseTo(0.015));
  it("CVR = 発生成約 ÷ クリック", () => expect(cvr(3, 150)).toBeCloseTo(0.02));
  it("承認率 = 承認済み ÷ 発生", () => expect(approvalRate(4, 5)).toBeCloseTo(0.8));
  it("目標達成率", () => expect(goalAchievement(25_000, 50_000)).toBe(0.5));
  it("1時間あたりの確定報酬", () => expect(confirmedPerHour(6_000, 120)).toBe(3_000));
  it("分母が0なら計算しない", () => {
    expect(ctr(0, 0)).toBeNull();
    expect(cvr(1, 0)).toBeNull();
    expect(confirmedPerHour(1000, 0)).toBeNull();
  });
  it("未計測（null）があれば計算しない", () => {
    expect(ctr(10, null)).toBeNull();
    expect(cvr(null, 100)).toBeNull();
    expect(ratio(undefined, 5)).toBeNull();
  });
  it("分子が0（計測済み）なら0%として計算する", () => expect(cvr(0, 100)).toBe(0));
});

describe("未計測と0の区別", () => {
  it("すべて未計測なら合計も未計測", () => expect(sumMeasured([null, undefined, null])).toBeNull());
  it("0 は計測値として合計に入る", () => expect(sumMeasured([null, 0])).toBe(0));
  it("未計測を飛ばして合計", () => expect(sumMeasured([100, null, 50])).toBe(150));
  it("totals は項目ごとに未計測を保つ", () => {
    const base = { impressions: null, clicks: null, conversions: null, approvedConversions: null, pendingRevenue: null, confirmedRevenue: null, paidRevenue: null, workMinutes: null };
    const t = totals([{ ...base, clicks: 10 }, { ...base, clicks: 5, confirmedRevenue: 0 }]);
    expect(t.clicks).toBe(15);
    expect(t.confirmedRevenue).toBe(0);
    expect(t.impressions).toBeNull();
  });
});

describe("逆算シミュレーター", () => {
  it("指示書の式どおりに切り上げで計算する", () => {
    const r = simulate({ targetConfirmedRevenue: 50_000, confirmedPerConversion: 3_000, approvalRate: 0.8, cvr: 0.02, ctr: 0.01 });
    // 承認 ceil(50000/3000)=17 → 発生 ceil(17/0.8)=22 → クリック ceil(22/0.02)=1100 → 表示 ceil(1100/0.01)=110000
    expect(r).toMatchObject({ ok: true, approvedConversions: 17, conversions: 22, clicks: 1100, impressions: 110_000 });
  });
  it("浮動小数の誤差で1つ多く切り上げない", () => {
    const r = simulate({ targetConfirmedRevenue: 50_000, confirmedPerConversion: 5_000, approvalRate: 1, cvr: 0.02, ctr: 0.1 });
    // 13/0.02 は JS では 650.0000000000001 になるが 650 にする
    const r2 = simulate({ targetConfirmedRevenue: 13, confirmedPerConversion: 1, approvalRate: 1, cvr: 0.02, ctr: 1 });
    expect(r).toMatchObject({ ok: true, approvedConversions: 10, conversions: 10, clicks: 500, impressions: 5000 });
    expect(r2).toMatchObject({ ok: true, clicks: 650 });
  });
  it("現在値との倍率を出す", () => {
    const r = simulate({ targetConfirmedRevenue: 50_000, confirmedPerConversion: 3_000, approvalRate: 0.8, cvr: 0.02, ctr: 0.01, currentImpressions: 55_000, currentClicks: 550 });
    expect(r.ok && r.impressionsGap).toBe(2);
    expect(r.ok && r.clicksGap).toBe(2);
  });
  it("ゼロ・未入力・範囲外は計算不能", () => {
    expect(simulate({ targetConfirmedRevenue: 50_000, confirmedPerConversion: 0, approvalRate: 0.8, cvr: 0.02, ctr: 0.01 })).toEqual({ ok: false, missing: ["1件あたりの確定報酬"] });
    const r = simulate({ targetConfirmedRevenue: 50_000, confirmedPerConversion: 3000, approvalRate: null, cvr: 1.5, ctr: undefined });
    expect(r).toEqual({ ok: false, missing: ["承認率", "CVR", "CTR"] });
  });
  it("% 入力を 0〜1 に変換", () => {
    expect(percentToRate("2.5")).toBeCloseTo(0.025);
    expect(percentToRate("")).toBeNull();
    expect(percentToRate("120")).toBeNull();
  });
});
