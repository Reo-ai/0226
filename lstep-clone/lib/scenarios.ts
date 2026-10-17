import { all, get, run } from "./db";
import { pushToFriend, type Outbox } from "./delivery";
import { jstDayStart } from "./format";
import { getFriend } from "./friends";
import { QuotaError, pushRemaining } from "./quota";
import type { Friend, Scenario, ScenarioStep } from "./types";

function steps(scenarioId: number) {
  return all<ScenarioStep>(
    "SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY delay_minutes, id",
    scenarioId,
  );
}

/** ステップの配信時刻。時刻指定のステップは開始日の0時(JST)から数える */
const dueAt = (e: { started_at: number }, s: ScenarioStep) =>
  (s.fixed_time ? jstDayStart(e.started_at) : e.started_at) + s.delay_minutes * 60_000;

/** 配信を止めるタグが付いている人の進行中シナリオを止める */
const STOPPED_BY_TAG = `EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = e.friend_id AND ft.tag_id = s.stop_tag_id)`;

/** シナリオ開始。各ステップは開始時刻からの経過時間（または開始日からの日数＋時刻）で配信される */
export async function enroll(friendId: number, scenarioId: number) {
  const stopped = await get(
    `SELECT 1 FROM scenarios s JOIN friend_tags ft ON ft.tag_id = s.stop_tag_id
     WHERE s.id = ? AND ft.friend_id = ?`,
    scenarioId,
    friendId,
  );
  if (stopped) return;
  const first = (await steps(scenarioId))[0];
  const now = Date.now();
  const button = (await get<Scenario>("SELECT * FROM scenarios WHERE id = ?", scenarioId))?.mode === "button";
  await run(
    `INSERT INTO enrollments (friend_id, scenario_id, started_at, next_step_index, next_run_at, waiting, status, await_tap)
     VALUES (?, ?, ?, 0, ?, 0, ?, 0)
     ON CONFLICT(friend_id, scenario_id) DO UPDATE SET
       started_at = excluded.started_at, next_step_index = 0, waiting = 0, await_tap = 0,
       next_run_at = excluded.next_run_at, status = excluded.status`,
    friendId,
    scenarioId,
    now,
    // ボタン式は1通目をすぐ（友だち追加・タグ付けへの返事として無料で）届ける
    first ? (button ? now : dueAt({ started_at: now }, first)) : null,
    first ? "active" : "done",
  );
}

export async function enrollByFollow(friendId: number) {
  const list = await all<Scenario>("SELECT * FROM scenarios WHERE enabled = 1 AND trigger = 'follow'");
  for (const s of list) await enroll(friendId, s.id);
}

/** タグが付いた時、そのタグで止めるシナリオを停止する */
export async function stopByTag(friendId: number, tagId: number) {
  await run(
    `UPDATE enrollments SET status = 'stopped', next_run_at = NULL
     WHERE friend_id = ? AND status = 'active' AND scenario_id IN (SELECT id FROM scenarios WHERE stop_tag_id = ?)`,
    friendId,
    tagId,
  );
}

export async function enrollByTag(friendId: number, tagId: number) {
  const list = await all<Scenario>(
    "SELECT * FROM scenarios WHERE enabled = 1 AND trigger = 'tag' AND trigger_tag_id = ?",
    tagId,
  );
  for (const s of list) await enroll(friendId, s.id);
}

interface EnrollmentRow {
  id: number;
  friend_id: number;
  scenario_id: number;
  started_at: number;
  next_step_index: number;
}

/** ステップの送る条件（タグがある／ない）に合うか。合わなければ送らずに次へ進む */
async function stepAllowed(friendId: number, step: ScenarioStep): Promise<boolean> {
  if (!step.cond_tag_id || !step.cond_type) return true;
  const has = await get<{ n: number }>(
    "SELECT 1 n FROM friend_tags WHERE friend_id = ? AND tag_id = ?",
    friendId,
    step.cond_tag_id,
  );
  return step.cond_type === "has" ? Boolean(has) : !has;
}

