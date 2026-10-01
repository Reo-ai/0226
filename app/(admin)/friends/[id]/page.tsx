import { notFound } from "next/navigation";
import {
  addFriendTag,
  enrollFriend,
  removeFriendTag,
  saveFriendNote,
  sendManual,
  stopEnrollment,
  toggleFriendAi,
} from "@/lib/actions";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { friendTags, getFriend } from "@/lib/friends";
import type { Message, Scenario, Tag } from "@/lib/types";
import { SOURCE_LABEL, TagChip, TagSelect } from "@/lib/ui";

export default async function FriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const friend = getFriend(Number(id));
  if (!friend) notFound();

  const tags = friendTags(friend.id);
  const allTags = db().prepare("SELECT * FROM tags ORDER BY name").all() as Tag[];
  const messages = (
    db().prepare("SELECT * FROM messages WHERE friend_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").all(friend.id) as Message[]
  ).reverse();
  const scenarios = db().prepare("SELECT * FROM scenarios ORDER BY name").all() as Scenario[];
  const enrollments = db()
    .prepare(
      `SELECT e.*, s.name FROM enrollments e JOIN scenarios s ON s.id = e.scenario_id
       WHERE e.friend_id = ? ORDER BY e.started_at DESC`,
    )
    .all(friend.id) as { id: number; name: string; status: string; next_step_index: number; next_run_at: number | null }[];
  const clicks = db()
    .prepare(
      `SELECT l.name, c.created_at FROM link_clicks c JOIN links l ON l.id = c.link_id
       WHERE c.friend_id = ? ORDER BY c.created_at DESC LIMIT 20`,
    )
    .all(friend.id) as { name: string; created_at: number }[];
  const hidden = <input type="hidden" name="friendId" value={friend.id} />;

  return (
    <>
      <h1 className="row">
        {friend.picture_url && <img className="avatar" src={friend.picture_url} alt="" />}
        {friend.display_name || "(名前未取得)"}
        {friend.blocked ? <span className="badge">ブロック中</span> : null}
      </h1>
      <div className="grid2">
        <div className="panel stack">
          <h2>トーク</h2>
          <div className="chat">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.direction}`}>
                {m.content}
                <div className="meta">
                  {SOURCE_LABEL[m.source] ?? m.source} · {fmtDateTime(m.created_at)}
                </div>
              </div>
            ))}
            {messages.length === 0 && <div className="muted">メッセージはまだありません</div>}
          </div>
          <form action={sendManual} className="stack">
            {hidden}
            <textarea name="content" placeholder="メッセージを送信（{{name}} で名前を差し込み）" required />
            <div><button disabled={!!friend.blocked}>送信</button></div>
          </form>
        </div>

        <div>
          <div className="panel stack">
            <h2>プロフィール</h2>
            <div className="muted">{friend.status_message}</div>
            <div>友だち追加: {fmtDateTime(friend.followed_at)}</div>
            <form action={toggleFriendAi} className="row">
              {hidden}
              AI自動応答: <span className={`badge ${friend.ai_enabled ? "on" : ""}`}>{friend.ai_enabled ? "ON" : "OFF"}</span>
              <button className="ghost small">切替</button>
            </form>
            <form action={saveFriendNote} className="stack">
              {hidden}
              <textarea name="note" defaultValue={friend.note} placeholder="メモ" />
              <div><button className="ghost small">メモを保存</button></div>
            </form>
          </div>

          <div className="panel stack">
            <h2>タグ</h2>
            <div className="row">
              {tags.map((t) => (
                <form key={t.id} action={removeFriendTag} className="row">
                  {hidden}
                  <input type="hidden" name="tagId" value={t.id} />
                  <TagChip tag={t} />
                  <button className="ghost small" title="外す">×</button>
                </form>
              ))}
              {tags.length === 0 && <span className="muted">なし</span>}
            </div>
            <form action={addFriendTag} className="row">
              {hidden}
              <TagSelect tags={allTags} name="tagId" empty="タグを選択" />
              <button className="small">付与</button>
            </form>
          </div>

          <div className="panel stack">
            <h2>ステップ配信</h2>
            <table>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{e.status === "active" ? `次回 ${fmtDateTime(e.next_run_at)}` : e.status === "done" ? "完了" : "停止"}</td>
                    <td>
                      {e.status === "active" && (
                        <form action={stopEnrollment}>
                          {hidden}
                          <input type="hidden" name="enrollmentId" value={e.id} />
                          <button className="danger small">停止</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={enrollFriend} className="row">
              {hidden}
              <select name="scenarioId" defaultValue="">
                <option value="">シナリオを選択</option>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="small">開始</button>
            </form>
          </div>

          <div className="panel">
            <h2>リンククリック履歴</h2>
            {clicks.map((c, i) => (
              <div key={i}>{fmtDateTime(c.created_at)} — {c.name}</div>
            ))}
            {clicks.length === 0 && <span className="muted">なし</span>}
          </div>
        </div>
      </div>
    </>
  );
}
