// クロス分析：友だちを「行 × 列」の2つの切り口で数える（例：流入元 × タグ、追加した月 × アンケートの答え）
import { all } from "./db";

export type Dim = "tag" | "source" | "month" | "score" | "booked" | `field:${number}`;

export interface CrossTable {
  rows: string[];
  cols: string[];
  /** counts[row][col] */
  counts: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  total: number;
}

const NONE = "（なし）";

/** 友だちごとに、その切り口での値（複数あり得る：タグなど）を求める */
async function valuesOf(dim: Dim): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  const push = (id: number, v: string) => {
    const a = map.get(id);
    if (a) a.push(v);
    else map.set(id, [v]);
  };
  if (dim === "tag") {
    for (const r of await all<{ friend_id: number; name: string }>(
      "SELECT ft.friend_id, t.name FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id",
    ))
      push(r.friend_id, r.name);
  } else if (dim === "source") {
    for (const r of await all<{ id: number; name: string }>("SELECT f.id, s.name FROM friends f JOIN sources s ON s.id = f.source_id"))
      push(r.id, r.name);
  } else if (dim === "month") {
    for (const r of await all<{ id: number; followed_at: number }>("SELECT id, followed_at FROM friends WHERE followed_at IS NOT NULL"))
      push(r.id, new Date(r.followed_at + 9 * 3600_000).toISOString().slice(0, 7));
  } else if (dim === "score") {
    for (const r of await all<{ id: number; score: number }>("SELECT id, score FROM friends")) {
      const s = r.score ?? 0;
      push(r.id, s <= 0 ? "0点" : s < 10 ? "1〜9点" : s < 30 ? "10〜29点" : s < 100 ? "30〜99点" : "100点以上");
    }
  } else if (dim === "booked") {
    for (const r of await all<{ friend_id: number }>("SELECT DISTINCT friend_id FROM bookings WHERE status = 'booked' AND friend_id IS NOT NULL"))
      push(r.friend_id, "予約あり");
  } else if (dim.startsWith("field:")) {
    const fieldId = Number(dim.slice(6));
    for (const r of await all<{ friend_id: number; value: string }>("SELECT friend_id, value FROM friend_fields WHERE field_id = ?", fieldId)) {
      // チェックボックスの答え（「A, B」）は1つずつ数える
      for (const v of r.value.split(/,\s*/).map((x) => x.trim()).filter(Boolean)) push(r.friend_id, v);
    }
  }
  return map;
}

const SCORE_ORDER = ["0点", "1〜9点", "10〜29点", "30〜99点", "100点以上"];

function sortKeys(dim: Dim, keys: string[], totals: Record<string, number>): string[] {
  const rest = keys.filter((k) => k !== NONE);
  if (dim === "month") rest.sort();
  else if (dim === "score") rest.sort((a, b) => SCORE_ORDER.indexOf(a) - SCORE_ORDER.indexOf(b));
  else rest.sort((a, b) => totals[b] - totals[a] || a.localeCompare(b, "ja"));
  return keys.includes(NONE) ? [...rest, NONE] : rest;
}

/** ブロックしていない友だち（includeBlocked なら全員）を、行 × 列で数える */
export async function crossTable(rowDim: Dim, colDim: Dim, includeBlocked = false): Promise<CrossTable> {
  const friends = await all<{ id: number }>(`SELECT id FROM friends${includeBlocked ? "" : " WHERE blocked = 0"}`);
  const [rv, cv] = await Promise.all([valuesOf(rowDim), valuesOf(colDim)]);
  const counts: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  for (const { id } of friends) {
    const rs = rv.get(id) ?? [NONE];
    const cs = cv.get(id) ?? [NONE];
    for (const r of new Set(rs)) {
      rowTotals[r] = (rowTotals[r] ?? 0) + 1;
      for (const c of new Set(cs)) (counts[r] ??= {})[c] = (counts[r][c] ?? 0) + 1;
    }
    for (const c of new Set(cs)) colTotals[c] = (colTotals[c] ?? 0) + 1;
  }
  return {
    rows: sortKeys(rowDim, Object.keys(rowTotals), rowTotals),
    cols: sortKeys(colDim, Object.keys(colTotals), colTotals),
    counts,
    rowTotals,
    colTotals,
    total: friends.length,
  };
}