async function advance(e: EnrollmentRow, list: ScenarioStep[], idx: number) {
  const next = list[idx];
  await run(
    "UPDATE enrollments SET next_step_index = ?, next_run_at = ?, waiting = 0, status = ? WHERE id = ?",
    idx,
    next ? dueAt(e, next) : null,
    next ? "active" : "done",
    e.id,
  );
}

/**
 * 友だちから反応（追加・メッセージ・ボタン）があった時に呼ぶ。
 * 配信時刻を過ぎたステップを応答メッセージ（無料）に積む。
 */
export async function collectDueSteps(box: Outbox, now = Date.now()) {
  const due = await all<EnrollmentRow & { mode: string }>(
    `SELECT e.id, e.friend_id, e.scenario_id, e.started_at, e.next_step_index, s.mode
     FROM enrollments e JOIN scenarios s ON s.id = e.scenario_id
     WHERE e.friend_id = ? AND e.status = 'active' AND s.enabled = 1 AND e.next_run_at <= ? AND e.await_tap = 0
       AND NOT ${STOPPED_BY_TAG}`,
    box.friend.id,
    now,
  );
  for (const e of due) {
    if (e.mode === "button") {
      await deliverButtonStep(e, box.friend, box);
      continue;
    }
    const list = await steps(e.scenario_id);
    let idx = e.next_step_index;
    while (idx < list.length && dueAt(e, list[idx]) <= now) {
      if (await stepAllowed(box.friend.id, list[idx])) box.add(list[idx].content, "step", list[idx].id);
      idx++;
    }
    await advance(e, list, idx);
  }
}

/**
 * 定期実行。push型のステップをプッシュで送る。
 * reply型（反応待ち）のステップは相手の反応まで待機させる。通数が尽きたら止める。
 */
export async function processDueSteps(now = Date.now()) {
  const due = await all<EnrollmentRow & { mode: string; await_tap: number }>(
    `SELECT e.id, e.friend_id, e.scenario_id, e.started_at, e.next_step_index, s.mode, e.await_tap
     FROM enrollments e JOIN scenarios s ON s.id = e.scenario_id
     WHERE e.status = 'active' AND e.waiting = 0 AND s.enabled = 1 AND e.next_run_at <= ?
       AND NOT ${STOPPED_BY_TAG}
     ORDER BY e.next_run_at LIMIT 200`,
    now,
  );
  for (const e of due) {
    if ((await pushRemaining()) < 1) return; // 無料通数切れ: 反応があった人には応答で届く
    const friend = await getFriend(e.friend_id);
    if (!friend || friend.blocked) {
      await run("UPDATE enrollments SET status = 'stopped', next_run_at = NULL WHERE id = ?", e.id);
      continue;
    }
    if (e.mode === "button") {
      // ボタン待ちのまま時間がたった人：1回だけお知らせ／まだ1通目が届いていない人（管理画面からの開始など）：1通目を送る
      if (e.await_tap) await nudge(e, friend);
      else await deliverButtonStep(e, friend, null);
      continue;
    }
    const list = await steps(e.scenario_id);
    let idx = e.next_step_index;
    let waiting = false;
    while (idx < list.length && dueAt(e, list[idx]) <= now) {
      const step = list[idx];
      if (!(await stepAllowed(friend.id, step))) {
        idx++;
        continue;
      }
      if (step.delivery === "reply") {
        waiting = true;
        break;
      }
      try {
        await pushToFriend(friend, step.content, "step", step.id);
      } catch (err) {
        if (err instanceof QuotaError) break;
        console.error(`step ${step.id} -> friend ${friend.id} failed`, err);
      }
      idx++;
    }
    if (idx !== e.next_step_index) await advance(e, list, idx);
    if (waiting) await run("UPDATE enrollments SET waiting = 1 WHERE id = ?", e.id);
  }
}

export async function scenarioOf(id: number) {
  return get<Scenario>("SELECT * FROM scenarios WHERE id = ?", id);
}

// ---- ボタン式のステップ配信 ----
// 1通ごとに「次へ進む」ボタン（クイックリプライ）を付けて送り、押されたら次を返す。
// 押されたときの返事は無料なので、最後まで届けても配信数をほとんど使わない

