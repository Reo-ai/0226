import { db } from "./db";
import { getFriend } from "./friends";
import { sendToFriend } from "./messaging";
import type { Scenario, ScenarioStep } from "./types";

function steps(scenarioId: number): ScenarioStep[] {
  return db()
    .prepare("SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY delay_minutes, id")
    .all(scenarioId) as ScenarioStep[];
}

/** シナリオ開始。各ステップは開始時刻からの経過時間で配信される */
export function enroll(friendId: number, scenarioId: number) {
  const first = steps(scenarioId)[0];
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO enrollments (friend_id, scenario_id, started_at, next_step_index, next_run_at, status)
       VALUES (?, ?, ?, 0, ?, ?)
       ON CONFLICT(friend_id, scenario_id) DO UPDATE SET
         started_at = excluded.started_at, next_step_index = 0,
         next_run_at = excluded.next_run_at, status = excluded.status`,
    )
    .run(friendId, scenarioId, now, first ? now + first.delay_minutes * 60_000 : null, first ? "active" : "done");
}

export function enrollByFollow(friendId: number) {
  const list = db()
    .prepare("SELECT * FROM scenarios WHERE enabled = 1 AND trigger = 'follow'")
    .all() as Scenario[];
  for (const s of list) enroll(friendId, s.id);
}

export function enrollByTag(friendId: number, tagId: number) {
  const list = db()
    .prepare("SELECT * FROM scenarios WHERE enabled = 1 AND trigger = 'tag' AND trigger_tag_id = ?")
    .all(tagId) as Scenario[];
  for (const s of list) enroll(friendId, s.id);
}

interface DueRow {
  id: number;
  friend_id: number;
  scenario_id: number;
  started_at: number;
  next_step_index: number;
}

/** 配信時刻を過ぎたステップを送る */
export async function processDueSteps(now = Date.now()) {
  const due = db()
    .prepare(
      `SELECT e.id, e.friend_id, e.scenario_id, e.started_at, e.next_step_index
       FROM enrollments e JOIN scenarios s ON s.id = e.scenario_id
       WHERE e.status = 'active' AND s.enabled = 1 AND e.next_run_at <= ?
       ORDER BY e.next_run_at LIMIT 500`,
    )
    .all(now) as DueRow[];

  for (const e of due) {
    const list = steps(e.scenario_id);
    const friend = getFriend(e.friend_id);
    if (!friend || friend.blocked) {
      db().prepare("UPDATE enrollments SET status = 'stopped', next_run_at = NULL WHERE id = ?").run(e.id);
      continue;
    }
    let idx = e.next_step_index;
    // 同時刻に到達済みのステップはまとめて送る
    while (idx < list.length && e.started_at + list[idx].delay_minutes * 60_000 <= now) {
      try {
        await sendToFriend(friend, list[idx].content, "step", list[idx].id);
      } catch (err) {
        console.error(`step ${list[idx].id} -> friend ${friend.id} failed`, err);
      }
      idx++;
    }
    const next = list[idx];
    db()
      .prepare("UPDATE enrollments SET next_step_index = ?, next_run_at = ?, status = ? WHERE id = ?")
      .run(
        idx,
        next ? e.started_at + next.delay_minutes * 60_000 : null,
        next ? "active" : "done",
        e.id,
      );
  }
}
