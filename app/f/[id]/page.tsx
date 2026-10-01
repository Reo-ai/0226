import { notFound } from "next/navigation";
import { submitForm } from "@/lib/actions";
import { get } from "@/lib/db";
import type { Form, FormField } from "@/lib/types";
import "../../public.css";

export const dynamic = "force-dynamic";

function Field({ f, i }: { f: FormField; i: number }) {
  const name = `q${i}`;
  switch (f.type) {
    case "textarea":
      return <textarea name={name} required={f.required} />;
    case "select":
      return (
        <select name={name} required={f.required} defaultValue="">
          <option value="" disabled>選択してください</option>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case "radio":
    case "checkbox":
      return (
        <div className="opts">
          {f.options.map((o) => (
            <label key={o} className="row">
              <input type={f.type} name={name} value={o} required={f.type === "radio" && f.required} /> {o}
            </label>
          ))}
        </div>
      );
    default:
      return <input type={f.type} name={name} required={f.required} />;
  }
}

export default async function PublicForm({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string; error?: string }>;
}) {
  const { id } = await params;
  const { f: token = "", error } = await searchParams;
  const form = await get<Form>("SELECT * FROM forms WHERE id = ?", Number(id));
  if (!form) notFound();
  const fields = JSON.parse(form.fields) as FormField[];
  return (
    <div className="public">
      <form action={submitForm} className="panel stack">
        <h1>{form.title}</h1>
        {form.description && <p className="pre">{form.description}</p>}
        {error && <div className="error">{error}</div>}
        <input type="hidden" name="formId" value={form.id} />
        <input type="hidden" name="f" value={token} />
        {fields.map((f, i) => (
          <label key={i} className="q">
            <span>
              {f.label}
              {f.required && <span className="req">必須</span>}
            </span>
            <Field f={f} i={i} />
          </label>
        ))}
        <button>送信する</button>
      </form>
    </div>
  );
}
