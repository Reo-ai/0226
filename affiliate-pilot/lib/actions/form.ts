import { z } from "zod";

export type ActionState = { error?: string; ok?: string } | null;

/** FormData → オブジェクト（同名キーが複数あれば配列） */
export function formObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

export function firstIssue(e: z.ZodError): string {
  const i = e.issues[0];
  return i ? i.message : "入力内容を確認してください";
}

/** 空文字は null（未計測）、それ以外は 0 以上の整数 */
export const optInt = z.preprocess(
  (v) => (typeof v === "string" ? (v.replace(/[,，¥￥円\s]/g, "") === "" ? null : Number(v.replace(/[,，¥￥円\s]/g, ""))) : v),
  z.number({ error: "数値で入力してください" }).int("整数で入力してください").min(0, "0以上で入力してください").nullable(),
);

/** % 入力（0〜100）→ 0〜1。空は null */
export const optPercent = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v)) : v),
  z.number({ error: "数値で入力してください" }).min(0, "0〜100%で入力してください").max(100, "0〜100%で入力してください").nullable(),
).transform((v) => (v === null ? null : v / 100));

export const reqInt = (label: string, min = 0, max = 100_000_000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,，¥￥円\s]/g, "")) : v),
    z.number({ error: `${label}を入力してください` }).int(`${label}は整数で入力してください`).min(min, `${label}は${min}以上にしてください`).max(max, `${label}が大きすぎます`),
  );

export const toArray = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
