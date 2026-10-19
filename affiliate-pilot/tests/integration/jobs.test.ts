import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelJob, isRunning, rerunJob, runJob } from "@/lib/automation";
import { prisma } from "@/lib/db";
import { setSetting } from "@/lib/settings";

// 応答しない Ollama（PCが遅くて待たされる状況の再現）
let server: http.Server;
let url = "";

beforeAll(async () => {
  server = http.createServer((req) => {
    if (req.url === "/api/tags") return void req.socket.end('HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{"models":[{"name":"slow:latest"}]}');
    // /api/chat は返事をしない
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (!(await prisma.profile.count())) {
    await prisma.profile.create({ data: { experienceLevel: "none", dailyWorkMinutes: 90, monthlyBudget: 0, preferredPlatforms: '["x"]', onboardedAt: new Date() } });
  }
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe("ジョブのキャンセル・再実行", () => {
  it("バックグラウンドのAI生成をキャンセルできる", async () => {
    await setSetting("ai", { mode: "ollama", ollamaBaseUrl: url, ollamaModel: "slow", claudeModel: "claude-haiku-5-5", timeoutSec: 60 });
    const id = await runJob("content_draft", { contentType: "x_post", inputs: { product: "テスト" } }, { background: true });
    // すぐに戻ってくる（待たずに他の画面を使える）
    await new Promise((r) => setTimeout(r, 200));
    expect(isRunning(id)).toBe(true);
    expect(cancelJob(id)).toBe(true);
    await expect.poll(async () => (await prisma.automationJob.findUnique({ where: { id } }))?.status, { timeout: 5000 }).toBe("failed");
    const job = await prisma.automationJob.findUnique({ where: { id }, include: { logs: true } });
    expect(job?.errorMessage).toMatch(/キャンセル/);
    expect(job?.logs.some((l) => l.action === "キャンセル")).toBe(true);
    expect(isRunning(id)).toBe(false);
    // キャンセルしたら下書きは作られない
    expect(await prisma.contentDraft.count({ where: { title: { contains: "テスト" } } })).toBe(0);
  });

  it("失敗したジョブを同じ入力で再実行できる（AIなしならテンプレートで完了）", async () => {
    const failed = await prisma.automationJob.findFirst({ where: { status: "failed", jobType: "content_draft" }, orderBy: { createdAt: "desc" } });
    await setSetting("ai", { mode: "off", ollamaBaseUrl: "", ollamaModel: "qwen2.5:7b", claudeModel: "claude-haiku-5-5", timeoutSec: 60 });
    const id = await rerunJob(failed!.id);
    const job = await prisma.automationJob.findUnique({ where: { id } });
    expect(job?.status).toBe("awaiting_review");
    expect(JSON.parse(job!.payload)).toEqual(JSON.parse(failed!.payload));
    const draft = await prisma.contentDraft.findUnique({ where: { id: JSON.parse(job!.result).draftId } });
    expect(draft?.body).toContain("PR");
    expect(draft?.status).toBe("awaiting_review");
  });
});
