import { processDueBroadcasts } from "./broadcasts";
import { processDueSteps } from "./scenarios";

let running = false;

export async function runDueJobs() {
  if (running) return;
  running = true;
  try {
    await processDueBroadcasts();
    await processDueSteps();
  } finally {
    running = false;
  }
}
