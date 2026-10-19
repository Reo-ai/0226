import type { z } from "zod";
import { AIError } from "./types";

/** モデル出力から JSON を取り出して Zod で検証する */
export function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new AIError("AIの出力にJSONが含まれていませんでした");
  let value: unknown;
  try {
    value = JSON.parse(cleaned.slice(start));
  } catch {
    // 末尾に余計な文章がついている場合に備えて、最後の閉じ括弧までで再試行
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    try {
      value = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new AIError("AIの出力をJSONとして読めませんでした");
    }
  }
  const r = schema.safeParse(value);
  if (!r.success) throw new AIError(`AIの出力が期待した形式と違いました（${r.error.issues[0]?.path.join(".") || "全体"}）`);
  return r.data;
}
