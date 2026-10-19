import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { platformsSchema, parseJson } from "./schemas";

/** 単一ユーザー版: 最初のプロフィールを使う（SaaS 化時はセッションのユーザーに置き換える） */
export const getProfile = cache(async () => prisma.profile.findFirst({ orderBy: { createdAt: "asc" } }));

export async function requireProfile() {
  const p = await getProfile();
  if (!p?.onboardedAt) redirect("/onboarding");
  return { ...p, platforms: parseJson(platformsSchema, p.preferredPlatforms, []) };
}

export const activeGoal = cache(async (profileId: string) => prisma.goal.findFirst({ where: { profileId }, orderBy: { createdAt: "desc" } }));
