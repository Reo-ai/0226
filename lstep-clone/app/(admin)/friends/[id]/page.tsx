import { notFound } from "next/navigation";
import {
  addFriendTag,
  cancelPending,
  enrollFriend,
  removeFriendTag,
  saveFriendNote,
  sendManual,
  stopEnrollment,
  toggleFriendAi,
} from "@/lib/actions";
import { all, get } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { friendTags, getFriend } from "@/lib/friends";
import { pushRemaining } from "@/lib/quota";
import type { Message, Scenario, Tag } from "@/lib/types";
import { CHANNEL_LABEL, ContentHelp, ErrorBox, SOURCE_LABEL, TagChip, TagSelect } from "@/lib/ui";

export default async function FriendPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const friend = await getFriend(Number(id));
  if (!friend) notFound();

  const [tags, allTags, recent, scenarios, enrollments, clicks, pending, responses, source, remaining] = await Promise.all([
    friendTags(friend.id),
    all<Tag>("SELECT * FROM tags ORDER BY name"),
    all<Message>("SELECT * FROM messages WHERE friend_id = ? ORDER BY created_at DESC, id DESC LIMIT 100", friend.id),
    all<Scenario>("SELECT * FROM scenarios ORDER BY name"),
    all<{ id: number; name: string; status: string; waiting: number; next_run_at: number | null }>(
      `SELECT e.*, s.name FROM enrollments e JOIN scenarios s ON s.id = e.scenario_id
       WHERE e.friend_id = ? ORDER BY e.started_at DESC`,
      friend.id,
    ),
    all<{ name: string; created_at: number }>(
      `SELECT l.name, c.created_at FROM link_clicks c JOIN links l ON l.id = c.link_id
       WHERE c.friend_id = ? ORDER BY c.created_at DESC LIMIT 20`,
      friend.id,
    ),
    all<{ id: number; content: string; source: string; expires_at: number }>(
      "SELECT * FROM pending_messages WHERE friend_id = ? AND expires_at > ? ORDER BY id",
      friend.id,
      Date.now(),
    ),
    all<{ id: number; title: string; answers: string; created_at: number }>(
      `SELECT r.id, f.title, r.answers, r.created_at FROM form_responses r JOIN forms f ON f.id = r.form_id
       WHERE r.friend_id = ? ORDER BY r.created_at DESC`,
      friend.id,
    ),
    friend.source_id ? get<{ name: string }>("SELECT name FROM sources WHERE id = ?", friend.source_id) : undefined,
    pushRemaining(),
  ]);
  const messages = recent.reverse();
  const hidden = <input type="hidden" name="friendId" value={friend.id} />;

  return (
    <>
      <h1 className="row">
        {friend.picture_url && <img className="avatar" src={friend.picture_url} alt="" />}
        {friend.display_name || "(名前未取得)"}
        {friend.blocked ? <span className="badge">ブロック中</span> : null}
      </h1>
      <ErrorBox error={error} />
      <div className="grid2">
        <div className="panel stack">
          <h2>トーク</h2>
          <div className="chat">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.direction}`}>
                {m.content}
                <div className="meta">
                  {SOURCE_LABEL[m.source] ?? m.source}
                  {m.direction === "out" && CHANNEL_LABEL[m.channel] ? `（${CHANNEL_LABEL[m.channel]}）` : ""} ·{" "}
                  {fmtDateTime(m.created_at)}
                </div>
              </div>
            ))}
            {messages.length === 0 && <div className="muted">メッセージはまだありません</div>}
          </div>
          {pending.length > 0 && (
            <div className="stack">
              <div className="hint">反応待ち（次に相手からメッセージが来たら無料で届きます）</div>
              {pending.map((p) => (
                <form key={p.id} action={cancelPending} className="row">
                  {hidden}
                  <input type="hidden" name="id" value={p.id} />
                  <span className="badge">{SOURCE_LABEL[p.source]}</span>
                  <span style={{ flex: 1 }} className="pre">{p.content.slice(0, 60)}</span>
                  <button className="ghost small">取消</button>
                </form>
              ))}
            </div>
          )}
          <form action={sendManual} className="stack">
            {hidden}
            <textarea name="content" placeholder="メッセージ" required />
            <ContentHelp />
            <div className="row">
              <button name="mode" value="reply" disabled={!!friend.blocked}>
                次の反応時に送る（無料）
              </button>
              <button name="mode" value="push" className="ghost" disabled={!!friend.blocked || remaining < 1}>
                今すぐ送る（1通消費・残り{Number.isFinite(remaining) ? remaining : "∞"}）
              </button>
            </div>
          </form>
        </div>

        <div>
          <div className="panel stack">
            <h2>プロフィール</h2>
            <div className="muted">{friend.status_message}</div>
            <div>友だち追加: {fmtDateTime(friend.followed_at)}</div>
            <div>流入経路: {source?.name ?? "-"}</div>
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
                    <td>
                      {e.status === "active"
                        ? e.waiting
                          ? "反応待ち（無料）"
                          : `次回 ${fmtDateTime(e.next_run_at)}`
                        : e.status === "done"
                          ? "完了"
                          : "停止"}
                    </td>
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

          <div className="panel stack">
            <h2>フォーム回答</h2>
            {responses.map((r) => (
              <div key={r.id}>
                <div className="hint">{r.title} · {fmtDateTime(r.created_at)}</div>
                {Object.entries(JSON.parse(r.answers) as Record<string, string>).map(([k, v]) => (
                  <div key={k}><span className="muted">{k}:</span> {v}</div>
                ))}
              </div>
            ))}
            {responses.length === 0 && <span className="muted">なし</span>}
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
