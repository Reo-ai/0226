"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findLesson, PASS_SCORE } from "../academy";
import { dataBlock, runAI } from "../ai";
import { prisma } from "../db";
import { requireProfile } from "../profile";
import { numberListSchema, parseJson } from "../schemas";

async function progressRow(profileId: string, lessonId: string) {
  return prisma.lessonProgress.upsert({
    where: { profileId_lessonId: { profileId, lessonId } },
    create: { profileId, lessonId, completionStatus: "in_progress" },
    update: {},
  });
}

const paths = (courseId: string, lessonId: string) => {
  revalidatePath(`/academy/${courseId}/${lessonId}`);
  revalidatePath(`/academy/${courseId}`);
  revalidatePath("/academy");
};

export async function toggleChecklist(fd: FormData) {
  const profile = await requireProfile();
  const courseId = String(fd.get("courseId"));
  const lessonId = String(fd.get("lessonId"));
  const i = Number(fd.get("index"));
  const found = findLesson(courseId, lessonId);
  if (!found || !Number.isInteger(i) || i < 0 || i >= found.lesson.checklist.length) return;
  const row = await progressRow(profile.id, lessonId);
  const list = parseJson(numberListSchema, row.checklist, []);
  const next = list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
  await prisma.lessonProgress.update({ where: { id: row.id }, data: { checklist: JSON.stringify(next) } });
  paths(courseId, lessonId);
}

export type QuizState = { score: number; results: { correct: boolean; answer: number; chosen: number | null }[]; passed: boolean } | { error: string } | null;

export async function submitQuiz(_: QuizState, fd: FormData): Promise<QuizState> {
  const profile = await requireProfile();
  const courseId = String(fd.get("courseId"));
  const lessonId = String(fd.get("lessonId"));
  const found = findLesson(courseId, lessonId);
  if (!found) return { error: "レッスンが見つかりません" };
  const answers = found.lesson.quiz.map((_, i) => {
    const v = fd.get(`q${i}`);
    return v === null ? null : Number(v);
  });
  if (answers.some((a) => a === null)) return { error: "すべての問題に答えてください" };
  const results = found.lesson.quiz.map((q, i) => ({ correct: answers[i] === q.answer, answer: q.answer, chosen: answers[i] }));
  const score = results.filter((r) => r.correct).length / results.length;
  const row = await progressRow(profile.id, lessonId);
  await prisma.$transaction([
    prisma.quizAttempt.create({ data: { profileId: profile.id, lessonId, answers: JSON.stringify(answers), score } }),
    prisma.lessonProgress.update({ where: { id: row.id }, data: { quizScore: Math.max(score, row.quizScore ?? 0) } }),
  ]);
  paths(courseId, lessonId);
  return { score, results, passed: score >= PASS_SCORE };
}

export async function completeLesson(fd: FormData) {
  const profile = await requireProfile();
  const courseId = String(fd.get("courseId"));
  const lessonId = String(fd.get("lessonId"));
  if (!findLesson(courseId, lessonId)) return;
  const row = await progressRow(profile.id, lessonId);
  const undo = fd.get("undo") === "1";
  // 修了条件：クイズの正答率が基準以上
  if (!undo && (row.quizScore ?? 0) < PASS_SCORE) return;
  await prisma.lessonProgress.update({ where: { id: row.id }, data: undo ? { completionStatus: "in_progress", completedAt: null } : { completionStatus: "completed", completedAt: new Date() } });
  paths(courseId, lessonId);
  revalidatePath("/");
}

export type AskState = { answer?: string; related?: string[]; by?: string; error?: string } | null;

const answerSchema = z.object({ answer: z.string().min(1).max(1500), related: z.array(z.string().max(60)).max(5) });

/** 学習AI：レッスンについての質問に答える。AIなしならレッスン内の用語・本文から該当箇所を返す */
export async function askLesson(_: AskState, fd: FormData): Promise<AskState> {
  await requireProfile();
  const found = findLesson(String(fd.get("courseId")), String(fd.get("lessonId")));
  const q = String(fd.get("question") ?? "").trim().slice(0, 500);
  if (!found) return { error: "レッスンが見つかりません" };
  if (!q) return { error: "質問を入力してください" };
  const { lesson } = found;
  const r = await runAI({
    system: "あなたはアフィリエイト初心者に教える学習AIです。レッスン内容に沿って、やさしく具体的に答えます。レッスンにない最新の規約・数字は推測せず、公式で確認するよう伝えます。",
    prompt: [dataBlock("レッスン", { title: lesson.title, body: lesson.body, glossary: lesson.glossary, cautions: lesson.cautions }), dataBlock("質問", q), "related には、あわせて読むとよい用語やレッスン内の見出しを挙げる。"].join("\n\n"),
    schema: answerSchema,
    fallback: () => searchLesson(lesson, q),
  });
  return { answer: r.data.answer, related: r.data.related, by: r.generatedBy, error: r.warning ?? undefined };
}

function searchLesson(lesson: NonNullable<ReturnType<typeof findLesson>>["lesson"], q: string) {
  const words = q.replace(/[？?。、！!]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
  const terms = lesson.glossary.filter((g) => q.includes(g.term) || words.some((w) => g.term.includes(w)));
  const paras = lesson.body.flatMap((b) => (b.type === "p" ? [b.text] : b.type === "ul" || b.type === "ol" ? b.items : [])).filter((t) => words.some((w) => t.includes(w))).slice(0, 2);
  const parts = [...terms.map((g) => `「${g.term}」：${g.definition}`), ...paras.map((p) => p.replace(/\*\*/g, ""))];
  return {
    answer: parts.length ? `AIに接続していないため、レッスン内の関連する説明を表示します。\n\n${parts.join("\n\n")}` : "AIに接続していないため、自動で答えられませんでした。用語解説と本文の見出しを確認するか、設定画面でAIを接続してください。",
    related: lesson.glossary.slice(0, 3).map((g) => g.term),
  };
}

export async function markSourceVerified(fd: FormData) {
  await requireProfile();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["verified", "unverified", "outdated"].includes(status)) return;
  await prisma.sourceReference.update({ where: { id }, data: { verificationStatus: status, verifiedAt: status === "unverified" ? null : new Date() } });
  revalidatePath("/academy", "layout");
}
