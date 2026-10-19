import { criteriaSchema, DEFAULT_CRITERIA } from "./assessment";
import { getSetting } from "./settings";

export async function getCriteria() {
  return getSetting("assessment_criteria", criteriaSchema, DEFAULT_CRITERIA);
}

/** 率の指標（画面では % で入力） */
export const RATE_METRICS = ["engagementRate", "ctr", "profileToClick", "cvr"] as const;
export const METRIC_LABEL: Record<string, string> = {
  monthlyImpressions: "30日の表示回数（回）",
  engagementRate: "反応率（%）",
  ctr: "クリック率（%）",
  profileToClick: "プロフィール→クリック率（%）",
  cvr: "成約率（%）",
};
