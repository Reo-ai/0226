import { prisma } from "./db";
import { addDays, dateKey, jstMonthStart, jstWeekStart } from "./format";
import { goalAchievement, rates, totals, type RecordLike, type Totals } from "./metrics";

export type Rec = RecordLike & {
  id: string;
  recordDate: Date;
  platform: string;
  affiliateOfferId: string | null;
  channelAccountId: string | null;
  publicationId: string | null;
  note: string;
  isDemo: boolean;
};

export async function records(from: Date, to?: Date): Promise<Rec[]> {
  return prisma.performanceRecord.findMany({
    where: { recordDate: { gte: from, ...(to ? { lt: to } : {}) } },
    orderBy: { recordDate: "asc" },
  });
}

export type Group = { key: string; label: string; totals: Totals; rates: ReturnType<typeof rates> };

/** 任意のキーで集計（未計測は 0 と区別したまま） */
export function groupBy(rows: Rec[], keyOf: (r: Rec) => string, labelOf: (k: string) => string = (k) => k): Group[] {
  const map = new Map<string, Rec[]>();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([key, rs]) => {
    const t = totals(rs);
    return { key, label: labelOf(key), totals: t, rates: rates(t) };
  });
}

export const byDay = (rows: Rec[]) => groupBy(rows, (r) => dateKey(r.recordDate)).sort((a, b) => a.key.localeCompare(b.key));
export const byWeek = (rows: Rec[]) =>
  groupBy(rows, (r) => dateKey(jstWeekStart(r.recordDate)), (k) => `${k.slice(5).replace("-", "/")}週`).sort((a, b) => a.key.localeCompare(b.key));
export const byMonth = (rows: Rec[]) =>
  groupBy(rows, (r) => dateKey(jstMonthStart(r.recordDate)).slice(0, 7), (k) => `${Number(k.slice(5))}月`).sort((a, b) => a.key.localeCompare(b.key));

/** 日別の系列（記録のない日も含める。記録のない日は null = 未計測） */
export function dailySeries(rows: Rec[], from: Date, days: number) {
  const map = new Map(byDay(rows).map((g) => [g.key, g.totals]));
  return Array.from({ length: days }, (_, i) => {
    const k = dateKey(addDays(from, i));
    const t = map.get(k);
    return { date: k.slice(5).replace("-", "/"), confirmed: t?.confirmedRevenue ?? null, pending: t?.pendingRevenue ?? null, clicks: t?.clicks ?? null };
  });
}

export async function monthSummary(target: number, now = new Date()) {
  const rows = await records(jstMonthStart(now));
  const t = totals(rows);
  return { totals: t, rates: rates(t), achievement: goalAchievement(t.confirmedRevenue, target), rowCount: rows.length };
}
