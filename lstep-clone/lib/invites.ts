// 招待リンク：内海さんが発行 → 受け取った人が LINE でログイン → その人専用のワークスペース（専用データベース）を作る
import crypto from "node:crypto";
import { mainGet, mainRun } from "./db";
import { newWorkspaceId } from "./workspace";

export const INVITE_COOKIE = "invite_code";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Invite {
  code: string;
  note: string;
  created_by: string;
  created_at: number;
  expires_at: number;
  used_by: string | null;
  used_at: number | null;
  workspace_id: string | null;
}

export async function createInvite(createdBy: string, note: string): Promise<string> {
  const code = crypto.randomBytes(12).toString("base64url");
  const now = Date.now();
  await mainRun(
    "INSERT INTO invites (code, note, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    code,
    note.slice(0, 100),
    createdBy,
    now,
    now + TTL_MS,
  );
  return code;
}

/** まだ使われておらず、期限内の招待 */
export async function validInvite(code: string | undefined | null): Promise<Invite | undefined> {
  if (!code) return undefined;
  return mainGet<Invite>("SELECT * FROM invites WHERE code = ? AND used_by IS NULL AND expires_at > ?", code, Date.now());
}

/** 新しいワークスペース用のデータベースを用意する（本番は Turso に作成、手元ではファイル） */
async function provisionDatabase(id: string): Promise<{ url: string; token: string | null }> {
  const apiToken = process.env.TURSO_API_TOKEN;
  const org = process.env.TURSO_ORG;
  if (!apiToken || !org) {
    if (process.env.VERCEL) throw new Error("TURSO_API_TOKEN と TURSO_ORG が未設定のため、データベースを作れません");
    return { url: `file:./data/ws-${id}.db`, token: null };
  }
  const name = `ss-${id}`;
  const headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };
  const created = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, group: process.env.TURSO_GROUP || "default" }),
  });
  if (!created.ok) throw new Error(`データベースの作成に失敗しました: ${created.status} ${await created.text()}`);
  const { database } = (await created.json()) as { database: { Hostname: string } };
  const tok = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases/${name}/auth/tokens?authorization=full-access`, {
    method: "POST",
    headers,
  });
  if (!tok.ok) throw new Error(`データベースの鍵の発行に失敗しました: ${tok.status} ${await tok.text()}`);
  const { jwt } = (await tok.json()) as { jwt: string };
  return { url: `libsql://${database.Hostname}`, token: jwt };
}

/** 招待を使って、その人のワークスペースを作る。作ったワークスペースのIDを返す（招待が無効なら null） */
export async function acceptInvite(code: string, lineUserId: string, displayName: string): Promise<string | null> {
  const invite = await validInvite(code);
  if (!invite) return null;
  // 先に「使用済み」にして、同じ招待で2つ作られないようにする
  const { changes } = await mainRun(
    "UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL",
    lineUserId,
    Date.now(),
    code,
  );
  if (changes === 0) return null;
  const id = newWorkspaceId();
  const db = await provisionDatabase(id);
  const now = Date.now();
  await mainRun(
    "INSERT INTO workspaces (id, name, owner_line_user_id, db_url, db_token, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    displayName ? `${displayName}さんの公式LINE` : "新しい公式LINE",
    lineUserId,
    db.url,
    db.token,
    now,
  );
  await mainRun(
    "INSERT INTO workspace_members (workspace_id, line_user_id, display_name, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
    id,
    lineUserId,
    displayName,
    now,
  );
  await mainRun("UPDATE invites SET workspace_id = ? WHERE code = ?", id, code);
  return id;
}
