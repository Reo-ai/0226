// 行動スコア：友だちの行動（メッセージ・クリック・回答・予約・タグ・購入）に点数を付けて、熱量の高い人を見つける
// 「○点に達したらタグを付ける」ルールで、ステップ配信やリッチメニューの切り替えにもつなげられる
import { all, get, run } from "./db";
import { addTag } from "./tags";

export type ScoreKind = "message" | "click" | "form" | "booking" | "tag" | "purchase";

export const SCORE_KINDS: { kind: ScoreKind; label: string; ref?: "link" | "form" | "tag" }[] = [
  { kind: "message", label: "メッセージを送ってきた" },
  { kind: "click", label: "計測リンクを開いた", ref: "link" },
  { kind: "form", label: "フォームに回答した", ref: "form" },
  { kind: "booking", label: "予約した" },
  { kind: "tag", label: "タグが付いた", ref: "tag" },
  { kind: "purchase", label: "購入した（Stripe）" },
];

export interface ScoreRule {
  id: number;
  kind: ScoreKind | "reach";
  ref_id: number | null;
  points: number;
}

/** 「○点に達したら」ルールで付けるタグを確かめる（old 未満 → new 以上になった時だけ） */
async function applyReach(friendId: number, oldScore: number, newScore: number) {
  if (newScore <= oldScore) return;
  const reach = await all<ScoreRule>("SELECT * FROM score_rules WHERE kind = 'reach' AND points > ? AND points <= ?", oldScore, newScore);
  for (const r of reach) if (r.ref_id) await addTag(friendId, r.ref_id);
}

/** 行動に応じて点数を足す（ルールが無ければ何もしない） */
export async function addScore(friendId: number | null | undefined, kind: ScoreKind, refId: number | null = null) {
  if (!friendId) return;
  const row = await get<{ p: number | null }>(
    "SELECT SUM(points) p FROM score_rules WHERE kind = ? AND (ref_id IS NULL OR ref_id = ?)",
    kind,
    refId,
  );
  const points = row?.p ?? 0;
  if (!points) return;
  await changeScore(friendId, points);
}

/** 点数を増減する（管理画面からの手動調整にも使う） */
export async function changeScore(friendId: number, delta: number) {
  const before = (await get<{ score: number }>("SELECT score FROM friends WHERE id = ?", friendId))?.score ?? 0;
  await run("UPDATE friends SET score = score + ? WHERE id = ?", delta, friendId);
  await applyReach(friendId, before, before + delta);
}

export function scoreRules(): Promise<ScoreRule[]> {
  return all<ScoreRule>("SELECT * FROM score_rules ORDER BY kind = 'reach', id");
}
