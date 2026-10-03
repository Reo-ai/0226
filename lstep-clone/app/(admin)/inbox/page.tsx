import Link from "next/link";
import { markReplied } from "@/lib/actions";
import { fmtDateTime } from "@/lib/format";
import { notifyTargets, unrepliedFriends } from "@/lib/inbox";

export const dynamic = "force-dynamic";

// 未返信の一覧：自動で返事ができなかった（人が返事をしたほうがよい）メッセージ
export default async function InboxPage() {
  const [list, targets] = await Promise.all([unrepliedFriends(), notifyTargets()]);
  return (
    <>
      <h1>未返信</h1>
      {targets.length === 0 && (
        <div className="panel hint">
          新しいメッセージを LINE で受け取るには、<Link href="/settings">設定・AI</Link> の「新着の通知」から登録してください。
        </div>
      )}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>友だち</th>
              <th>最後のメッセージ</th>
              <th>受信</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={`/friends/${f.id}`} className="row">
                    {f.picture_url && <img className="avatar" src={f.picture_url} alt="" />}
                    {f.display_name || "(名前未取得)"}
                  </Link>
                </td>
                <td className="pre" style={{ maxWidth: 420 }}>
                  {(f.last_text ?? "").slice(0, 200)}
                </td>
                <td>{fmtDateTime(f.needs_reply_at)}</td>
                <td className="row">
                  <Link className="btn small" href={`/friends/${f.id}`}>
                    返信する
                  </Link>
                  <form action={markReplied}>
                    <input type="hidden" name="friendId" value={f.id} />
                    <button className="ghost small">対応済み</button>
                  </form>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  未返信のメッセージはありません 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="hint">キーワードの自動応答・習慣・AI で返事ができなかったメッセージが並びます。友だち詳細から返信すると自動で消えます。</p>
      </div>
    </>
  );
}
