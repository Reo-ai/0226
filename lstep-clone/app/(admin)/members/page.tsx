import { createStaffInvite, removeStaff, revokeStaffInvite } from "@/lib/actions";
import { requireOwnerPage, sessionUser } from "@/lib/auth";
import { mainAll, mainGet } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";
import { currentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// メンバー：スタッフを招待して、友だちへの返信を手伝ってもらう
export default async function MembersPage() {
  await requireOwnerPage();
  const ws = await currentWorkspace();
  const me = await sessionUser();
  const founder = (await mainGet<{ owner_line_user_id: string }>("SELECT owner_line_user_id FROM workspaces WHERE id = ?", ws))?.owner_line_user_id;
  const members = await mainAll<{ line_user_id: string; display_name: string; role: string; created_at: number }>(
    "SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY role = 'staff', created_at",
    ws,
  );
  const invites = await mainAll<{ code: string; note: string; expires_at: number; role: string | null }>(
    "SELECT code, note, expires_at, role FROM invites WHERE target_ws = ? AND used_by IS NULL AND expires_at > ? ORDER BY created_at DESC",
    ws,
    Date.now(),
  );
  const base = baseUrl();
  return (
    <>
      <h1>メンバー</h1>
      <div className="panel stack">
        <h2 style={{ margin: 0 }}>メンバーを招待する</h2>
        <form action={createStaffInvite} className="row">
          <select name="role" defaultValue="staff" aria-label="役割">
            <option value="staff">スタッフ（返信・タグ・予約だけ）</option>
            <option value="owner">オーナー（すべて操作できる）</option>
          </select>
          <input name="note" placeholder="だれ用か（例：自分のスマホ）" maxLength={50} />
          <button>招待リンクを作る</button>
        </form>
        {invites.map((i) => (
          <div key={i.code} className="row" style={{ justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 2 }}>
              <b>
                {i.note || "招待"}（{i.role === "owner" ? "オーナー" : "スタッフ"}）
              </b>
              <code style={{ userSelect: "all", wordBreak: "break-all" }}>{`${base}/invite/${i.code}`}</code>
            </div>
            <form action={revokeStaffInvite}>
              <input type="hidden" name="code" value={i.code} />
              <button className="ghost small">取り消す</button>
            </form>
          </div>
        ))}
        <details className="more">
          <summary>くわしく</summary>
          <p className="hint">リンクは1回だけ・7日間使えます。相手のスマホの LINE で開いてもらってください（パソコンで開くと、そのパソコンでログイン中の LINE で入ってしまうことがあります）。</p>
        </details>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>役割</th>
              <th>参加日</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.line_user_id}>
                <td>{m.display_name || "（名前なし）"}</td>
                <td>
                  <span className={`badge ${m.role === "staff" ? "" : "on"}`}>{m.role === "staff" ? "スタッフ" : "オーナー"}</span>
                </td>
                <td>{fmtDateTime(m.created_at)}</td>
                <td>
                  {m.line_user_id !== me && m.line_user_id !== founder && (
                    <form action={removeStaff}>
                      <input type="hidden" name="user" value={m.line_user_id} />
                      <button className="danger small">外す</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  まだメンバーはいません（オーナーはあなたです）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
