// 公式LINEとの連携情報。管理画面「LINE連携」で保存した値を優先し、無ければ環境変数を使う
import { getSetting, mainAll, setSetting } from "./db";
import { currentWorkspace, MAIN } from "./workspace";

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

// 30秒だけ覚えておく（ワークスペースごとに別々）
const cache = new Map<string, { value: LineConfig; at: number }>();
const CACHE_MS = 30_000;

function envBasicId(): string {
  return (process.env.LINE_ADD_FRIEND_URL || "").match(/@[\w.-]+/)?.[0] ?? "";
}

export async function lineConfig(): Promise<LineConfig> {
  const ws = await currentWorkspace();
  const hit = cache.get(ws);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  // 環境変数の値は main（内海さんの公式LINE）だけの予備
  const env = ws === MAIN;
  const value: LineConfig = {
    channelId: await getSetting(KEYS.channelId),
    channelSecret: (await getSetting(KEYS.channelSecret)) || (env ? process.env.LINE_CHANNEL_SECRET : "") || "",
    accessToken: (await getSetting(KEYS.accessToken)) || (env ? process.env.LINE_CHANNEL_ACCESS_TOKEN : "") || "",
    basicId: (await getSetting(KEYS.basicId)) || (env ? envBasicId() : ""),
    displayName: await getSetting(KEYS.displayName),
    pictureUrl: await getSetting(KEYS.pictureUrl),
  };
  cache.set(ws, { value, at: Date.now() });
  return value;
}

export async function saveLineConfig(next: LineConfig) {
  for (const k of Object.keys(KEYS) as (keyof LineConfig)[]) await setSetting(KEYS[k], next[k]);
  cache.delete(await currentWorkspace());
}

/** 公式LINEとつながっているか（長期トークン、またはチャネルID＋シークレットがあるか） */
export async function lineConnected(): Promise<boolean> {
  const c = await lineConfig();
  return Boolean(c.accessToken || (c.channelId && c.channelSecret));
}

// 発行したステートレストークン（チャネルごと）
const issued = new Map<string, { token: string; until: number }>();

/**
 * API呼び出しに使うトークン。長期トークンが無ければ、チャネルID＋シークレットから
 * ステートレストークン（15分有効・発行数の上限なし）をその都度発行する
 */
export async function accessToken(): Promise<string> {
  const c = await lineConfig();
  if (c.accessToken) return c.accessToken;
  if (!c.channelId || !c.channelSecret) return "";
  const key = `${c.channelId}:${c.channelSecret}`;
  const hit = issued.get(key);
  if (hit && Date.now() < hit.until) return hit.token;
  const token = await issueStatelessToken(c.channelId, c.channelSecret);
  issued.set(key, { token, until: Date.now() + 10 * 60 * 1000 });
  return token;
}

/** チャネルID＋シークレットからステートレストークンを発行する。値が違えば例外 */
export async function issueStatelessToken(channelId: string, channelSecret: string): Promise<string> {
  const res = await fetch("https://api.line.me/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: channelId, client_secret: channelSecret }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** 管理者の LINE ユーザーID（画面で登録した人 ＋ 環境変数） */
export async function adminLineIds(): Promise<string[]> {
  const ws = await currentWorkspace();
  if (ws !== MAIN) {
    const rows = await mainAll<{ line_user_id: string }>("SELECT line_user_id FROM workspace_members WHERE workspace_id = ?", ws);
    return rows.map((r) => r.line_user_id);
  }
  const saved = (await getSetting(ADMIN_KEY)).split(",");
  const env = (process.env.ADMIN_LINE_USER_IDS || "").split(",");
  // main に招待されたスタッフ
  const staff = (await mainAll<{ line_user_id: string }>("SELECT line_user_id FROM workspace_members WHERE workspace_id = ?", MAIN)).map(
    (r) => r.line_user_id,
  );
  return [...new Set([...saved, ...env, ...staff].map((s) => s.trim()).filter(Boolean))];
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
