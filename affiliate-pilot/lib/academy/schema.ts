import { z } from "zod";

/** アプリ内のリンク先（講座から「実践」へ飛ぶボタン） */
export const APP_LINKS = [
  "/", "/coach", "/roadmap", "/challenge", "/accounts", "/accounts/assessment", "/academy", "/offers", "/offers/compare",
  "/content", "/automation", "/analytics", "/settings",
] as const;

const appHref = z.string().refine((h) => (APP_LINKS as readonly string[]).includes(h.split("?")[0]) || /^\/academy\/[a-z]+(\/[a-z]+-\d{2})?$/.test(h), "アプリ内の既存パスを指定してください");

/** 本文は安全に描画するため HTML ではなくブロックで持つ。**太字** のみ使用可 */
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("h"), text: z.string().min(1) }),
  z.object({ type: z.literal("p"), text: z.string().min(1) }),
  z.object({ type: z.literal("ul"), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("ol"), items: z.array(z.string().min(1)).min(1) }),
]);

export const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  /** 確認日（YYYY-MM-DD）。確認していなければ null */
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(["verified", "unverified", "outdated"]),
});

export const quizSchema = z.object({
  question: z.string().min(5),
  choices: z.array(z.string().min(1)).min(3).max(5),
  answer: z.number().int().min(0),
  explanation: z.string().min(10),
}).refine((q) => q.answer < q.choices.length, "answer は choices の添字");

export const lessonSchema = z.object({
  id: z.string().regex(/^[a-z]+-\d{2}$/),
  title: z.string().min(3).max(60),
  estimatedMinutes: z.number().int().min(5).max(60),
  objectives: z.array(z.string().min(5)).min(2).max(5),
  body: z.array(blockSchema).min(6),
  examples: z.array(z.string().min(20)).min(1).max(4),
  cautions: z.array(z.string().min(10)).min(1).max(5),
  glossary: z.array(z.object({ term: z.string().min(1), definition: z.string().min(10) })).min(2).max(8),
  checklist: z.array(z.string().min(5)).min(3).max(8),
  quiz: z.array(quizSchema).min(3).max(5),
  assignment: z.object({ title: z.string().min(5), steps: z.array(z.string().min(5)).min(2).max(6) }),
  actions: z.array(z.object({ label: z.string().min(2), href: appHref })).min(1).max(3),
  sources: z.array(sourceSchema).max(6),
});

export const courseSchema = z.object({
  id: z.enum(["asp", "seo", "instagram", "x", "video", "sales", "ai", "analytics"]),
  no: z.number().int().min(1).max(8),
  title: z.string(),
  summary: z.string().min(20),
  level: z.enum(["初級", "中級", "上級"]),
  objectives: z.array(z.string()).min(3).max(6),
  completion: z.string().min(10),
  tools: z.array(z.object({ label: z.string(), href: appHref })).min(1).max(4),
  lessons: z.array(lessonSchema).min(5),
});

export type Block = z.infer<typeof blockSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Source = z.infer<typeof sourceSchema>;
