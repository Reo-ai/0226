import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { syncLessons } from "@/lib/academy";
import { runAI } from "@/lib/ai";
import { records } from "@/lib/analytics";
import { runJob } from "@/lib/automation";
import { exportAll, importAll } from "@/lib/backup";
import { generateContent } from "@/lib/content";
import { prisma } from "@/lib/db";
import { jstDay } from "@/lib/format";
import { totals } from "@/lib/metrics";
import { dedupeKey } from "@/lib/records";
import { contentInputsSchema } from "@/lib/schemas";
import { setSetting } from "@/lib/settings";
import { planToday, todayTasks } from "@/lib/tasks";

let profileId = "";

beforeAll(async () => {
  const p = await prisma.profile.create({ data: { experienceLevel: "none", dailyWorkMinutes: 60, monthlyBudget: 0, preferredPlatforms: '["instagram"]', onboardedAt: new Date() } });
  profileId = p.id;
  await prisma.goal.create({ data: { profileId, targetMonthlyRevenue: 50_000, targetDate: new Date(Date.now() + 90 * 86_400_000) } });
});

describe("AI未接続時のフォールバック", () => {
  it("Ollama に接続できなければルールの結果と警告を返す", async () => {
    const r = await runAI({ system: "s", prompt: "p", schema: z.object({ v: z.number() }), fallback: () => ({ v: 42 }) });
    expect(r.generatedBy).toBe("fallback");
    expect(r.data).toEqual({ v: 42 });
    expect(r.warning).toMatch(/Ollama/);
  });
  it("AIを使わない設定では警告なしでルールを使う", async () => {
    await setSetting("ai", { mode: "off", ollamaBaseUrl: "", ollamaModel: "qwen2.5:7b", claudeModel: "claude-haiku-5-5", timeoutSec: 30 });
    const r = await runAI({ system: "s", prompt: "p", schema: z.object({ v: z.number() }), fallback: () => ({ v: 1 }) });
    expect(r).toEqual({ data: { v: 1 }, generatedBy: "fallback", warning: null });
  });
  it("コンテンツはテンプレートで作れる", async () => {
    const r = await generateContent("x_post", contentInputsSchema.parse({ product: "サンプル" }), null, null);
    expect(r.data.body).toContain("PR");
  });
});

describe("タスク", () => {
  it("今日のタスクは作業可能時間内で作られ、完了できる", async () => {
    const profile = (await prisma.profile.findUnique({ where: { id: profileId } }))!;
    await planToday(profile);
    const tasks = await todayTasks(profileId);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.reduce((m, t) => m + t.estimatedMinutes, 0)).toBeLessThanOrEqual(60);
    await prisma.task.update({ where: { id: tasks[0].id }, data: { status: "done", completedAt: new Date() } });
    // 組み直しても完了済みのルールタスクは復活しない
    await planToday(profile);
    const again = await todayTasks(profileId);
    expect(again.filter((t) => t.ruleKey === tasks[0].ruleKey && t.status === "todo")).toHaveLength(0);
  });
});

describe("データの登録と取得", () => {
  it("案件・コンテンツを保存できる", async () => {
    const offer = await prisma.affiliateOffer.create({ data: { name: "テスト案件", commissionAmount: 3000, approvalRate: null } });
    const d = await prisma.contentDraft.create({ data: { platform: "x", contentType: "x_post", title: "t", body: "【PR】b", generatedBy: "template", affiliateOfferId: offer.id } });
    expect((await prisma.contentDraft.findUnique({ where: { id: d.id }, include: { offer: true } }))?.offer?.name).toBe("テスト案件");
    expect((await prisma.affiliateOffer.findUnique({ where: { id: offer.id } }))?.approvalRate).toBeNull();
  });
  it("成果記録は同じ組み合わせで上書きされ、二重集計されない", async () => {
    const day = jstDay();
    const row = { recordDate: day, platform: "x", clicks: 10, confirmedRevenue: 3000 };
    const key = dedupeKey(row);
    await prisma.performanceRecord.upsert({ where: { dedupeKey: key }, create: { ...row, dedupeKey: key }, update: row });
    await prisma.performanceRecord.upsert({ where: { dedupeKey: key }, create: { ...row, dedupeKey: key }, update: { ...row, clicks: 12 } });
    const t = totals(await records(day));
    expect(t.clicks).toBe(12);
    expect(t.confirmedRevenue).toBe(3000);
    expect(t.impressions).toBeNull();
  });
  it("学習進捗を保存できる", async () => {
    await syncLessons();
    expect(await prisma.lesson.count()).toBeGreaterThanOrEqual(40);
    const lesson = (await prisma.lesson.findFirst({ where: { courseId: "asp" }, orderBy: { lessonOrder: "asc" } }))!;
    await prisma.lessonProgress.create({ data: { profileId, lessonId: lesson.id, completionStatus: "completed", quizScore: 1, completedAt: new Date() } });
    await syncLessons(); // 同期し直しても進捗は消えない
    expect(await prisma.lessonProgress.count({ where: { profileId, completionStatus: "completed" } })).toBe(1);
  });
});

describe("自動化ジョブ", () => {
  it("改善案ジョブは確認待ちになり、実績と仮説を分けて持つ", async () => {
    const id = await runJob("improvement");
    const job = (await prisma.automationJob.findUnique({ where: { id }, include: { logs: true } }))!;
    expect(job.status).toBe("awaiting_review");
    expect(job.startedAt).not.toBeNull();
    expect(job.logs.length).toBeGreaterThan(0);
    const result = JSON.parse(job.result);
    expect(Array.isArray(result.facts)).toBe(true);
    expect(Array.isArray(result.hypotheses)).toBe(true);
  });
  it("失敗したジョブはエラー内容を記録する", async () => {
    const id = await runJob("content_draft", { offerId: "存在しない" });
    const job = (await prisma.automationJob.findUnique({ where: { id } }))!;
    expect(job.status).toBe("failed");
    expect(job.errorMessage).toMatch(/案件/);
  });
});

describe("バックアップ", () => {
  it("書き出して復元すると同じ件数に戻る", async () => {
    const dump = JSON.parse(JSON.stringify(await exportAll()));
    const before = await prisma.performanceRecord.count();
    await prisma.performanceRecord.deleteMany();
    await importAll(dump);
    expect(await prisma.performanceRecord.count()).toBe(before);
    await expect(importAll({ app: "other" })).rejects.toThrow();
  });
});
