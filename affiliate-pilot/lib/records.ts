import { dateKey } from "./format";

/** 同じ日・媒体・アカウント・案件・公開の組み合わせは1件にまとめ、二重集計を防ぐ */
export function dedupeKey(r: { recordDate: Date; platform: string; channelAccountId?: string | null; affiliateOfferId?: string | null; publicationId?: string | null }): string {
  return [dateKey(r.recordDate), r.platform, r.channelAccountId ?? "-", r.affiliateOfferId ?? "-", r.publicationId ?? "-"].join("|");
}

export const RECORD_FIELDS = [
  ["impressions", "表示回数"],
  ["clicks", "クリック数"],
  ["conversions", "発生成約数"],
  ["approvedConversions", "承認済み成約数"],
  ["pendingRevenue", "発生報酬"],
  ["confirmedRevenue", "確定報酬"],
  ["paidRevenue", "入金額"],
  ["workMinutes", "作業時間（分）"],
] as const;
export type RecordField = (typeof RECORD_FIELDS)[number][0];

export const RECORD_CSV_HEADER = ["日付", "媒体", "アカウント", "案件", "公開URL", ...RECORD_FIELDS.map(([, l]) => l), "メモ"];

export const RECORD_CSV_ALIASES: Record<string, string[]> = {
  date: ["日付", "date"],
  platform: ["媒体", "platform"],
  account: ["アカウント", "account"],
  offer: ["案件", "案件名", "offer"],
  url: ["公開URL", "URL"],
  note: ["メモ", "note"],
  ...Object.fromEntries(RECORD_FIELDS.map(([k, l]) => [k, [l, k, l.replace(/（.*）/, "")]])),
};
