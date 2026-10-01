import Link from "next/link";
import { saveForm } from "@/lib/actions";
import { all } from "@/lib/db";
import type { Form, Tag } from "@/lib/types";
import { ErrorBox, TagSelect } from "@/lib/ui";

const FIELD_HELP = "1行1項目：ラベル | 種類 | 選択肢(カンマ区切り) | 必須　※種類: text, textarea, select, radio, checkbox, email, tel";

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const forms = await all<Form & { n: number }>(
    "SELECT f.*, (SELECT COUNT(*) FROM form_responses r WHERE r.form_id = f.id) n FROM forms f ORDER BY f.created_at DESC",
  );
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  return (
    <>
      <h1>回答フォーム</h1>
      <p className="muted">
        配信本文に <code>{"{{form:ID}}"}</code> と書くと、誰が回答したか分かるフォームURLになります。回答者にタグを自動付与できます。
      </p>
      <ErrorBox error={error} />
      <div className="panel">
        <table>
          <thead><tr><th>フォーム</th><th>差し込みコード</th><th>回答数</th></tr></thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id}>
                <td><Link href={`/forms/${f.id}`}>{f.title}</Link></td>
                <td><code>{`{{form:${f.id}}}`}</code></td>
                <td>{f.n}</td>
              </tr>
            ))}
            {forms.length === 0 && <tr><td colSpan={3} className="muted">まだありません</td></tr>}
          </tbody>
        </table>
      </div>
      <form action={saveForm} className="panel stack">
        <h2>新規作成</h2>
        <input name="title" placeholder="タイトル（例: 来店予約アンケート）" required />
        <textarea name="description" placeholder="説明文（任意）" />
        <textarea
          name="fields"
          required
          style={{ minHeight: 140, fontFamily: "monospace" }}
          defaultValue={"お名前 | text | | 必須\nご希望の日時 | select | 平日午前,平日午後,土日 | 必須\nご要望 | textarea"}
        />
        <div className="hint">{FIELD_HELP}</div>
        <div className="row">回答者に付けるタグ: <TagSelect tags={tags} name="addTagId" /></div>
        <input name="thanks" placeholder="送信後に表示するお礼メッセージ" defaultValue="ご回答ありがとうございました！" />
        <div><button>作成</button></div>
      </form>
    </>
  );
}
