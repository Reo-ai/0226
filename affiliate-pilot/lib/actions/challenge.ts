"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dataBlock, runAI } from "../ai";
import { challengePlan, diagnoseReadiness } from "../challenge";
import { PLATFORM_IDS, READINESS_LABEL } from "../constants";
import { prisma } from "../db";
import { addDays, jstDay } from "../format";
import { ctr as calcCtr, cvr as calcCvr } from "../metrics";
import { activeGoal, getProfile } from "../profile";
import { planToday } from "../tasks";
import { type ActionState, firstIssue, formObject, optInt, optPercent, reqInt } from "./form";

const schema = z.object({
  platform: z.enum(PLATFORM_IDS, { error: "対象媒体を選んでください" }),
  followerCount: optInt,
  impressions30d: optInt,
  clicks30d: optInt,
  conversions30d: optInt,
  niche: z.string().trim().max(60).default(""),
  affiliateOfferId: z.string().optional(),
  commissionPerApproval: optInt,
  approvalRate: optPercent,
  ctr: optPercent,
  cvr: optPercent,
  dailyWorkMinutes: reqInt("1日の作業時間", 15, 600),
  approvalTimingNote: z.string().trim().max(200).default(""),
});

const diagnosisSchema = z.object({
  summary: z.string().max(600),
  facts: z.array(z.string().max(200)).max(8),
  hypotheses: z.array(z.string().max(200)).max(8),
  firstSteps: z.array(z.string().max(120)).max(5),
});

export async function startChallenge(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!profile) return { error: "初期設定が必要です" };
  const p = schema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const v = p.data;
  const offer = v.affiliateOfferId ? await prisma.affiliateOffer.findUnique({ where: { id: v.affiliateOfferId } }) : null;
  const commission = v.commissionPerApproval ?? offer?.commissionAmount ?? null;
  const approvalRate = v.approvalRate ?? offer?.approvalRate ?? null;
  // 率が未入力なら実績から計算（実績もなければ未入力のまま＝シミュレーター側で計算不能と表示）
  const ctr = v.ctr ?? calcCtr(v.clicks30d, v.impressions30d);
  const cvr = v.cvr ?? calcCvr(v.conversions30d, v.clicks30d);
  const readiness = diagnoseReadiness({ ...v, hasOffer: !!offer || !!commission, commissionPerApproval: commission });

  const start = jstDay();
  let goal = await activeGoal(profile.id);
  const existing = goal ? await prisma.challenge.findUnique({ where: { goalId: goal.id } }) : null;
  if (!goal || !goal.challengeMode || existing) {
    goal = await prisma.goal.create({ data: { profileId: profile.id, targetMonthlyRevenue: 50_000, targetDate: addDays(start, 30), challengeMode: true } });
  }
  const hasRoadmap = await prisma.roadmap.count({ where: { goalId: goal.id, mode: "challenge30" } });
  await prisma.$transaction([
    ...(hasRoadmap ? [] : [prisma.roadmap.create({ data: { goalId: goal.id, mode: "challenge30", startDate: start, endDate: addDays(start, 29), plan: JSON.stringify({ phases: challengePlan() }) } })]),
    prisma.challenge.create({
      data: {
        goalId: goal.id, platform: v.platform, followerCount: v.followerCount, impressions30d: v.impressions30d, clicks30d: v.clicks30d,
        conversions30d: v.conversions30d, niche: v.niche || profile.niche, affiliateOfferId: offer?.id ?? null, commissionPerApproval: commission,
        approvalRate, ctr, cvr, dailyWorkMinutes: v.dailyWorkMinutes, approvalTimingNote: v.approvalTimingNote || offer?.approvalTiming || "",
        readiness: readiness.code, startDate: start,
      },
    }),
    prisma.profile.update({ where: { id: profile.id }, data: { dailyWorkMinutes: v.dailyWorkMinutes, hasExistingAccount: true } }),
    // 今日の自動タスクをチャレンジ用に作り直す
    prisma.task.deleteMany({ where: { profileId: profile.id, status: "todo", taskDate: start, source: { in: ["rule", "ai"] } } }),
  ]);

  // AIによる診断コメント（AIなしならルールの判定理由をそのまま使う）
  const ai = await runAI({
    system: "あなたはSNS・ブログの収益化を支援する戦略AIです。初月に確定報酬5万円を目指すユーザーの現状を診断します。",
    prompt: [
      `ルールによる判定:「${READINESS_LABEL[readiness.code]}」。理由: ${readiness.reasons.join(" ")}`,
      "この判定を踏まえ、現状の要約・データから言える事実・推測（仮説）・最初の3ステップを出してください。確定報酬は承認まで時間がかかり、初月に確定しない可能性にも触れること。",
      dataBlock("入力", { ...v, commissionPerApproval: commission, approvalRate, ctr, cvr, offer: offer ? { name: offer.name, conditions: offer.conversionConditions, approvalTiming: offer.approvalTiming } : null }),
    ].join("\n\n"),
    schema: diagnosisSchema,
    fallback: () => ({
      summary: `${READINESS_LABEL[readiness.code]}。${readiness.reasons.join(" ")} なお、確定報酬はASPの承認後に計上されるため、初月中に確定しない可能性があります。案件の承認時期を確認してください。`,
      facts: readiness.reasons,
      hypotheses: [],
      firstSteps: challengePlan()[0].milestones.map((m) => m.title),
    }),
  });
  await prisma.aIRecommendation.create({
    data: {
      recommendationType: "challenge",
      title: `チャレンジ開始時の診断：${READINESS_LABEL[readiness.code]}`,
      description: ai.data.summary,
      evidence: JSON.stringify({ facts: ai.data.facts, hypotheses: ai.data.hypotheses, nextActions: ai.data.firstSteps }),
      priority: 1,
      generatedBy: ai.generatedBy,
    },
  });
  // 作業時間を更新したので読み直してから計画する
  const fresh = await getProfile();
  if (fresh) await planToday(fresh);
  revalidatePath("/");
  redirect("/challenge");
}
