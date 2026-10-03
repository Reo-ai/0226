// 使う人ごとの場所（ワークスペース）。1つのワークスペース = 1つの公式LINE = 1つのデータベース
// - "main" は最初からある内海さんの場所（環境変数の DATABASE_URL）
// - 招待で作られた場所は、それぞれ専用のデータベースを持つ（本番は Turso に自動作成、手元ではファイル）
// - どの場所の処理かは、リクエストのヘッダー x-ws（proxy.ts が URL やログイン情報から付ける）か、
//   定期実行などでは runInWorkspace() で決める
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

export const MAIN = "main";
const store = new AsyncLocalStorage<string>();

export function isValidWorkspaceId(ws: string | null | undefined): ws is string {
  return Boolean(ws) && (ws === MAIN || /^[a-z0-9]{10}$/.test(ws as string));
}

/** この中の処理は、指定したワークスペースのデータベースを使う（定期実行・Webhook の後処理など） */
export function runInWorkspace<T>(ws: string, fn: () => Promise<T>): Promise<T> {
  return store.run(ws, fn);
}

/** いま処理しているワークスペース */
export async function currentWorkspace(): Promise<string> {
  const fromStore = store.getStore();
  if (fromStore) return fromStore;
  try {
    const { headers } = await import("next/headers");
    const ws = (await headers()).get("x-ws");
    if (isValidWorkspaceId(ws)) return ws;
  } catch {
    // リクエストの外（スクリプトなど）
  }
  return MAIN;
}

export function newWorkspaceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.randomBytes(10), (b) => chars[b % chars.length]).join("");
}

/** 公開ページ（フォーム・計測リンク・記録ページ・流入経路）の URL に付けるワークスペースの目印 */
export function wsQuery(ws: string): string {
  return ws === MAIN ? "" : `w=${ws}`;
}

/** 既存の URL にワークスペースの目印を付ける */
export function withWs(url: string, ws: string): string {
  const q = wsQuery(ws);
  if (!q) return url;
  return url + (url.includes("?") ? "&" : "?") + q;
}
