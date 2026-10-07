import { all, get, run } from "./db";
import { linkRichMenu, unlinkRichMenu } from "./line";
import type { Friend, RichMenu, RichMenuArea } from "./types";

export interface Layout {
  key: string;
  label: string;
  size: "full" | "half";
  cols: number;
  rows: number;
  /** 細い帯の高さ（px）。帯は最後のボタン（マス目の次）になる */
  strip?: number;
  /** 帯の位置（省略時は下） */
  stripAt?: "top" | "bottom";
}

export const LAYOUTS: Layout[] = [
  { key: "full-6", label: "大・6分割（3×2）", size: "full", cols: 3, rows: 2 },
  { key: "full-4", label: "大・4分割（2×2）", size: "full", cols: 2, rows: 2 },
  { key: "full-4-strip-top", label: "大・4分割（2×2）＋上の細い帯", size: "full", cols: 2, rows: 2, strip: 240, stripAt: "top" },
  { key: "full-4-strip", label: "大・4分割（2×2）＋下の細い帯", size: "full", cols: 2, rows: 2, strip: 240 },
  { key: "full-3", label: "大・3分割（縦長3列）", size: "full", cols: 3, rows: 1 },
  { key: "full-2", label: "大・2分割（上下）", size: "full", cols: 1, rows: 2 },
  { key: "full-1", label: "大・1枚", size: "full", cols: 1, rows: 1 },
  { key: "half-3", label: "小・3分割", size: "half", cols: 3, rows: 1 },
  { key: "half-2", label: "小・2分割", size: "half", cols: 2, rows: 1 },
  { key: "half-1", label: "小・1枚", size: "half", cols: 1, rows: 1 },
];

export function layoutOf(key: string): Layout {
  return LAYOUTS.find((l) => l.key === key) ?? LAYOUTS[0];
}

/** ボタンの数（マス目＋細い帯） */
export function areaCount(l: Pick<Layout, "cols" | "rows" | "strip">) {
  return l.cols * l.rows + (l.strip ? 1 : 0);
}

export function imageSize(l: Layout) {
  return { width: 2500, height: l.size === "full" ? 1686 : 843 };
}

export function action(a: RichMenuArea) {
  switch (a.type) {
    case "message":
      return { type: "message", text: a.value };
    case "uri":
      return { type: "uri", uri: a.value };
    case "tag":
      return { type: "postback", data: `tag=${a.value}` };
    case "form":
      return { type: "postback", data: `form=${a.value}` };
    default:
      return null;
  }
}

/** LINE APIに渡すリッチメニュー定義を組み立てる */
export function buildDefinition(name: string, chatBarText: string, layoutKey: string, areas: RichMenuArea[]) {
  const l = layoutOf(layoutKey);
  const size = imageSize(l);
  // 細い帯があれば、マス目は帯を除いた高さに収める（帯が上なら、マス目はその下から）
  const gridH = size.height - (l.strip ?? 0);
  const top = l.strip && l.stripAt === "top" ? l.strip : 0;
  const w = Math.floor(size.width / l.cols);
  const h = Math.floor(gridH / l.rows);
  const bounds = [];
  for (let r = 0; r < l.rows; r++) {
    for (let c = 0; c < l.cols; c++) {
      const a = areas[r * l.cols + c];
      const act = a && action(a);
      if (!act) continue;
      bounds.push({
        bounds: {
          x: c * w,
          y: top + r * h,
          width: c === l.cols - 1 ? size.width - c * w : w,
          height: r === l.rows - 1 ? gridH - r * h : h,
        },
        action: act,
      });
    }
  }
  if (l.strip) {
    const a = areas[l.cols * l.rows];
    const act = a && action(a);
    if (act) bounds.push({ bounds: { x: 0, y: top ? 0 : gridH, width: size.width, height: l.strip }, action: act });
  }
  return { size, selected: true, name: name.slice(0, 300), chatBarText: chatBarText.slice(0, 14), areas: bounds };
}

/**
 * 友だちのタグに応じてリッチメニューを切り替える（API呼び出しは無料）。
 * 一番最近付いたタグに対応するメニューを優先。該当なしならデフォルトに戻す。
 */
export async function syncRichMenu(friendId: number) {
  const friend = await get<Friend>("SELECT * FROM friends WHERE id = ?", friendId);
  if (!friend || friend.blocked) return;
  const match = await get<RichMenu>(
    `SELECT rm.* FROM rich_menus rm JOIN friend_tags ft ON ft.tag_id = rm.tag_id
     WHERE ft.friend_id = ? AND rm.line_rich_menu_id IS NOT NULL
     ORDER BY ft.created_at DESC, rm.id DESC LIMIT 1`,
    friendId,
  );
  const target = match?.id ?? null;
  if (target === friend.rich_menu_id) return;
  try {
    if (match?.line_rich_menu_id) await linkRichMenu(friend.line_user_id, match.line_rich_menu_id);
    else await unlinkRichMenu(friend.line_user_id);
    await run("UPDATE friends SET rich_menu_id = ? WHERE id = ?", target, friendId);
  } catch (e) {
    console.error("rich menu sync failed", e);
  }
}

/** タグ付きメニューを作成/変更した時、該当タグの友だち全員に反映 */
export async function syncRichMenuForTag(tagId: number) {
  const rows = await all<{ friend_id: number }>("SELECT friend_id FROM friend_tags WHERE tag_id = ?", tagId);
  for (const r of rows) await syncRichMenu(r.friend_id);
}
