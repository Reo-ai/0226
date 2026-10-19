import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runScheduled } from "@/lib/scheduler-run";
import { setSetting } from "@/lib/settings";

describe("定期実行", () => {
  it("期限のジョブを1回だけ実行し、定期実行の印を付ける", async () => {
    await setSetting("ai", { mode: "off", ollamaBaseUrl: "", ollamaModel: "qwen2.5:7b", claudeModel: "claude-haiku-5-5", timeoutSec: 30 });
    await setSetting("schedule_last", {});
    if (!(await prisma.profile.count())) {
      await prisma.profile.create({ data: { experienceLevel: "none", dailyWorkMinutes: 90, monthlyBudget: 0, preferredPlatforms: '["x"]', onboardedAt: new Date("2026-01-05T00:00:00Z") } });
    }
    await prisma.profile.updateMany({ data: { onboardedAt: new Date("2026-01-05T00:00:00Z") } });
    const now = new Date("2026-10-19T01:00:00Z"); // 月曜 JST 10:00
    const ids = await runScheduled(now);
    expect(ids).toHaveLength(3);
    expect(await runScheduled(now)).toEqual([]); // 二重に実行しない
    const daily = await prisma.automationJob.findUnique({ where: { id: ids[0] } });
    expect(daily?.jobType).toBe("daily_tasks");
    expect(daily?.status).toBe("completed");
    expect(JSON.parse(daily!.payload)).toEqual({ scheduled: true });
    // 週次ジョブはバックグラウンドで「確認待ち」になる
    await expect.poll(async () => (await prisma.automationJob.findUnique({ where: { id: ids[1] } }))?.status, { timeout: 5000 }).toBe("awaiting_review");
  });
});
