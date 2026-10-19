import { describe, expect, it } from "vitest";
import { challengeDailyTasks, diagnoseReadiness } from "@/lib/challenge";
import { candidateTasks, milestoneDone, priorityScore, selectWithinBudget, type PlannerState } from "@/lib/planner";

const state = (over: Partial<PlannerState> = {}, counts: Partial<PlannerState["counts"]> = {}): PlannerState => ({
  experienceLevel: "none", dailyWorkMinutes: 60, platforms: ["instagram"], challengeMode: false, dayIndex: 3, challengeDay: null,
  counts: { channels: 0, assessments: 0, offers: 0, approvedOffers: 0, trackingLinks: 0, drafts: 0, publications: 0, publicationsLast7d: 0, performanceRecords: 0, recordsLast7d: 0, lessonsCompleted: 0, completedCourses: [], ...counts },
  confirmedThisMonth: null, targetMonthlyRevenue: 50_000, ...over,
});

describe("作業時間の制限", () => {
  const tasks = [
    { id: "a", priority: 1, estimatedMinutes: 40 },
    { id: "b", priority: 1, estimatedMinutes: 30 },
    { id: "c", priority: 2, estimatedMinutes: 20 },
    { id: "d", priority: 3, estimatedMinutes: 15 },
  ];
  it("合計が作業可能時間を超えない", () => {
    for (const budget of [0, 10, 30, 45, 60, 90, 200]) {
      const picked = selectWithinBudget(tasks, budget);
      expect(picked.reduce((m, t) => m + t.estimatedMinutes, 0)).toBeLessThanOrEqual(budget);
    }
  });
  it("優先度の高いものから詰め、入らないものは飛ばす", () => {
    expect(selectWithinBudget(tasks, 60).map((t) => t.id)).toEqual(["b", "c"]);
  });
  it("期限切れのタスクを前に出す", () => {
    const now = new Date("2026-10-19T00:00:00Z");
    const overdue = { priority: 2, estimatedMinutes: 20, dueDate: new Date("2026-10-17T00:00:00Z") };
    const fresh = { priority: 1, estimatedMinutes: 20, dueDate: null };
    expect(priorityScore(overdue, now)).toBeLessThan(priorityScore({ priority: 2, estimatedMinutes: 20 }, now));
    expect(priorityScore(fresh, now)).toBeLessThan(priorityScore(overdue, now));
  });
});

describe("ルールベースのタスク生成", () => {
  it("初心者にはアカウント登録・講座・案件登録を提案", () => {
    const keys = candidateTasks(state()).map((t) => t.ruleKey);
    expect(keys).toEqual(expect.arrayContaining(["learn:asp", "setup:channel", "offers:register"]));
  });
  it("登録済みなら次の段階に進む", () => {
    const keys = candidateTasks(state({}, { channels: 1, assessments: 1, offers: 3, approvedOffers: 1, completedCourses: ["asp"] })).map((t) => t.ruleKey);
    expect(keys).not.toContain("setup:channel");
    expect(keys).toContain("offers:link");
  });
  it("チャレンジ中は30日プランの作業を含める", () => {
    const tasks = candidateTasks(state({ challengeDay: 0 }));
    expect(tasks.some((t) => t.ruleKey.startsWith("ch:0:"))).toBe(true);
  });
  it("チャレンジ期間外の日は作業なし", () => {
    expect(challengeDailyTasks(30)).toEqual([]);
  });
  it("マイルストーン判定", () => {
    const f = { completedCourses: ["asp"], channels: 1, assessments: 0, offers: 5, approvedOffers: 0, trackingLinks: 0, publications: 10, recordDays: 7, conversionsTotal: null, confirmedTotal: null, bestMonthConfirmed: 60_000, target: 50_000 };
    expect(milestoneDone("course-asp", f)).toBe(true);
    expect(milestoneDone("assessment", f)).toBe(false);
    expect(milestoneDone("pub10", f)).toBe(true);
    expect(milestoneDone("first-conversion", f)).toBe(false);
    expect(milestoneDone("target", f)).toBe(true);
  });
});

describe("チャレンジの準備状況", () => {
  const base = { platform: "instagram", followerCount: 50_000, impressions30d: null, clicks30d: null, conversions30d: null, hasOffer: true, commissionPerApproval: 3000 };
  it("フォロワーが多くても表示回数が未入力ならデータ不足", () => expect(diagnoseReadiness(base).code).toBe("traffic"));
  it("案件未定", () => expect(diagnoseReadiness({ ...base, impressions30d: 100_000, hasOffer: false, commissionPerApproval: null }).code).toBe("offer"));
  it("クリック率が低いと導線改善", () => expect(diagnoseReadiness({ ...base, impressions30d: 100_000, clicks30d: 50 }).code).toBe("funnel"));
  it("成約実績なし", () => expect(diagnoseReadiness({ ...base, impressions30d: 100_000, clicks30d: 1000, conversions30d: 0 }).code).toBe("track"));
  it("そろっていれば開始可能", () => expect(diagnoseReadiness({ ...base, impressions30d: 100_000, clicks30d: 1000, conversions30d: 5 }).code).toBe("ready"));
});
