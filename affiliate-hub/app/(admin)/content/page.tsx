import Link from "next/link";
import { deletePost, generatePost, queueVideo, updatePost } from "@/lib/actions";
import { all, get } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { guessVideoTheme, PLATFORMS, PLATFORM_LABEL, POST_KINDS, VIDEO_SERVICES, VIDEO_STATUS, VIDEO_THEMES } from "@/lib/score";
import type { Post, Program, VideoResult } from "@/lib/types";
import { ErrorBox, type SP } from "@/lib/ui";

export const maxDuration = 120;

export default async function ContentPage({ searchParams }: { searchParams: SP }) {
  const { error, id } = await searchParams;
  const programs = await all<Program>("SELECT * FROM programs WHERE status != 'paused' ORDER BY status = 'active' DESC, name");
  const posts = await all<Post & { program_name: string | null }>(
    "SELECT p.*, g.name program_name FROM posts p LEFT JOIN programs g ON g.id = p.program_id ORDER BY p.id DESC LIMIT 100",
  );
  const current = id ? await get<Post>("SELECT * FROM posts WHERE id = ?", Number(id)) : undefined;
  const currentProgram = current?.program_id ? programs.find((p) => p.id === current.program_id) : undefined;
  const video = current?.video_result ? (JSON.parse(current.video_result) as VideoResult) : null;

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

      {current && (
        <div className="panel stack">
          <h2>
            動画にする{" "}
            {current.video_status && <span className={`badge ${current.video_status === "done" ? "on" : ""}`}>{VIDEO_STATUS[current.video_status]}</span>}
          </h2>
          <form action={queueVideo} className="row">
            <input type="hidden" name="id" value={current.id} />
            <select name="theme" defaultValue={current.video_theme || guessVideoTheme(`${currentProgram?.category ?? ""} ${currentProgram?.name ?? ""}`)}>
              {VIDEO_THEMES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="service" defaultValue={current.video_service || "kling"}>
              {VIDEO_SERVICES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button disabled={current.video_status === "queued" || current.video_status === "running"}>
              {current.video_status === "done" || current.video_status === "failed" ? "作り直す" : "生成待ちに入れる"}
            </button>
            {current.video_status === "queued" && (
              <button name="cancel" value="1" className="ghost">取り消す</button>
            )}
          </form>
          <p className="hint">
            この台本をもとに、手元のPCのパイプラインが画像→動画を生成します（キャプションはこの本文を使用）。PCで{" "}
            <code>npm start -- hub-sync --loop 5</code> を動かしておくと、5分ごとに取りに来ます。
            {current.video_updated_at && <> 最終更新: {fmtDateTime(current.video_updated_at)}</>}
          </p>
          {video && (
            <div className="output">
              {video.error && <div style={{ color: "var(--danger)" }}>エラー: {video.error}</div>}
              {video.title && <div>タイトル: {video.title}</div>}
              {video.hook && <div>フック: {video.hook}</div>}
              {video.videoPaths?.map((p) => <div key={p}>動画: <code>{p}</code></div>)}
              {video.imagePath && <div>画像: <code>{video.imagePath}</code></div>}
              {video.summaryPath && <div>まとめ: <code>{video.summaryPath}</code></div>}
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h2>投稿一覧</h2>
        <table>
          <thead><tr><th>作成</th><th>案件</th><th>媒体</th><th>型</th><th>状態</th><th>動画</th><th>冒頭</th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td className="muted">{fmtDateTime(p.created_at)}</td>
                <td>{p.program_name ?? "-"}</td>
                <td>{PLATFORM_LABEL[p.platform]}</td>
                <td>{POST_KINDS.find(([k]) => k === p.kind)?.[1] ?? p.kind}</td>
                <td><span className={`badge ${p.status === "posted" ? "on" : ""}`}>{p.status === "posted" ? "投稿済み" : "下書き"}</span></td>
                <td className="muted">{VIDEO_STATUS[p.video_status] ?? "-"}</td>
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
