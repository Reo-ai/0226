import { prisma } from "./db";

/** バックアップ対象（依存関係の順。復元はこの順で入れ、逆順で消す） */
export const BACKUP_MODELS = [
  "profile", "goal", "roadmap", "affiliateNetwork", "affiliateOffer", "challenge", "channelAccount", "accountAssessment",
  "contentDraft", "publication", "task", "lesson", "lessonProgress", "quizAttempt", "performanceRecord", "trackingLink",
  "linkClick", "aIRecommendation", "automationJob", "automationLog", "sourceReference", "setting",
] as const;
type ModelName = (typeof BACKUP_MODELS)[number];

type Delegate = { findMany: () => Promise<unknown[]>; deleteMany: () => Promise<unknown>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
const delegate = (m: ModelName) => (prisma as unknown as Record<ModelName, Delegate>)[m];

export async function exportAll() {
  const data: Record<string, unknown[]> = {};
  for (const m of BACKUP_MODELS) data[m] = await delegate(m).findMany();
  return { app: "affiliate-pilot", version: 1, exportedAt: new Date().toISOString(), data };
}

export async function importAll(json: unknown): Promise<number> {
  const b = json as { app?: string; version?: number; data?: Record<string, unknown> };
  if (b?.app !== "affiliate-pilot" || b.version !== 1 || typeof b.data !== "object" || !b.data) throw new Error("Affiliate Pilot AI のバックアップファイルではありません");
  for (const m of BACKUP_MODELS) if (b.data[m] !== undefined && !Array.isArray(b.data[m])) throw new Error(`バックアップの形式が不正です（${m}）`);
  let n = 0;
  await prisma.$transaction(async (tx) => {
    const d = (m: ModelName) => (tx as unknown as Record<ModelName, Delegate>)[m];
    for (const m of [...BACKUP_MODELS].reverse()) await d(m).deleteMany();
    for (const m of BACKUP_MODELS) {
      const rows = (b.data![m] as unknown[] | undefined) ?? [];
      if (rows.length) await d(m).createMany({ data: rows });
      n += rows.length;
    }
  }, { timeout: 60_000 });
  return n;
}
