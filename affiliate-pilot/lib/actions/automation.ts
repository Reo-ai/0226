"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelJob, improvementSchema, JOB_TYPES, type JobType, rerunJob, runJob, weeklySchema } from "../automation";
import { prisma } from "../db";
import { getProfile, requireProfile } from "../profile";
import { parseJson } from "../schemas";
import { setSetting } from "../settings";
import { getTemplates } from "../template-store";
import { type ActionState, firstIssue, formObject } from "./form";

export async function runJobAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const type = String(fd.get("jobType")) as JobType;
  if (!(type in JOB_TYPES)) return { error: "不明なジョブです" };
  const payload = type === "content_draft" ? { offerId: String(fd.get("offerId") ?? ""), contentType: String(fd.get("contentType") ?? "instagram_post") } : {};
  // AIを使うジョブはバックグラウンドで動かし、待たずに他の画面を使えるようにする
  const background = BACKGROUND.has(type);
  const id = await runJob(type, payload, { background });
  revalidatePath("/automation");
  revalidatePath("/");
  if (background) return { ok: `「${JOB_TYPES[type]}」を開始しました。終わるまで他の画面を使えます（実行中はキャンセルできます）` };
  const job = await prisma.automationJob.findUnique({ where: { id } });
  if (job?.status === "failed") return { error: `「${JOB_TYPES[type]}」に失敗しました：${job.errorMessage}` };
  return { ok: job?.status === "awaiting_review" ? `「${JOB_TYPES[type]}」ができました。内容を確認して承認してください` : `「${JOB_TYPES[type]}」が完了しました` };
}

const BACKGROUND = new Set<JobType>(["content_draft", "improvement", "weekly_report"]);

export async function cancelJobAction(fd: FormData) {
  await requireProfile();
  cancelJob(String(fd.get("id")));
  // 中断処理が DB に書き込むのを少し待ってから再描画する
  await new Promise((r) => setTimeout(r, 300));
  revalidatePath("/automation");
}

export async function rerunJobAction(fd: FormData) {
  await requireProfile();
  const job = await prisma.automationJob.findUnique({ where: { id: String(fd.get("id")) } });
  if (!job) return;
  await rerunJob(job.id, { background: BACKGROUND.has(job.jobType as JobType) });
  revalidatePath("/automation");
}

/** 承認：改善案は提案とタスクに、週次レポートは振り返りとして反映する */
export async function approveJob(fd: FormData) {
  const profile = await getProfile();
  if (!profile) return;
  const job = await prisma.automationJob.findUnique({ where: { id: String(fd.get("id")) } });
  if (!job || job.status !== "awaiting_review") return;
  const log = (action: string, result: string) => prisma.automationLog.create({ data: { automationJobId: job.id, action, result } });
  if (job.jobType === "improvement") {
    const r = parseJson(improvementSchema.extend({ generatedBy: z.string().default("fallback") }), job.result, { facts: [], hypotheses: [], suggestions: [], generatedBy: "fallback" });
    await prisma.$transaction([
      ...r.suggestions.map((s) =>
        prisma.aIRecommendation.create({
          data: { recommendationType: "analytics", title: s.title, description: s.description, priority: s.priority, evidence: JSON.stringify({ facts: r.facts, hypotheses: r.hypotheses }), generatedBy: r.generatedBy },
        }),
      ),
      // 次のタスクに反映（今日の枠に入らなければ持ち越しとして残る）
      ...r.suggestions.map((s) =>
        prisma.task.create({ data: { profileId: profile.id, title: s.title, description: s.description, priority: s.priority, estimatedMinutes: s.minutes, relatedFeature: "/analytics", source: r.generatedBy === "fallback" ? "rule" : "ai" } }),
      ),
    ]);
    await log("承認", `${r.suggestions.length}件を提案とタスクに反映しました`);
  } else if (job.jobType === "weekly_report") {
    const r = parseJson(weeklySchema.extend({ generatedBy: z.string().default("fallback") }), job.result, { summary: "", good: [], issues: [], nextWeek: [], generatedBy: "fallback" });
    await prisma.aIRecommendation.create({
      data: { recommendationType: "weekly", title: "週次レポート：来週の優先行動", description: r.nextWeek.map((x, i) => `${i + 1}. ${x}`).join("\n") || r.summary, priority: 2, evidence: JSON.stringify({ facts: [r.summary, ...r.good], hypotheses: r.issues }), generatedBy: r.generatedBy },
    });
    await log("承認", "来週の優先行動を提案に反映しました");
  } else {
    await log("承認", "内容を確認しました");
  }
  await prisma.automationJob.update({ where: { id: job.id }, data: { status: "approved" } });
  revalidatePath("/automation");
  revalidatePath("/");
}

export async function setJobStatus(fd: FormData) {
  await requireProfile();
  const status = String(fd.get("status"));
  if (!["draft", "completed"].includes(status)) return;
  await prisma.automationJob.update({ where: { id: String(fd.get("id")) }, data: { status, ...(status === "completed" ? { completedAt: new Date() } : {}) } });
  await prisma.automationLog.create({ data: { automationJobId: String(fd.get("id")), action: status === "draft" ? "差し戻し" : "完了", result: status === "draft" ? "下書きに戻しました" : "完了にしました" } });
  revalidatePath("/automation");
}

export async function deleteJob(fd: FormData) {
  await requireProfile();
  await prisma.automationJob.delete({ where: { id: String(fd.get("id")) } }).catch(() => null);
  revalidatePath("/automation");
}

export async function setRecommendationStatus(fd: FormData) {
  await requireProfile();
  const status = String(fd.get("status"));
  if (!["open", "accepted", "dismissed", "done"].includes(status)) return;
  await prisma.aIRecommendation.update({ where: { id: String(fd.get("id")) }, data: { status } });
  revalidatePath("/automation");
  revalidatePath("/");
}

// ---- 定型文テンプレート ----
const tplInput = z.object({ id: z.string().optional(), name: z.string().trim().min(1, "名前を入力してください").max(60), body: z.string().trim().min(1, "本文を入力してください").max(4000) });

export async function saveTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const p = tplInput.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const list = await getTemplates();
  const id = p.data.id || crypto.randomUUID();
  const next = list.some((t) => t.id === id) ? list.map((t) => (t.id === id ? { id, name: p.data.name, body: p.data.body } : t)) : [...list, { id, name: p.data.name, body: p.data.body }];
  await setSetting("templates", next);
  revalidatePath("/automation");
  return { ok: "テンプレートを保存しました" };
}

export async function deleteTemplate(fd: FormData) {
  await requireProfile();
  const list = await getTemplates();
  await setSetting("templates", list.filter((t) => t.id !== String(fd.get("id"))));
  revalidatePath("/automation");
}
