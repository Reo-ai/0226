// 公式LINEとの連携情報。管理画面「LINE連携」で保存した値を優先し、無ければ環境変数を使う
import { getSetting, setSetting } from "./db";

export interface LineConfig {
  channelId: string;
  channelSecret: string;
  accessToken: string;
  basicId: string;
  displayName: string;
  pictureUrl: string;
}

const KEYS = {
  channelId: "line.channel_id",
  channelSecret: "line.channel_secret",
  accessToken: "line.access_token",
  basicId: "line.basic_id",
  displayName: "line.display_name",
  pictureUrl: "line.picture_url",
} as const;
const ADMIN_KEY = "admin.line_user_ids";

let cache: { value: LineConfig; at: number } | null = null;
const CACHE_MS = 30_000;

function envBasicId(): string {
  return (process.env.LINE_ADD_FRIEND_URL || "").match(/@[\w.-]+/)?.[0] ?? "";
}

export async function lineConfig(): Promise<LineConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value: LineConfig = {
    channelId: await getSetting(KEYS.channelId),
    channelSecret: (await getSetting(KEYS.channelSecret)) || process.env.LINE_CHANNEL_SECRET || "",
    accessToken: (await getSetting(KEYS.accessToken)) || process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    basicId: (await getSetting(KEYS.basicId)) || envBasicId(),
    displayName: await getSetting(KEYS.displayName),
    pictureUrl: await getSetting(KEYS.pictureUrl),
  };
  cache = { value, at: Date.now() };
  return value;
}

export async function saveLineConfig(next: LineConfig) {
  for (const k of Object.keys(KEYS) as (keyof LineConfig)[]) await setSetting(KEYS[k], next[k]);
  cache = null;
}

/** 公式LINEとつながっているか（アクセストークンがあるか） */
export async function lineConnected(): Promise<boolean> {
  return Boolean((await lineConfig()).accessToken);
}

/** 管理者の LINE ユーザーID（画面で登録した人 ＋ 環境変数） */
export async function adminLineIds(): Promise<string[]> {
  const saved = (await getSetting(ADMIN_KEY)).split(",");
  const env = (process.env.ADMIN_LINE_USER_IDS || "").split(",");
  return [...new Set([...saved, ...env].map((s) => s.trim()).filter(Boolean))];
}

/**
 * ログインしてよい LINE ユーザーか判定する。
 * 管理者がまだ1人もいなければ、最初にログインした人を管理者として登録する
 */
export async function authorizeAdmin(lineUserId: string): Promise<boolean> {
  const ids = await adminLineIds();
  if (ids.includes(lineUserId)) return true;
  if (ids.length > 0) return false;
  await setSetting(ADMIN_KEY, lineUserId);
  return true;
}
