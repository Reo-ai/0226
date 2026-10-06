// 公式LINEの鍵（Channel ID と Channel secret）でログイン先を決める
// 鍵を入れられる＝その公式LINEの持ち主（管理者）とみなす。招待は要らない
// - すでに登録された公式LINE → その場所にオーナーとして入る
// - 新しい公式LINE → その人専用の場所を作り、公式LINEをつなぐ
import { mainAll, mainGet, mainRun } from "./db";
import { baseUrl } from "./env";
import { createWorkspaceFor } from "./invites";
import { fetchBotInfo, setupWebhook } from "./line";
import { issueStatelessToken, lineConfig, saveLineConfig } from "./lineConfig";
import { MAIN, runInWorkspace } from "./workspace";

export class ClaimError extends Error {}

/** 公式LINEのID（@xxxx）がすでに登録されている場所を探す */
async function findWorkspaceByBasicId(basicId: string): Promise<string | null> {
  if ((await runInWorkspace(MAIN, lineConfig)).basicId === basicId) return MAIN;
  const hit = await mainGet<{ id: string }>("SELECT id FROM workspaces WHERE line_basic_id = ?", basicId);
  if (hit) return hit.id;
  // 記録が無い古い場所は、中身を見て確かめる（あとで速く探せるよう記録しておく）
  for (const w of await mainAll<{ id: string }>("SELECT id FROM workspaces WHERE line_basic_id IS NULL")) {
    try {
      const b = (await runInWorkspace(w.id, lineConfig)).basicId;
      if (b) await mainRun("UPDATE workspaces SET line_basic_id = ? WHERE id = ?", b, w.id);
      if (b === basicId) return w.id;
    } catch {
      // 開けない場所は飛ばす
    }
  }
  return null;
}

/** 鍵を確かめて、入る場所のIDと「新しく作ったか」を返す */
export async function claimByLineKeys(
  userId: string,
  name: string,
  channelId: string,
  channelSecret: string,
): Promise<{ ws: string; created: boolean; webhookError?: string }> {
  let token: string;
  try {
    token = await issueStatelessToken(channelId, channelSecret);
  } catch {
    throw new ClaimError("Channel ID か Channel secret が違います。LINE Developers の「チャネル基本設定」の値をそのままコピーしてください");
  }
  const info = await fetchBotInfo(token);
  if (!info.basicId) throw new ClaimError("公式LINEの情報を読み取れませんでした。Messaging API のチャネルか確かめてください");

  const existing = await findWorkspaceByBasicId(info.basicId);
  if (existing) {
    await mainRun(
      "INSERT OR IGNORE INTO workspace_members (workspace_id, line_user_id, display_name, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
      existing,
      userId,
      name,
      Date.now(),
    );
    return { ws: existing, created: false };
  }

  const ws = await createWorkspaceFor(userId, name);
  await mainRun("UPDATE workspaces SET line_basic_id = ?, name = ? WHERE id = ?", info.basicId, info.displayName || `${name}さんの公式LINE`, ws);
  let webhookError: string | undefined;
  await runInWorkspace(ws, async () => {
    await saveLineConfig({
      channelId,
      channelSecret,
      accessToken: "",
      basicId: info.basicId,
      displayName: info.displayName,
      pictureUrl: info.pictureUrl ?? "",
    });
    try {
      const test = await setupWebhook(token, `${baseUrl()}/api/line/webhook/${ws}`);
      if (!test.success) webhookError = test.reason ?? "LINEからの受信確認に失敗しました";
    } catch (e) {
      webhookError = (e as Error).message;
    }
  });
  return { ws, created: true, webhookError };
}
