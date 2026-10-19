"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PLATFORM_IDS } from "../constants";
import { prisma } from "../db";
import { addDays, jstDay, parseDateKey } from "../format";
import { roadmap90 } from "../planner";
import { getProfile } from "../profile";
import { challengePlan } from "../challenge";
import { type ActionState, firstIssue, formObject, reqInt, toArray } from "./form";

const schema = z.object({
  experienceLevel: z.enum(["none", "beginner", "intermediate", "advanced"], { error: "アフィリエイト経験を選んでください" }),
  targetMonthlyRevenue: reqInt("目標月収", 1000, 10_000_000),
  targetDate: z.string().transform((v, ctx) => {
    const d = parseDateKey(v);
    if (!d) ctx.addIssue({ code: "custom", message: "目標達成期限を正しい日付で入力してください" });
    return d ?? new Date();
  }),
  dailyWorkMinutes: reqInt("1日の作業時間", 15, 600),
  platforms: z.preprocess(toArray, z.array(z.enum(PLATFORM_IDS)).min(1, "利用する媒体を1つ以上選んでください")),
  niche: z.string().trim().max(60).default(""),
  hasExistingAccount: z.preprocess((v) => v === "on" || v === "yes", z.boolean()),
  monthlyBudget: reqInt("月額予算", 0, 1_000_000),
  challengeMode: z.preprocess((v) => v === "on", z.boolean()),
});

export async function completeOnboarding(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  if (v.targetDate <= new Date()) return { error: "目標達成期限は明日以降の日付にしてください" };
  const challengeMode = v.challengeMode && v.hasExistingAccount;

  const existing = await getProfile();
  const now = new Date();
  const data = {
    experienceLevel: v.experienceLevel,
    dailyWorkMinutes: v.dailyWorkMinutes,
    monthlyBudget: v.monthlyBudget,
    preferredPlatforms: JSON.stringify(v.platforms),
    niche: v.niche,
    hasExistingAccount: v.hasExistingAccount,
    onboardedAt: existing?.onboardedAt ?? now,
  };
  const profile = existing
    ? await prisma.profile.update({ where: { id: existing.id }, data })
    : await prisma.profile.create({ data });

  const start = jstDay(now);
  const goal = await prisma.goal.create({
    data: { profileId: profile.id, targetMonthlyRevenue: v.targetMonthlyRevenue, targetDate: v.targetDate, challengeMode },
  });
  await prisma.roadmap.create({
    data: {
      goalId: goal.id,
      mode: challengeMode ? "challenge30" : "roadmap90",
      startDate: start,
      endDate: addDays(start, challengeMode ? 29 : 89),
      plan: JSON.stringify({ phases: challengeMode ? challengePlan() : roadmap90() }),
    },
  });
  redirect(challengeMode ? "/challenge?start=1" : "/?welcome=1");
}
