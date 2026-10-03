// 友だちの絞り込み条件（友だち一覧と一斉配信で共通）
import { all } from "./db";
import type { Friend } from "./types";

export interface Segment {
  /** このタグを持つ人（tagMode: any=いずれか / all=すべて） */
  tagIds: number[];
  tagMode: "any" | "all";
  /** このタグを持つ人は除く */
  excludeTagIds: number[];
  /** この流入経路から来た人 */
  sourceId: number | null;
  /** 習慣の連続日数がこれ以上の人 */
  habitMin: number | null;
  /** 友だち追加がこの日数以内の人 */
  addedWithinDays: number | null;
  /** 友だち情報欄の条件（値に含む） */
  fieldId: number | null;
  fieldValue: string;
}

export const emptySegment = (): Segment => ({
  tagIds: [],
  tagMode: "any",
  excludeTagIds: [],
  sourceId: null,
  habitMin: null,
  addedWithinDays: null,
  fieldId: null,
  fieldValue: "",
});

/** 一斉配信に保存された値（昔の形式はタグIDの配列）を読む */
export function parseSegment(json: string | null | undefined): Segment {
  try {
    const v = JSON.parse(json || "[]") as unknown;
    if (Array.isArray(v)) return { ...emptySegment(), tagIds: v.map(Number).filter(Boolean) };
    return { ...emptySegment(), ...(v as Partial<Segment>) };
  } catch {
    return emptySegment();
  }
}

const nums = (v: FormDataEntryValue[] | string[]) => v.map(Number).filter((n) => n > 0);
const optNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** フォームや URL の値から条件を作る */
export function segmentFrom(get: (k: string) => string | null, getAll: (k: string) => string[]): Segment {
  return {
    tagIds: nums(getAll("tagIds")),
    tagMode: get("tagMode") === "all" ? "all" : "any",
    excludeTagIds: nums(getAll("excludeTagIds")),
    sourceId: optNum(get("sourceId")),
    habitMin: optNum(get("habitMin")),
    addedWithinDays: optNum(get("addedWithinDays")),
    fieldId: optNum(get("fieldId")),
    fieldValue: (get("fieldValue") ?? "").trim(),
  };
}

export function isEmptySegment(s: Segment): boolean {
  return (
    !s.tagIds.length && !s.excludeTagIds.length && !s.sourceId && !s.habitMin && !s.addedWithinDays && !(s.fieldId && s.fieldValue)
  );
}

/** SQL の WHERE 句（friends を f として）にする */
export function segmentWhere(s: Segment): { where: string[]; args: (string | number)[] } {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (s.tagIds.length) {
    const ph = s.tagIds.map(() => "?").join(",");
    if (s.tagMode === "all") {
      where.push(`(SELECT COUNT(DISTINCT tag_id) FROM friend_tags WHERE friend_id = f.id AND tag_id IN (${ph})) = ?`);
      args.push(...s.tagIds, s.tagIds.length);
    } else {
      where.push(`f.id IN (SELECT friend_id FROM friend_tags WHERE tag_id IN (${ph}))`);
      args.push(...s.tagIds);
    }
  }
  if (s.excludeTagIds.length) {
    where.push(`f.id NOT IN (SELECT friend_id FROM friend_tags WHERE tag_id IN (${s.excludeTagIds.map(() => "?").join(",")}))`);
    args.push(...s.excludeTagIds);
  }
  if (s.sourceId) {
    where.push("f.source_id = ?");
    args.push(s.sourceId);
  }
  if (s.habitMin) {
    where.push("f.id IN (SELECT friend_id FROM habits WHERE streak >= ?)");
    args.push(s.habitMin);
  }
  if (s.addedWithinDays) {
    where.push("f.followed_at >= ?");
    args.push(Date.now() - s.addedWithinDays * 86400_000);
  }
  if (s.fieldId && s.fieldValue) {
    where.push("f.id IN (SELECT friend_id FROM friend_fields WHERE field_id = ? AND value LIKE ?)");
    args.push(s.fieldId, `%${s.fieldValue}%`);
  }
  return { where, args };
}

/** 配信対象：ブロックしていない友だちのうち、条件に合う人 */
export function segmentFriends(s: Segment): Promise<Friend[]> {
  const { where, args } = segmentWhere(s);
  return all<Friend>(`SELECT f.* FROM friends f WHERE f.blocked = 0${where.map((w) => ` AND ${w}`).join("")}`, ...args);
}
