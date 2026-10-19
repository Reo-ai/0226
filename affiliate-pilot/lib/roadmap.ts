import { prisma } from "./db";
import { daysBetween } from "./format";
import { currentPhase, milestoneDone, type Phase } from "./planner";
import { activeGoal } from "./profile";
import { getSetting } from "./settings";
import { parseJson, roadmapPlanSchema, stringListSchema } from "./schemas";
import { milestoneFacts } from "./state";

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.profile.findFirst>>>;

/** 手動でチェックしたマイルストーン（データから判定できないもの用） */
export const MANUAL_MILESTONES_KEY = "milestones_manual";

export async function roadmapView(profile: Profile, mode?: "roadmap90" | "challenge30") {
  const goal = await activeGoal(profile.id);
  if (!goal) return null;
  const roadmap = await prisma.roadmap.findFirst({ where: { goalId: goal.id, ...(mode ? { mode } : {}) }, orderBy: { createdAt: "desc" } });
  if (!roadmap) return null;
  const plan = parseJson(roadmapPlanSchema, roadmap.plan, { phases: [] });
  const [facts, manual] = await Promise.all([milestoneFacts(profile), getSetting(MANUAL_MILESTONES_KEY, stringListSchema, [])]);
  const dayIndex = Math.max(0, daysBetween(roadmap.startDate, new Date()));
  const phases = plan.phases.map((p) => ({
    ...p,
    milestones: p.milestones.map((m) => ({ ...m, done: milestoneDone(m.key, facts) || manual.includes(`${roadmap.id}:${m.key}`) })),
  }));
  const all = phases.flatMap((p) => p.milestones);
  const progress = all.length ? all.filter((m) => m.done).length / all.length : 0;
  const phase = phases.length ? currentPhase(phases as Phase[], dayIndex) : null;
  const totalDays = daysBetween(roadmap.startDate, roadmap.endDate) + 1;
  if (Math.abs(roadmap.progress - progress) > 1e-6 || (phase && roadmap.currentPhase !== phase.no)) {
    await prisma.roadmap.update({ where: { id: roadmap.id }, data: { progress, currentPhase: phase?.no ?? 1 } });
  }
  return { roadmap, goal, phases, progress, phase, dayIndex, totalDays, nextMilestone: all.find((m) => !m.done) ?? null };
}
