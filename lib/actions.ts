"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, clearSession, requireAuth, setSession } from "./auth";
import { sendBroadcast } from "./broadcasts";
import { db, setSetting } from "./db";
import { parseJstLocal } from "./format";
import { getFriend } from "./friends";
import { sendToFriend } from "./messaging";
import { enroll } from "./scenarios";
import { addTag, removeTag } from "./tags";
import type { Broadcast } from "./types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0);
const optId = (fd: FormData, k: string) => num(fd, k) || null;

// ---- auth ----
export async function login(_: string | null, fd: FormData): Promise<string | null> {
  if (!checkPassword(str(fd, "password"))) return "パスワードが違います（または環境変数が未設定です）";
  await setSession();
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

// ---- friends ----
export async function sendManual(fd: FormData) {
  await requireAuth();
  const friend = getFriend(num(fd, "friendId"));
  const content = str(fd, "content");
  if (!friend || !content) return;
  await sendToFriend(friend, content, "manual");
  revalidatePath(`/friends/${friend.id}`);
}

export async function toggleFriendAi(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  db().prepare("UPDATE friends SET ai_enabled = 1 - ai_enabled WHERE id = ?").run(id);
  revalidatePath(`/friends/${id}`);
}

export async function saveFriendNote(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  db().prepare("UPDATE friends SET note = ? WHERE id = ?").run(str(fd, "note"), id);
  revalidatePath(`/friends/${id}`);
}

export async function addFriendTag(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  const tagId = num(fd, "tagId");
  if (tagId) addTag(id, tagId);
  revalidatePath(`/friends/${id}`);
}

export async function removeFriendTag(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  removeTag(id, num(fd, "tagId"));
  revalidatePath(`/friends/${id}`);
}

export async function enrollFriend(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  const scenarioId = num(fd, "scenarioId");
  if (scenarioId) enroll(id, scenarioId);
  revalidatePath(`/friends/${id}`);
}

export async function stopEnrollment(fd: FormData) {
  await requireAuth();
  db()
    .prepare("UPDATE enrollments SET status = 'stopped', next_run_at = NULL WHERE id = ?")
    .run(num(fd, "enrollmentId"));
  revalidatePath(`/friends/${num(fd, "friendId")}`);
}

// ---- tags ----
export async function createTag(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name");
  if (name) {
    db().prepare("INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)").run(name, str(fd, "color") || "#06c755");
  }
  revalidatePath("/tags");
}

export async function deleteTag(fd: FormData) {
  await requireAuth();
  db().prepare("DELETE FROM tags WHERE id = ?").run(num(fd, "id"));
  revalidatePath("/tags");
}

// ---- broadcasts ----
export async function createBroadcast(fd: FormData) {
  await requireAuth();
  const content = str(fd, "content");
  if (!content) return;
  const tagIds = fd.getAll("tagIds").map(Number).filter(Boolean);
  const when = str(fd, "scheduledAt");
  const scheduledAt = str(fd, "mode") === "schedule" && when ? parseJstLocal(when) : Date.now();
  const info = db()
    .prepare(
      "INSERT INTO broadcasts (title, content, tag_ids, status, scheduled_at, created_at) VALUES (?, ?, ?, 'scheduled', ?, ?)",
    )
    .run(str(fd, "title") || content.slice(0, 20), content, JSON.stringify(tagIds), scheduledAt, Date.now());
  if (scheduledAt <= Date.now()) {
    const b = db().prepare("SELECT * FROM broadcasts WHERE id = ?").get(info.lastInsertRowid) as Broadcast;
    await sendBroadcast(b);
  }
  revalidatePath("/broadcasts");
  redirect("/broadcasts");
}

export async function cancelBroadcast(fd: FormData) {
  await requireAuth();
  db().prepare("UPDATE broadcasts SET status = 'canceled' WHERE id = ? AND status = 'scheduled'").run(num(fd, "id"));
  revalidatePath("/broadcasts");
}

// ---- scenarios ----
export async function createScenario(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name");
  if (!name) return;
  const trigger = str(fd, "trigger") as "follow" | "tag" | "manual";
  const info = db()
    .prepare("INSERT INTO scenarios (name, trigger, trigger_tag_id, created_at) VALUES (?, ?, ?, ?)")
    .run(name, trigger, trigger === "tag" ? optId(fd, "triggerTagId") : null, Date.now());
  redirect(`/scenarios/${info.lastInsertRowid}`);
}

export async function toggleScenario(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  db().prepare("UPDATE scenarios SET enabled = 1 - enabled WHERE id = ?").run(id);
  revalidatePath(`/scenarios/${id}`);
  revalidatePath("/scenarios");
}

export async function deleteScenario(fd: FormData) {
  await requireAuth();
  db().prepare("DELETE FROM scenarios WHERE id = ?").run(num(fd, "id"));
  redirect("/scenarios");
}

export async function addStep(fd: FormData) {
  await requireAuth();
  const scenarioId = num(fd, "scenarioId");
  const content = str(fd, "content");
  const delay = num(fd, "days") * 1440 + num(fd, "hours") * 60 + num(fd, "minutes");
  if (content) {
    db()
      .prepare("INSERT INTO scenario_steps (scenario_id, delay_minutes, content) VALUES (?, ?, ?)")
      .run(scenarioId, Math.max(0, delay), content);
  }
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function deleteStep(fd: FormData) {
  await requireAuth();
  db().prepare("DELETE FROM scenario_steps WHERE id = ?").run(num(fd, "id"));
  revalidatePath(`/scenarios/${num(fd, "scenarioId")}`);
}

// ---- auto replies ----
export async function createAutoReply(fd: FormData) {
  await requireAuth();
  const keyword = str(fd, "keyword");
  const reply = str(fd, "reply");
  if (keyword && reply) {
    db()
      .prepare("INSERT INTO auto_replies (keyword, match_type, reply, add_tag_id) VALUES (?, ?, ?, ?)")
      .run(keyword, str(fd, "matchType") === "contains" ? "contains" : "exact", reply, optId(fd, "addTagId"));
  }
  revalidatePath("/auto-replies");
}

export async function toggleAutoReply(fd: FormData) {
  await requireAuth();
  db().prepare("UPDATE auto_replies SET enabled = 1 - enabled WHERE id = ?").run(num(fd, "id"));
  revalidatePath("/auto-replies");
}

export async function deleteAutoReply(fd: FormData) {
  await requireAuth();
  db().prepare("DELETE FROM auto_replies WHERE id = ?").run(num(fd, "id"));
  revalidatePath("/auto-replies");
}

// ---- links ----
export async function createLink(fd: FormData) {
  await requireAuth();
  const url = str(fd, "url");
  if (!/^https?:\/\//.test(url)) return;
  const code = str(fd, "code").replace(/[^\w-]/g, "") || crypto.randomBytes(4).toString("hex");
  db()
    .prepare("INSERT OR IGNORE INTO links (code, name, url, add_tag_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(code, str(fd, "name") || url, url, optId(fd, "addTagId"), Date.now());
  revalidatePath("/links");
}

export async function deleteLink(fd: FormData) {
  await requireAuth();
  db().prepare("DELETE FROM links WHERE id = ?").run(num(fd, "id"));
  revalidatePath("/links");
}

// ---- settings ----
export async function saveSettings(fd: FormData) {
  await requireAuth();
  setSetting("ai_enabled", fd.get("aiEnabled") ? "1" : "0");
  setSetting("ai_model", str(fd, "aiModel"));
  setSetting("ai_system_prompt", str(fd, "aiSystemPrompt"));
  setSetting("ai_knowledge", str(fd, "aiKnowledge"));
  revalidatePath("/settings");
}
