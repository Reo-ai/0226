"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { jstDay } from "../format";
import { getProfile, requireProfile } from "../profile";
import { aiAdjustToday, planToday } from "../tasks";
import { type ActionState, firstIssue, formObject, reqInt } from "./form";

export async function setTaskStatus(fd: FormData) {
  const profile = await requireProfile();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!["todo", "done", "skipped"].includes(status)) return;
  await prisma.task.updateMany({
    where: { id, profileId: profile.id },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });
  revalidatePath("/");
  revalidatePath("/coach");
}

export async function replanToday() {
  const profile = await getProfile();
  if (!profile) return;
  await planToday(profile);
  revalidatePath("/");
  revalidatePath("/coach");
}

export async function aiReplanToday(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile) return { error: "初期設定が必要です" };
  const r = await aiAdjustToday(profile, String(fd.get("note") ?? "").slice(0, 500));
  revalidatePath("/");
  revalidatePath("/coach");
  return { ok: `今日のタスクを組み直しました：${r.data.reason}`, error: r.warning ?? undefined };
}

const manualSchema = z.object({
  title: z.string().trim().min(1, "タスク名を入力してください").max(80),
  estimatedMinutes: reqInt("所要時間", 5, 600),
  priority: reqInt("優先度", 1, 5),
});

export async function addManualTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const p = manualSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  await prisma.task.create({ data: { profileId: profile.id, ...p.data, source: "manual", taskDate: jstDay() } });
  revalidatePath("/");
  revalidatePath("/coach");
  return { ok: "追加しました" };
}
