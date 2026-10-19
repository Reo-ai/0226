import { runJob } from "./automation";
import { prisma } from "./db";
import { DEFAULT_SCHEDULE, dueJobs, jstParts, lastRunsSchema, scheduleSchema } from "./scheduler";
import { getSetting, setSetting } from "./settings";

let busy = false;

/** 期限の来たジョブを実行する（instrumentation から1分ごとに呼ばれる） */
export async function runScheduled(now = new Date()) {
  if (busy) return [];
  busy = true;
  try {
    const profile = await prisma.profile.findFirst({ where: { onboardedAt: { not: null } } });
    if (!profile) return [];
    const [schedule, last] = await Promise.all([getSetting("schedule", scheduleSchema, DEFAULT_SCHEDULE), getSetting("schedule_last", lastRunsSchema, {})]);
    const due = dueJobs(schedule, now, last, jstParts(profile.onboardedAt!).week);
    if (!due.length) return [];
    // 先に「実行済み」を記録して、二重に実行しないようにする
    await setSetting("schedule_last", { ...last, ...Object.fromEntries(due.map((d) => [d.type, d.period])) });
    const ids = [];
    for (const d of due) ids.push(await runJob(d.type, { scheduled: true }, { background: d.type !== "daily_tasks" }));
    return ids;
  } finally {
    busy = false;
  }
}
