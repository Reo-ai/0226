import { sendBookingReminders } from "./bookings";
import { processDueBroadcasts } from "./broadcasts";
import { mainAll, run } from "./db";
import { sendHabitReminders } from "./habits";
import { sendNudges } from "./nudge";
import { sendDailyReport } from "./report";
import { processDueSteps } from "./scenarios";
import { currentWorkspace, MAIN, runInWorkspace } from "./workspace";

// 同じワークスペースの処理が重ならないように（ワークスペースごと）
const running = new Set<string>();

export async function runDueJobs() {
  const ws = await currentWorkspace();
  if (running.has(ws)) return;
  running.add(ws);
  try {
    await processDueBroadcasts();
    await processDueSteps();
    await sendHabitReminders();
    await sendNudges();
    await sendBookingReminders();
    await sendDailyReport();
    await run("DELETE FROM pending_messages WHERE expires_at <= ?", Date.now());
  } finally {
    running.delete(ws);
  }
}

/** 定期実行：すべてのワークスペースの予約配信・ステップ配信・リマインドを処理する */
export async function runDueJobsForAll(): Promise<{ ws: string; ok: boolean }[]> {
  const ids = [MAIN, ...(await mainAll<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at")).map((r) => r.id)];
  const results: { ws: string; ok: boolean }[] = [];
  for (const ws of ids) {
    try {
      await runInWorkspace(ws, runDueJobs);
      results.push({ ws, ok: true });
    } catch (e) {
      console.error(`定期実行に失敗（${ws}）`, e);
      results.push({ ws, ok: false });
    }
  }
  return results;
}
