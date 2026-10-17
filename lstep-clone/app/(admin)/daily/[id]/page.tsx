import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDailyItem, deleteDailySet, saveDailyItem, saveDailySet } from "@/lib/actions";
import { all, get } from "@/lib/db";
import type { DailyItem, DailySet } from "@/lib/daily";
import { ContentHelp, ErrorBox } from "@/lib/ui";
import Clamp from "../../Clamp";

export const dynamic = "force-dynamic";

export default async function DailySetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const set = await get<DailySet>("SELECT * FROM daily_sets WHERE id = ?", Number(id));
  if (!set) notFound();
  const items = await all<DailyItem>("SELECT * FROM daily_items WHERE set_id = ? ORDER BY day", set.id);
  const nextDay = (items[items.length - 1]?.day ?? 0) + 1;
  return (
    <>
      <p style={{ margin: 0 }}>
        <Link href="/daily" className="hint">
          ← 日替わりで受け取る
        </Link>
      </p>
      <h1>{set.name}</h1>
      <ErrorBox error={error} />

      <div className="panel">
        <h2>
          「{set.keyword}」で届く内容 <span className="badge on">無料</span>
        </h2>
        <table>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ width: 70 }}>
                  <b>{it.day}日目</b>
                </td>
                <td className="pre">
                  <Clamp text={it.content} />
                </td>
                <td style={{ width: 60 }}>
                  <form action={deleteDailyItem}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="setId" value={set.id} />
                    <button className="ghost small">消す</button>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="muted">まだありません。下から1日目を足してください</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={saveDailyItem} className="panel stack">
        <h2 style={{ margin: 0 }}>日の内容を足す・直す</h2>
        <input type="hidden" name="setId" value={set.id} />
        <div className="row">
          <input name="day" type="number" min={1} max={3650} defaultValue={nextDay} style={{ width: 90 }} />
          日目（同じ日なら書き換え）
        </div>
        <textarea name="content" required placeholder="{{name}}さん、今日のクエストです！" />
        <ContentHelp />
        <div>
          <button>保存</button>
        </div>
      </form>

      <details className="panel fold">
        <summary>設定</summary>
        <form action={saveDailySet} className="stack">
          <input type="hidden" name="id" value={set.id} />
          <input name="name" defaultValue={set.name} aria-label="名前" />
          <input name="keyword" defaultValue={set.keyword} aria-label="受け取る言葉" />
          <textarea
            name="endMessage"
            defaultValue={set.end_message}
            placeholder="最後の日を過ぎた人に返す文（空なら最後の日の内容をもう一度）"
          />
          <label className="row">
            <input type="checkbox" name="enabled" defaultChecked={!!set.enabled} /> 有効
          </label>
          <div>
            <button>保存</button>
          </div>
        </form>
        <form action={deleteDailySet} style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={set.id} />
          <button className="danger small">この日替わりを削除</button>
        </form>
      </details>
    </>
  );
}
