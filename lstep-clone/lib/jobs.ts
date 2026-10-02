import { processDueBroadcasts } from "./broadcasts";
import { run } from "./db";
import { sendHabitReminders } from "./habits";
import { processDueSteps } from "./scenarios";

let running = false;

export async function runDueJobs() {
  if (running) return;
  running = true;
  try {
    await processDueBroadcasts();
    await processDueSteps();
    await sendHabitReminders();
    await run("DELETE FROM pending_messages WHERE expires_at <= ?", Date.now());
  } finally {
    running = false;
  }
}
