"use server";
// 生徒管理ツールの保存操作
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth";
import { JOB_STATUS, QUESTION_STATUS, QUESTS } from "./coach";
import { run } from "./db";
import { jstDateKey } from "./format";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0);
const refresh = () => revalidatePath("/coach", "layout");

/** 回答を保存する。書いてあれば「回答済み」にする（LINEへは送らない） */
export async function saveAnswer(fd: FormData) {
  await requireAuth();
  const answer = str(fd, "answer").slice(0, 5000);
  const quest = str(fd, "quest");
  await run(
    `UPDATE coach_questions SET answer = ?, quest = ?, answered_at = CASE WHEN ? != '' THEN COALESCE(answered_at, ?) ELSE answered_at END,
       status = CASE WHEN ? != '' AND status = 'open' THEN 'answered' ELSE status END WHERE id = ?`,
    answer,
    QUESTS.includes(quest) ? quest : "",
    answer,
    Date.now(),
    answer,
    num(fd, "id"),
  );
  refresh();
}

export async function setQuestionStatus(fd: FormData) {
  await requireAuth();
  const status = str(fd, "status");
  if (status in QUESTION_STATUS) await run("UPDATE coach_questions SET status = ? WHERE id = ?", status, num(fd, "id"));
  refresh();
}

export async function addJob(fd: FormData) {
  await requireAuth();
  const title = str(fd, "title").slice(0, 200);
  const status = str(fd, "status");
  if (!title) return;
  const url = str(fd, "url");
  await run(
    "INSERT INTO coach_jobs (friend_id, title, site, url, status, applied_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    num(fd, "friendId"),
    title,
    str(fd, "site").slice(0, 60),
    /^https?:\/\//.test(url) ? url.slice(0, 500) : "",
    status in JOB_STATUS ? status : "applied",
    /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "appliedOn")) ? str(fd, "appliedOn") : jstDateKey(Date.now()),
    Date.now(),
  );
  refresh();
}

export async function setJobStatus(fd: FormData) {
  await requireAuth();
  const status = str(fd, "status");
  if (status in JOB_STATUS) await run("UPDATE coach_jobs SET status = ? WHERE id = ?", status, num(fd, "id"));
  refresh();
}

export async function deleteJob(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM coach_jobs WHERE id = ?", num(fd, "id"));
  refresh();
}

export async function addEarning(fd: FormData) {
  await requireAuth();
  const month = str(fd, "month");
  const amount = Math.round(num(fd, "amount"));
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount <= 0) return;
  await run(
    "INSERT INTO coach_earnings (friend_id, month, amount, note, created_at) VALUES (?, ?, ?, ?, ?)",
    num(fd, "friendId"),
    month,
    amount,
    str(fd, "note").slice(0, 200),
    Date.now(),
  );
  refresh();
}

export async function deleteEarning(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM coach_earnings WHERE id = ?", num(fd, "id"));
  refresh();
}
