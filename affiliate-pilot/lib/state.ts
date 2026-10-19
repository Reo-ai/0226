import { prisma } from "./db";
import { addDays, daysBetween, jstMonthStart } from "./format";
import { sumMeasured } from "./metrics";
import type { MilestoneFacts, PlannerState } from "./planner";
import { activeGoal } from "./profile";
import { parseJson, platformsSchema } from "./schemas";

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.profile.findFirst>>>;

/** 全レッスンを完了した講座ID */
export async function completedCourses(profileId: string): Promise<string[]> {
  const [lessons, done] = await Promise.all([
    prisma.lesson.groupBy({ by: ["courseId"], _count: { _all: true } }),
    prisma.lessonProgress.findMany({ where: { profileId, completionStatus: "completed" }, select: { lesson: { select: { courseId: true } } } }),
  ]);
  const doneBy = new Map<string, number>();
  for (const d of done) doneBy.set(d.lesson.courseId, (doneBy.get(d.lesson.courseId) ?? 0) + 1);
  return lessons.filter((l) => (doneBy.get(l.courseId) ?? 0) >= l._count._all).map((l) => l.courseId);
}

export async function plannerState(profile: Profile, now = new Date()): Promise<PlannerState> {
  const goal = await activeGoal(profile.id);
  const weekAgo = addDays(now, -7);
  const [channels, assessments, offers, approvedOffers, trackingLinks, drafts, publications, publicationsLast7d, performanceRecords, recordsLast7d, lessonsCompleted, courses, monthRecords] =
    await Promise.all([
      prisma.channelAccount.count({ where: { profileId: profile.id } }),
      prisma.accountAssessment.count({ where: { channel: { profileId: profile.id } } }),
      prisma.affiliateOffer.count(),
      prisma.affiliateOffer.count({ where: { partnershipStatus: "approved" } }),
      prisma.trackingLink.count(),
      prisma.contentDraft.count(),
      prisma.publication.count(),
      prisma.publication.count({ where: { publishedAt: { gte: weekAgo } } }),
      prisma.performanceRecord.count(),
      prisma.performanceRecord.count({ where: { recordDate: { gte: weekAgo } } }),
      prisma.lessonProgress.count({ where: { profileId: profile.id, completionStatus: "completed" } }),
      completedCourses(profile.id),
      prisma.performanceRecord.findMany({ where: { recordDate: { gte: jstMonthStart(now) } }, select: { confirmedRevenue: true } }),
    ]);
  const start = profile.onboardedAt ?? profile.createdAt;
  const ch = goal?.challengeMode ? await prisma.roadmap.findFirst({ where: { goalId: goal.id, mode: "challenge30" }, orderBy: { createdAt: "desc" } }) : null;
  const challengeDay = ch ? daysBetween(ch.startDate, now) : null;
  return {
    experienceLevel: profile.experienceLevel,
    dailyWorkMinutes: profile.dailyWorkMinutes,
    platforms: parseJson(platformsSchema, profile.preferredPlatforms, []),
    challengeMode: goal?.challengeMode ?? false,
    dayIndex: Math.max(0, daysBetween(start, now)),
    challengeDay: challengeDay !== null && challengeDay >= 0 && challengeDay <= 29 ? challengeDay : null,
    counts: { channels, assessments, offers, approvedOffers, trackingLinks, drafts, publications, publicationsLast7d, performanceRecords, recordsLast7d, lessonsCompleted, completedCourses: courses },
    confirmedThisMonth: sumMeasured(monthRecords.map((r) => r.confirmedRevenue)),
    targetMonthlyRevenue: goal?.targetMonthlyRevenue ?? 50_000,
  };
}

export async function milestoneFacts(profile: Profile): Promise<MilestoneFacts> {
  const goal = await activeGoal(profile.id);
  const [courses, channels, assessments, offers, approvedOffers, trackingLinks, publications, recordDays, records] = await Promise.all([
    completedCourses(profile.id),
    prisma.channelAccount.count({ where: { profileId: profile.id } }),
    prisma.accountAssessment.count({ where: { channel: { profileId: profile.id } } }),
    prisma.affiliateOffer.count(),
    prisma.affiliateOffer.count({ where: { partnershipStatus: "approved" } }),
    prisma.trackingLink.count(),
    prisma.publication.count(),
    prisma.performanceRecord.groupBy({ by: ["recordDate"] }).then((r) => r.length),
    prisma.performanceRecord.findMany({ select: { recordDate: true, confirmedRevenue: true, conversions: true } }),
  ]);
  const byMonth = new Map<string, number>();
  for (const r of records) {
    if (r.confirmedRevenue === null) continue;
    const k = jstMonthStart(r.recordDate).toISOString();
    byMonth.set(k, (byMonth.get(k) ?? 0) + r.confirmedRevenue);
  }
  return {
    completedCourses: courses,
    channels,
    assessments,
    offers,
    approvedOffers,
    trackingLinks,
    publications,
    recordDays,
    conversionsTotal: sumMeasured(records.map((r) => r.conversions)),
    confirmedTotal: sumMeasured(records.map((r) => r.confirmedRevenue)),
    bestMonthConfirmed: byMonth.size ? Math.max(...byMonth.values()) : null,
    target: goal?.targetMonthlyRevenue ?? 50_000,
  };
}
