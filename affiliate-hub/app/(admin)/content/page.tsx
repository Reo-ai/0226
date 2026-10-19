import Link from "next/link";
import { deletePost, generatePost, updatePost } from "@/lib/actions";
import { all, get } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PLATFORMS, PLATFORM_LABEL, POST_KINDS } from "@/lib/score";
import type { Post, Program } from "@/lib/types";
import { ErrorBox, type SP } from "@/lib/ui";

export const maxDuration = 120;

export default async function ContentPage({ searchParams }: { searchParams: SP }) {
  const { error, id } = await searchParams;
  const programs = await all<Program>("SELECT * FROM programs WHERE status != 'paused' ORDER BY status = 'active' DESC, name");
  const posts = await all<Post & { program_name: string | null }>(
    "SELECT p.*, g.name program_name FROM posts p LEFT JOIN programs g ON g.id = p.program_id ORDER BY p.id DESC LIMIT 100",
  );
  const current = id ? await get<Post>("SELECT * FROM posts WHERE id = ?", Number(id)) : undefined;

  return (
    <>
      <h1>AI投稿生成</h1>
      <ErrorBox error={error} />
      <form action={generatePost} className="panel stack">
        <div className="row">
          <select name="program_id" required defaultValue="">
            <option value="" disabled>案件を選ぶ</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select name="platform" defaultValue="tiktok">
            {PLATFORMS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="kind" defaultValue="review">
            {POST_KINDS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <textarea name="extra" placeholder="追加の指示（任意）例: 20代女性向け／自分は3ヶ月使っている／価格の安さを推したい" style={{ minHeight: 60 }} />
        <div><button>生成する</button> <span className="hint">PR表記・薬機法などの規制に配慮して生成します。計測リンクがなければ自動作成します。</span></div>
      </form>

      {current && (
        <form action={updatePost} className="panel stack">
          <h2>{PLATFORM_LABEL[current.platform]}・{POST_KINDS.find(([k]) => k === current.kind)?.[1]}</h2>
          <input type="hidden" name="id" value={current.id} />
          <textarea name="body" defaultValue={current.body} style={{ minHeight: 420 }} />
          <div className="row">
            <select name="status" defaultValue={current.status}>
              <option value="draft">下書き</option>
              <option value="posted">投稿済み</option>
            </select>
            <button>保存</button>
            <button formAction={deletePost} className="danger">削除</button>
          </div>
          <p className="hint">公開前に、事実と違う体験談・効能の断定がないか必ず確認してください。</p>
        </form>
      )}

      <div className="panel">
        <h2>投稿一覧</h2>
        <table>
          <thead><tr><th>作成</th><th>案件</th><th>媒体</th><th>型</th><th>状態</th><th>冒頭</th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td className="muted">{fmtDateTime(p.created_at)}</td>
                <td>{p.program_name ?? "-"}</td>
                <td>{PLATFORM_LABEL[p.platform]}</td>
                <td>{POST_KINDS.find(([k]) => k === p.kind)?.[1] ?? p.kind}</td>
                <td><span className={`badge ${p.status === "posted" ? "on" : ""}`}>{p.status === "posted" ? "投稿済み" : "下書き"}</span></td>
                <td><Link href={`/content?id=${p.id}`}>{p.body.replace(/\s+/g, " ").slice(0, 40)}…</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {posts.length === 0 && <p className="hint">まだ投稿がありません。</p>}
      </div>
    </>
  );
}
