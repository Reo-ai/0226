"use server";

import { revalidatePath } from "next/cache";
import { askCoach } from "../coach";
import { getProfile } from "../profile";
import type { ActionState } from "./form";

export async function askCoachAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile) return { error: "初期設定が必要です" };
  const q = String(fd.get("question") ?? "").trim();
  if (!q) return { error: "質問を入力してください" };
  if (q.length > 1000) return { error: "質問は1000文字以内にしてください" };
  const r = await askCoach(profile, q);
  revalidatePath("/coach");
  return { ok: "回答しました", error: r.warning ?? undefined };
}
