import { get, getSetting } from "./db";
import { jstMonthStart } from "./format";

export class QuotaError extends Error {}

/** 月のプッシュ上限（LINEコミュニケーションプランは200通）。0は無制限 */
export async function pushLimit(): Promise<number> {
  return Number(await getSetting("push_limit", "200"));
}

/** 今月アプリから送ったプッシュ通数（1人への1回の送信 = 1通） */
export async function pushUsed(): Promise<number> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) n FROM messages WHERE channel = 'push' AND created_at >= ?",
    jstMonthStart(),
  );
  return row?.n ?? 0;
}

export async function pushRemaining(): Promise<number> {
  const limit = await pushLimit();
  if (limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - (await pushUsed()));
}

export async function assertPushQuota(count: number) {
  const remaining = await pushRemaining();
  if (count > remaining) {
    throw new QuotaError(
      `今月の無料通数が足りません（必要 ${count}通 / 残り ${remaining}通）。「反応があった人に無料で届ける」配信を使うか、来月まで待ってください。`,
    );
  }
}
