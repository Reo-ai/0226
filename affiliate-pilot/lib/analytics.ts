import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, dateKey, jstMonthStart } from "./format";
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

/** 記録そのもの（一覧表示用）。集計には使わず、下の SQL 集計を使う */
export async function records(from: Date, to?: Date): Promise<Rec[]> {
  return prisma.performanceRecord.findMany({
    where: { recordDate: { gte: from, ...(to ? { lt: to } : {}) } },
    orderBy: { recordDate: "asc" },
  });
}

export type Group = { key: string; label: string; totals: Totals; rates: ReturnType<typeof rates> };

/**
 * 集計の単位。日付は JST（UTC+9 時間 = 32400 秒）で切る。
 * recordDate は SQLite に ミリ秒の整数で保存されている。
 */
const JST_DATE = Prisma.sql`date(recordDate / 1000 + 32400, 'unixepoch')`;
const GROUP_EXPR = {
  day: JST_DATE,
  // その週の月曜日: 6日戻してから次の月曜へ進める（月曜なら同じ日）
  week: Prisma.sql`date(recordDate / 1000 + 32400, 'unixepoch', '-6 days', 'weekday 1')`,
  month: Prisma.sql`strftime('%Y-%m', recordDate / 1000 + 32400, 'unixepoch')`,
  platform: Prisma.sql`platform`,
  offer: Prisma.sql`COALESCE(affiliateOfferId, '')`,
  all: Prisma.sql`'all'`,
} as const;
export type GroupKey = keyof typeof GROUP_EXPR;

type Row = { k: string | null } & { [K in keyof Totals]: bigint | number | null };

const n = (v: bigint | number | null) => (v === null || v === undefined ? null : Number(v));

/**
 * SQL で集計する。SUM は値がすべて NULL のとき NULL を返すので「未計測」がそのまま保たれ、
 * 0 と区別される（指標の定義は lib/metrics.ts と同じ）。
 */
export async function groupTotals(by: GroupKey, from: Date, to?: Date): Promise<Group[]> {
  const expr = GROUP_EXPR[by];
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT ${expr} AS k,
      SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(conversions) AS conversions,
      SUM(approvedConversions) AS approvedConversions, SUM(pendingRevenue) AS pendingRevenue,
      SUM(confirmedRevenue) AS confirmedRevenue, SUM(paidRevenue) AS paidRevenue, SUM(workMinutes) AS workMinutes
    FROM PerformanceRecord
    WHERE recordDate >= ${from.getTime()} ${to ? Prisma.sql`AND recordDate < ${to.getTime()}` : Prisma.empty}
    GROUP BY k ORDER BY k`;
  return rows.map((r) => {
    const t: Totals = {
      impressions: n(r.impressions), clicks: n(r.clicks), conversions: n(r.conversions), approvedConversions: n(r.approvedConversions),
      pendingRevenue: n(r.pendingRevenue), confirmedRevenue: n(r.confirmedRevenue), paidRevenue: n(r.paidRevenue), workMinutes: n(r.workMinutes),
    };
    const key = r.k ?? "";
    return { key, label: labelOf(by, key), totals: t, rates: rates(t) };
  });
}

function labelOf(by: GroupKey, key: string): string {
  if (by === "week") return `${key.slice(5).replace("-", "/")}週`;
  if (by === "month") return `${Number(key.slice(5))}月`;
  return key;
}

/** 期間全体の合計（SQL） */
export async function totalsBetween(from: Date, to?: Date): Promise<Totals> {
  const g = await groupTotals("all", from, to);
  return g[0]?.totals ?? totals([]);
}

/** 日別の系列（記録のない日も含める。記録のない日は null = 未計測） */
export async function dailySeries(from: Date, days: number) {
  const map = new Map((await groupTotals("day", from, addDays(from, days))).map((g) => [g.key, g.totals]));
  return Array.from({ length: days }, (_, i) => {
    const k = dateKey(addDays(from, i));
    const t = map.get(k);
    return { date: k.slice(5).replace("-", "/"), confirmed: t?.confirmedRevenue ?? null, pending: t?.pendingRevenue ?? null, clicks: t?.clicks ?? null };
  });
}

export async function monthSummary(target: number, now = new Date()) {
  const [t, rowCount] = await Promise.all([totalsBetween(jstMonthStart(now)), prisma.performanceRecord.count({ where: { recordDate: { gte: jstMonthStart(now) } } })]);
  return { totals: t, rates: rates(t), achievement: goalAchievement(t.confirmedRevenue, target), rowCount };
}

/** JS 側の集計（少量データ向け・テスト用）。SQL 集計と同じ定義 */
export function groupBy(rows: Rec[], keyOf: (r: Rec) => string, label: (k: string) => string = (k) => k): Group[] {
  const map = new Map<string, Rec[]>();
  for (const r of rows) map.set(keyOf(r), [...(map.get(keyOf(r)) ?? []), r]);
  return [...map.entries()].map(([key, rs]) => {
    const t = totals(rs);
    return { key, label: label(key), totals: t, rates: rates(t) };
  });
}

/** 前の期間との差（%）。どちらかが未計測、または前期が 0 なら null */
export function delta(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return (cur - prev) / prev;
}
