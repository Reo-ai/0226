import { z } from "zod";
import { PLATFORM_IDS } from "./constants";

/** DB の JSON 文字列列を Zod で検証して読む。壊れていれば fallback */
export function parseJson<T>(schema: z.ZodType<T>, raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const r = schema.safeParse(JSON.parse(raw));
    return r.success ? r.data : fallback;
  } catch {
    return fallback;
  }
}

export const platformSchema = z.enum(PLATFORM_IDS);
export const platformsSchema = z.array(platformSchema);
export const stringListSchema = z.array(z.string());
export const numberListSchema = z.array(z.number().int().nonnegative());

export const evidenceSchema = z.object({
  facts: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const roadmapPlanSchema = z.object({
  phases: z.array(
    z.object({
      no: z.number().int(),
      title: z.string(),
      startDay: z.number().int(),
      endDay: z.number().int(),
      goal: z.string(),
      milestones: z.array(z.object({ key: z.string(), title: z.string(), href: z.string().default("") })),
    }),
  ),
});
export type RoadmapPlan = z.infer<typeof roadmapPlanSchema>;

export const contentChecksSchema = z.object({
  adDisclosure: z.boolean().default(false),
  facts: z.array(z.object({ item: z.string(), checked: z.boolean().default(false) })).default([]),
  userReviewed: z.boolean().default(false),
});
export type ContentChecks = z.infer<typeof contentChecksSchema>;

export const contentInputsSchema = z.object({
  genre: z.string().default(""),
  product: z.string().default(""),
  target: z.string().default(""),
  keywords: z.string().default(""),
  appeal: z.string().default(""),
  tone: z.string().default(""),
  length: z.number().int().nullable().default(null),
  evidence: z.string().default(""),
});
export type ContentInputs = z.infer<typeof contentInputsSchema>;

export const sourceRefSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  verifiedAt: z.string().nullable().default(null), // YYYY-MM-DD
  status: z.enum(["verified", "unverified", "outdated"]).default("unverified"),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

/** 外部URLの検証（http/https のみ） */
export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "http(s):// で始まるURLを入力してください");

export const optionalHttpUrl = z.union([z.literal(""), httpUrl]);
