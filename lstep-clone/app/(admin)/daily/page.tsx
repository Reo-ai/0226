import Link from "next/link";
import { createDailySet } from "@/lib/actions";
import { all } from "@/lib/db";
import type { DailySet } from "@/lib/daily";
import type { Tag } from "@/lib/types";
import { ErrorBox, TagSelect } from "@/lib/ui";

export const dynamic = "force-dynamic";

// 日替わりで受け取る：決めた言葉が送られたら、その人の「何日目か」に合わせた内容を返す（無料）
export default async function DailyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const sets = await all<DailySet & { days: number }>(
    "SELECT d.*, (SELECT COUNT(*) FROM daily_items i WHERE i.set_id = d.id) days FROM daily_sets d ORDER BY d.id DESC",
  );
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  return (
    <>
      <h1>日替わりで受け取る</h1>
      <ErrorBox error={error} />
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>受け取る言葉</th>
              <th>日数</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/daily/${d.id}`}>{d.name}</Link>
                </td>
                <td>「{d.keyword}」</td>
                <td>{d.days}日分</td>
                <td>
                  <span className={`badge ${d.enabled ? "on" : ""}`}>{d.enabled ? "有効" : "停止"}</span>
                </td>
              </tr>
            ))}
            {sets.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  まだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form action={createDailySet} className="panel stack">
        <h2 style={{ margin: 0 }}>新しく作る</h2>
        <input name="name" placeholder="名前（例：毎日のクエスト）" required />
        <input name="keyword" placeholder="受け取る言葉（例：今日のクエスト）" required />
        <div className="row">
          <select name="startType" defaultValue="follow" aria-label="1日目">
            <option value="follow">友だち追加した日を1日目にする</option>
            <option value="tag">タグが付いた日を1日目にする</option>
          </select>
          <TagSelect tags={tags} name="startTagId" empty="（タグを選ぶ）" />
        </div>
        <div>
          <button>作る</button>
        </div>
        <details className="more">
          <summary>くわしく</summary>
          <p className="hint">
            リッチメニューのボタンを「テキスト送信：受け取る言葉」にすると、押した人にその日の分が届きます。返事として届くので配信数を使いません。
          </p>
        </details>
      </form>
    </>
  );
}
