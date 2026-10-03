import { redirect } from "next/navigation";
import { createInviteAction, revokeInvite } from "@/lib/actions";
import { sessionUser } from "@/lib/auth";
import { mainAll } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";
import type { Invite } from "@/lib/invites";
import { adminLineIds } from "@/lib/lineConfig";
import { MAIN, runInWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// 招待の管理（内海さんだけ）：招待リンクを作って、使いたい人に送る
export default async function InvitesPage() {
  const user = await sessionUser();
  if (!user || !(await runInWorkspace(MAIN, adminLineIds)).includes(user)) redirect("/dashboard");
  const invites = await mainAll<Invite & { ws_name: string | null }>(
    `SELECT i.*, w.name ws_name FROM invites i LEFT JOIN workspaces w ON w.id = i.workspace_id ORDER BY i.created_at DESC LIMIT 100`,
  );
  const members = await mainAll<{ name: string; display_name: string; created_at: number }>(
    `SELECT w.name, m.display_name, m.created_at FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id ORDER BY w.created_at`,
  );
  const now = Date.now();
  const base = baseUrl();
  return (
    <>
      <h1>招待</h1>
      <form action={createInviteAction} className="panel row">
        <input name="note" placeholder="誰に送るか（メモ。例：母、〇〇さん）" style={{ flex: 1, minWidth: 220 }} />
        <button>招待リンクを作る</button>
      </form>
      <p className="hint">
        招待リンクは1回だけ・7日間有効です。受け取った人が LINE でログインすると、その人専用の場所（自分の公式LINE用）ができます。あなたのデータは見えません。
      </p>
      <div className="panel">
        <h2>招待リンク</h2>
        <table>
          <thead>
            <tr>
              <th>メモ</th>
              <th>リンク</th>
              <th>状態</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => {
              const status = i.used_by ? `使用済み（${i.ws_name ?? ""}）` : i.expires_at <= now ? "期限切れ" : `未使用（${fmtDateTime(i.expires_at).slice(0, 10)}まで）`;
              return (
                <tr key={i.code}>
                  <td>{i.note || "-"}</td>
                  <td>
                    <code style={{ wordBreak: "break-all", fontSize: 12 }}>{`${base}/invite/${i.code}`}</code>
                  </td>
                  <td>{status}</td>
                  <td>
                    {!i.used_by && (
                      <form action={revokeInvite}>
                        <input type="hidden" name="code" value={i.code} />
                        <button className="danger small">取り消す</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  まだ招待リンクはありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>使っている人</h2>
        <table>
          <thead>
            <tr>
              <th>場所の名前</th>
              <th>LINEの名前</th>
              <th>開始日</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, k) => (
              <tr key={k}>
                <td>{m.name}</td>
                <td>{m.display_name || "-"}</td>
                <td>{fmtDateTime(m.created_at).slice(0, 10)}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  まだいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