/** 本文の最後に「次へ進む」ボタンを足す（すでに選択肢の行があれば、その行に足す） */
function withNextButton(content: string, label: string): string {
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*-{3}\s*$/.test(lines[i])) break; // 最後の吹き出しの中だけを見る
    if (/^\s*選択肢[:：]/.test(lines[i])) {
      lines[i] = `${lines[i]} / ${label}`;
      return lines.join("\n");
    }
  }
  return `${content}\n選択肢: ${label}`;
}

/** 次に送るステップ（送る条件に合うもの）を探す。無ければ -1 */
async function nextAllowed(friendId: number, list: ScenarioStep[], from: number): Promise<number> {
  for (let i = from; i < list.length; i++) if (await stepAllowed(friendId, list[i])) return i;
  return -1;
}

/** ボタン式の次のステップを届ける。box があれば返事（無料）で、無ければプッシュで */
async function deliverButtonStep(e: EnrollmentRow, friend: Friend, box: Outbox | null) {
  const s = await scenarioOf(e.scenario_id);
  if (!s) return;
  const list = await steps(e.scenario_id);
  const idx = await nextAllowed(friend.id, list, e.next_step_index);
  if (idx < 0) {
    await run("UPDATE enrollments SET status = 'done', next_run_at = NULL, await_tap = 0 WHERE id = ?", e.id);
    return;
  }
  const more = (await nextAllowed(friend.id, list, idx + 1)) >= 0;
  const content = more ? withNextButton(list[idx].content, s.next_label || "次へ進む") : list[idx].content;
  if (box) box.add(content, "step", list[idx].id);
  else {
    try {
      await pushToFriend(friend, content, "step", list[idx].id);
    } catch (err) {
      if (!(err instanceof QuotaError)) console.error(`step ${list[idx].id} -> friend ${friend.id} failed`, err);
      return; // 送れなければ、次に反応があった時に届く
    }
  }
  await run(
    "UPDATE enrollments SET next_step_index = ?, await_tap = ?, status = ?, next_run_at = ?, waiting = 0 WHERE id = ?",
    idx + 1,
    more ? 1 : 0,
    more ? "active" : "done",
    more && s.nudge_hours > 0 ? Date.now() + s.nudge_hours * 3600_000 : null,
    e.id,
  );
}

/** 押されないまま時間がたった人に、1回だけお知らせする（これだけは配信数を1通使う） */
async function nudge(e: EnrollmentRow, friend: Friend) {
  const s = await scenarioOf(e.scenario_id);
  if (!s) return;
  const label = s.next_label || "次へ進む";
  try {
    await pushToFriend(friend, `${friend.display_name || ""}さん、続きが届いています📩\n下のボタンから受け取れます\n選択肢: ${label}`, "step", null);
  } catch (err) {
    if (!(err instanceof QuotaError)) console.error(`nudge -> friend ${friend.id} failed`, err);
    return;
  }
  await run("UPDATE enrollments SET next_run_at = NULL WHERE id = ?", e.id);
}

/** 友だちが「次へ進む」を押した（その文字を送った）：ボタン待ちのシナリオがあれば次を返す */
export async function handleNextTap(box: Outbox, text: string): Promise<boolean> {
  const e = await get<EnrollmentRow>(
    `SELECT e.id, e.friend_id, e.scenario_id, e.started_at, e.next_step_index
     FROM enrollments e JOIN scenarios s ON s.id = e.scenario_id
     WHERE e.friend_id = ? AND e.status = 'active' AND e.await_tap = 1 AND s.enabled = 1 AND s.mode = 'button'
       AND s.next_label = ? AND NOT ${STOPPED_BY_TAG}
     ORDER BY e.started_at DESC LIMIT 1`,
    box.friend.id,
    text.trim(),
  );
  if (!e) return false;
  await run("UPDATE enrollments SET await_tap = 0 WHERE id = ?", e.id);
  await deliverButtonStep(e, box.friend, box);
  return true;
}
