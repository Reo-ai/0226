import { createField, deleteField } from "@/lib/actions";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";

// 友だち情報欄：誕生日・職業・申込日など、友だちごとに記録する項目
export default async function FieldsPage() {
  const fields = await all<{ id: number; name: string; n: number }>(
    "SELECT c.id, c.name, (SELECT COUNT(*) FROM friend_fields v WHERE v.field_id = c.id) n FROM custom_fields c ORDER BY c.id",
  );
  return (
    <>
      <h1>友だち情報欄</h1>
      <form action={createField} className="panel row">
        <input name="name" placeholder="項目名（例：誕生日・職業・申込日）" maxLength={30} style={{ flex: 1, minWidth: 220 }} required />
        <button>項目を追加</button>
      </form>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>項目名</th>
              <th>本文での書き方</th>
              <th>入力済みの人数</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>
                  <code>{`{{field:${f.name}}}`}</code>
                </td>
                <td>{f.n}</td>
                <td>
                  <form action={deleteField}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  まだ項目がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <details className="more">
          <summary>くわしく</summary>
          <ul className="hint" style={{ lineHeight: 1.8 }}>
            <li>友だちの詳細画面で、項目ごとに入力できます</li>
            <li>回答フォームの質問名を項目名と同じにすると、回答がその友だちの情報として自動で保存されます</li>
            <li>配信の本文に <code>{"{{field:項目名}}"}</code> と書くと、その友だちの値に置き換わります</li>
            <li>友だち一覧・一斉配信の「くわしい条件」で、この項目で絞り込めます</li>
          </ul>
        </details>
      </div>
    </>
  );
}
