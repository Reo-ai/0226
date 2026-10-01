import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteForm, saveForm } from "@/lib/actions";
import { all, get } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { stringifyFields } from "@/lib/forms";
import type { Form, FormField, Tag } from "@/lib/types";
import { ErrorBox, TagSelect } from "@/lib/ui";

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const form = await get<Form>("SELECT * FROM forms WHERE id = ?", Number(id));
  if (!form) notFound();
  const fields = JSON.parse(form.fields) as FormField[];
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  const responses = await all<{ id: number; answers: string; created_at: number; friend_id: number | null; display_name: string | null }>(
    `SELECT r.*, f.display_name FROM form_responses r LEFT JOIN friends f ON f.id = r.friend_id
     WHERE r.form_id = ? ORDER BY r.created_at DESC LIMIT 500`,
    form.id,
  );
  const base = process.env.BASE_URL || "http://localhost:3000";
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{form.title}</h1>
        <div className="row">
          <a className="btn ghost" href={`/f/${form.id}`} target="_blank">プレビュー</a>
          <a className="btn ghost" href={`/api/export/forms/${form.id}`}>CSV</a>
          <form action={deleteForm}>
            <input type="hidden" name="id" value={form.id} />
            <button className="danger">削除</button>
          </form>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="panel">
        <div>配信に差し込む: <code>{`{{form:${form.id}}}`}</code>（誰の回答か分かる）</div>
        <div className="hint">匿名URL: {base}/f/{form.id}</div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h2>回答（{responses.length}）</h2>
        <table>
          <thead>
            <tr><th>日時</th><th>回答者</th>{fields.map((f) => <th key={f.label}>{f.label}</th>)}</tr>
          </thead>
          <tbody>
            {responses.map((r) => {
              const a = JSON.parse(r.answers) as Record<string, string>;
              return (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td>{r.friend_id ? <Link href={`/friends/${r.friend_id}`}>{r.display_name || "(名前未取得)"}</Link> : "匿名"}</td>
                  {fields.map((f) => <td key={f.label} className="pre">{a[f.label]}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form action={saveForm} className="panel stack">
        <h2>編集</h2>
        <input type="hidden" name="id" value={form.id} />
        <input name="title" defaultValue={form.title} required />
        <textarea name="description" defaultValue={form.description} />
        <textarea name="fields" defaultValue={stringifyFields(fields)} style={{ minHeight: 140, fontFamily: "monospace" }} required />
        <div className="hint">1行1項目：ラベル | 種類 | 選択肢(カンマ区切り) | 必須</div>
        <div className="row">回答者に付けるタグ: <TagSelect tags={tags} name="addTagId" defaultValue={form.add_tag_id} /></div>
        <input name="thanks" defaultValue={form.thanks_message} />
        <div><button>保存</button></div>
      </form>
    </>
  );
}
