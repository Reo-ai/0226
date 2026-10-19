"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assess, criteriaSchema, DEFAULT_CRITERIA } from "../assessment";
import { PLATFORM_IDS } from "../constants";
import { prisma } from "../db";
import { requireProfile } from "../profile";
import { optionalHttpUrl } from "../schemas";
import { setSetting } from "../settings";
import { getCriteria, RATE_METRICS } from "../criteria";
import { type ActionState, firstIssue, formObject, optInt } from "./form";

const accountSchema = z.object({
  id: z.string().optional(),
  platform: z.enum(PLATFORM_IDS, { error: "媒体を選んでください" }),
  accountName: z.string().trim().min(1, "アカウント名を入力してください").max(80),
  accountUrl: optionalHttpUrl.default(""),
  followerCount: optInt,
  monthlyImpressions: optInt,
  monthlyPosts: optInt,
  monthlyEngagements: optInt,
  monthlyProfileVisits: optInt,
  monthlyClicks: optInt,
  monthlyConversions: optInt,
  niche: z.string().trim().max(60).default(""),
  targetAudience: z.string().trim().max(200).default(""),
});

export async function saveAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const p = accountSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const { id, ...data } = p.data;
  if (data.monthlyClicks !== null && data.monthlyImpressions !== null && data.monthlyClicks > data.monthlyImpressions) {
    return { error: "クリック数が表示回数より多くなっています。数字を確認してください" };
  }
  if (id) await prisma.channelAccount.updateMany({ where: { id, profileId: profile.id }, data });
  else await prisma.channelAccount.create({ data: { ...data, profileId: profile.id } });
  revalidatePath("/accounts");
  return { ok: id ? "更新しました" : "登録しました" };
}

export async function deleteAccount(fd: FormData) {
  const profile = await requireProfile();
  await prisma.channelAccount.deleteMany({ where: { id: String(fd.get("id")), profileId: profile.id } });
  revalidatePath("/accounts");
  redirect("/accounts");
}

const matches = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));

export async function runAssessment(fd: FormData) {
  const profile = await requireProfile();
  const account = await prisma.channelAccount.findFirst({ where: { id: String(fd.get("id")), profileId: profile.id } });
  if (!account) redirect("/accounts/assessment");
  const offers = await prisma.affiliateOffer.findMany({ select: { category: true, partnershipStatus: true } });
  const niche = account.niche || profile.niche;
  const fit = {
    approvedMatching: offers.filter((o) => o.partnershipStatus === "approved" && matches(o.category, niche)).length,
    candidateMatching: offers.filter((o) => o.partnershipStatus !== "approved" && matches(o.category, niche)).length,
    anyApproved: offers.filter((o) => o.partnershipStatus === "approved").length,
  };
  const r = assess({ ...account, niche }, fit, await getCriteria());
  await prisma.accountAssessment.create({
    data: {
      channelAccountId: account.id,
      trafficScore: r.traffic,
      engagementScore: r.engagement,
      funnelScore: r.funnel,
      offerFitScore: r.offerFit,
      conversionScore: r.conversion,
      overallScore: r.overall,
      confidenceLevel: r.confidence,
      stage: r.stage,
      recommendations: JSON.stringify(r.recommendations),
    },
  });
  revalidatePath("/accounts/assessment");
  redirect(`/accounts/assessment?account=${account.id}`);
}

export async function saveCriteria(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const next = structuredClone(await getCriteria());
  // 入力名: c.<媒体>.<指標>.<low|high>（率は % で入力）／ s.growing ・ s.grown
  for (const [k, raw] of fd.entries()) {
    if (typeof raw !== "string") continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) return { error: "評価基準は0以上の数値で入力してください" };
    const [kind, a, b, c] = k.split(".");
    if (kind === "c" && next.platforms[a] && b in next.platforms[a] && (c === "low" || c === "high")) {
      next.platforms[a][b as keyof (typeof next.platforms)[string]][c] = (RATE_METRICS as readonly string[]).includes(b) ? v / 100 : v;
    } else if (kind === "s" && (a === "growing" || a === "grown")) {
      next.stage[a] = v;
    }
  }
  const p = criteriaSchema.safeParse(next);
  if (!p.success) return { error: firstIssue(p.error) };
  for (const c of Object.values(p.data.platforms)) {
    for (const r of Object.values(c)) if (r.low >= r.high) return { error: "各基準は「低」より「高」を大きくしてください" };
  }
  if (p.data.stage.growing >= p.data.stage.grown) return { error: "「成長途中」の点数は「成長済み」より小さくしてください" };
  await setSetting("assessment_criteria", p.data);
  revalidatePath("/accounts/assessment");
  return { ok: "評価基準を保存しました。次の診断から反映されます" };
}

export async function resetCriteria() {
  await requireProfile();
  await setSetting("assessment_criteria", DEFAULT_CRITERIA);
  revalidatePath("/accounts/assessment");
}
