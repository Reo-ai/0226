// 鍵がなくても入れる方法：公式LINEのID（@xxxx）を入れると、その場所の管理者の LINE に「許可しますか？」が届く
// 管理者が許可すると、頼んだ人がオーナーとして入れる（頼んだ画面は数秒おきに確かめて、自動で開く）
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { findWorkspaceByBasicId } from "./claim";
import { get, mainGet, mainRun } from "./db";
import { pushToFriend } from "./delivery";
import { baseUrl } from "./env";
import { adminLineIds } from "./lineConfig";
import type { Friend } from "./types";
import { runInWorkspace, withWs } from "./workspace";

export const JOIN_COOKIE = "join_req";
const TTL_MS = 30 * 60 * 1000;
const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export class JoinError extends Error {}

export interface JoinRequest {
  id: string;
  workspace_id: string;
  line_user_id: string;
  display_name: string;
  status: "pending" | "approved" | "denied";
  created_at: number;
}

/** 頼む：管理者の LINE に許可のお願いを送る */
export async function requestJoin(userId: string, name: string, rawId: string) {
  const basicId = `@${rawId.trim().replace(/^@+/, "").toLowerCase()}`;
  if (!/^@[0-9a-z._-]{3,}$/.test(basicId)) throw new JoinError("公式LINEのID（@から始まる英数字）を入れてください");
  const ws = await findWorkspaceByBasicId(basicId);
  if (!ws) throw new JoinError("この公式LINEはまだスキルステップに登録されていません。Channel ID と Channel secret を入れて始めてください");

  // 管理者のうち、この公式LINEの友だちになっている人に届ける
  const owners = await runInWorkspace(ws, adminLineIds);
  const targets = (
    await runInWorkspace(ws, () =>
      Promise.all(owners.map((u) => get<Friend>("SELECT * FROM friends WHERE line_user_id = ? AND blocked = 0", u))),
    )
  ).filter((f): f is Friend => Boolean(f));
  if (!targets.length) throw new JoinError("許可を出せる管理者に連絡できませんでした（管理者がこの公式LINEを友だち追加している必要があります）");

  const id = crypto.randomBytes(12).toString("hex");
  const secret = crypto.randomBytes(24).toString("base64url");
  const approve = crypto.randomBytes(24).toString("base64url");
  await mainRun("DELETE FROM join_requests WHERE created_at < ?", Date.now() - TTL_MS);
  await mainRun(
    "INSERT INTO join_requests (id, workspace_id, line_user_id, display_name, secret_hash, approve_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    ws,
    userId,
    name,
    hash(secret),
    hash(approve),
    Date.now(),
  );
  (await cookies()).set(JOIN_COOKIE, `${id}.${secret}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
  const link = withWs(`${baseUrl()}/approve/${approve}`, ws);
  const text = `📱 ${name || "だれか"}さんが、スキルステップの管理画面に入ろうとしています。\n心当たりがあれば、30分以内に許可してください。\n${link}`;
  let sent = 0;
  for (const f of targets) {
    try {
      await runInWorkspace(ws, () => pushToFriend(f, text, "manual"));
      sent++;
    } catch (e) {
      console.error("許可のお願いを送れませんでした", e);
    }
  }
  if (!sent) throw new JoinError("管理者の LINE に送れませんでした（今月の配信数が上限かもしれません）");
}

/** この画面が出したお願い（秘密の値が一致するものだけ） */
export async function ownJoinRequest(): Promise<JoinRequest | undefined> {
  const v = (await cookies()).get(JOIN_COOKIE)?.value;
  if (!v) return undefined;
  const [id, secret] = v.split(".");
  const r = await mainGet<JoinRequest & { secret_hash: string }>(
    "SELECT * FROM join_requests WHERE id = ? AND created_at >= ?",
    id,
    Date.now() - TTL_MS,
  );
  return r && secret && r.secret_hash === hash(secret) ? r : undefined;
}

export function requestByApproveToken(token: string) {
  return mainGet<JoinRequest>(
    "SELECT * FROM join_requests WHERE approve_hash = ? AND created_at >= ?",
    hash(token),
    Date.now() - TTL_MS,
  );
}

/** 管理者が許可・拒否する（許可したら、その人をオーナーとして入れる） */
export async function decideJoin(token: string, ok: boolean): Promise<JoinRequest | undefined> {
  const r = await requestByApproveToken(token);
  if (!r || r.status !== "pending") return r;
  await mainRun("UPDATE join_requests SET status = ? WHERE id = ? AND status = 'pending'", ok ? "approved" : "denied", r.id);
  if (ok) {
    await mainRun(
      "INSERT OR IGNORE INTO workspace_members (workspace_id, line_user_id, display_name, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
      r.workspace_id,
      r.line_user_id,
      r.display_name,
      Date.now(),
    );
  }
  return { ...r, status: ok ? "approved" : "denied" };
}
