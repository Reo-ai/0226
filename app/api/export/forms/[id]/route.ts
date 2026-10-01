import { isAuthed } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { toCsv } from "@/lib/forms";
import type { Form, FormField } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const form = await get<Form>("SELECT * FROM forms WHERE id = ?", Number(id));
  if (!form) return new Response("not found", { status: 404 });
  const fields = JSON.parse(form.fields) as FormField[];
  const rows = await all<{ answers: string; created_at: number; display_name: string | null; friend_id: number | null }>(
    `SELECT r.answers, r.created_at, r.friend_id, f.display_name FROM form_responses r
     LEFT JOIN friends f ON f.id = r.friend_id WHERE r.form_id = ? ORDER BY r.created_at`,
    form.id,
  );
  const csv = toCsv([
    ["回答日時", "友だちID", "表示名", ...fields.map((f) => f.label)],
    ...rows.map((r) => {
      const a = JSON.parse(r.answers) as Record<string, string>;
      return [fmtDateTime(r.created_at), r.friend_id ?? "", r.display_name ?? "", ...fields.map((f) => a[f.label] ?? "")];
    }),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="form-${form.id}.csv"`,
    },
  });
}
