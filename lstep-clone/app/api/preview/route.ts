import { isAuthed } from "@/lib/auth";
import { all } from "@/lib/db";
import { validateContent, render } from "@/lib/content";
import { pushToFriend } from "@/lib/delivery";
import { validateMessages } from "@/lib/line";
import { adminLineIds } from "@/lib/lineConfig";
import type { Friend } from "@/lib/types";
import { currentWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

// 本文のプレビュー（LINEに送る形に変換）と、管理者の LINE へのテスト送信
export async function POST(req: Request) {
  if (!(await isAuthed())) return Response.json({ error: "ログインしてください" }, { status: 401 });
  const { content = "", test = false } = (await req.json().catch(() => ({}))) as { content?: string; test?: boolean };
  const invalid = validateContent(content);
  if (invalid) return Response.json({ error: invalid });

  const ids = await adminLineIds();
  const admins = ids.length
    ? await all<Friend>(`SELECT * FROM friends WHERE blocked = 0 AND line_user_id IN (${ids.map(() => "?").join(",")})`, ...ids)
    : [];
  const sample = admins[0] ?? null;
  const { messages } = render(content, sample, "manual", await currentWorkspace());

  // LINE に「送れる形式か」を確かめる（送信はしない）
  try {
    await validateMessages(messages);
  } catch (e) {
    return Response.json({ messages, error: `LINEの形式チェックでエラー: ${String(e).slice(0, 300)}` });
  }
  if (!test) return Response.json({ messages, ok: true });

  if (admins.length === 0) {
    return Response.json({ messages, error: "管理者の LINE が友だち登録されていません。公式LINEを友だち追加してから試してください" });
  }
  for (const a of admins) await pushToFriend(a, content, "manual");
  return Response.json({ messages, ok: true, sent: admins.map((a) => a.display_name || "管理者") });
}
