import { describe, expect, it } from "vitest";
import { assess, DEFAULT_CRITERIA, scale } from "@/lib/assessment";

const account = { platform: "instagram", followerCount: null, monthlyImpressions: null, monthlyPosts: null, monthlyEngagements: null, monthlyProfileVisits: null, monthlyClicks: null, monthlyConversions: null, niche: "" };
const fit = { approvedMatching: 0, candidateMatching: 0, anyApproved: 0 };

describe("アカウント戦闘力診断", () => {
  it("フォロワー数だけでは判定しない（データ不足）", () => {
    const r = assess({ ...account, followerCount: 1_000_000 }, fit);
    expect(r.stage).toBe("insufficient");
    expect(r.traffic).toBeNull();
    expect(r.overall).toBeNull();
  });
  it("十分なデータがそろうと段階を判定する", () => {
    const r = assess({ ...account, monthlyImpressions: 300_000, monthlyPosts: 20, monthlyEngagements: 18_000, monthlyProfileVisits: 3000, monthlyClicks: 2500, monthlyConversions: 60, niche: "筋トレ" }, { approvedMatching: 2, candidateMatching: 0, anyApproved: 2 });
    expect(r.stage).toBe("grown");
    expect(r.confidence).toBeGreaterThan(0.9);
  });
  it("優先すべき改善を3つ出す", () => {
    expect(assess({ ...account, monthlyImpressions: 2000 }, fit).recommendations).toHaveLength(3);
  });
  it("クリックが少ないうちは成約実績を判定しない", () => {
    expect(assess({ ...account, monthlyImpressions: 10_000, monthlyClicks: 10, monthlyConversions: 1 }, fit).conversion).toBeNull();
  });
  it("評価基準を変えると点数が変わる", () => {
    const strict = structuredClone(DEFAULT_CRITERIA);
    strict.platforms.instagram.monthlyImpressions = { low: 100_000, high: 1_000_000 };
    const a = { ...account, monthlyImpressions: 50_000 };
    expect(assess(a, fit, strict).traffic!).toBeLessThan(assess(a, fit).traffic!);
  });
  it("scale は low で20点・high 以上で100点", () => {
    expect(scale(1000, { low: 1000, high: 100_000 })).toBe(20);
    expect(scale(100_000, { low: 1000, high: 100_000 })).toBe(100);
    expect(scale(null, { low: 1, high: 2 })).toBeNull();
  });
});
