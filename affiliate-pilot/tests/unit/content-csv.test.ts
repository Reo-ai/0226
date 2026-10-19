import { describe, expect, it } from "vitest";
import { isAllowedOllamaUrl } from "@/lib/ai/ollama";
import { parseStructured } from "@/lib/ai/json";
import { hasAdDisclosure, lintContent, templateFor } from "@/lib/content";
import { csvObjects, parseCsv, safeCell, toCsv } from "@/lib/csv";
import { dedupeKey } from "@/lib/records";
import { contentInputsSchema } from "@/lib/schemas";
import { z } from "zod";

describe("コンテンツの公開前チェック", () => {
  it("PR表記を検出", () => {
    expect(hasAdDisclosure("【PR】この投稿には広告を含みます")).toBe(true);
    expect(hasAdDisclosure("おすすめです #PR")).toBe(true);
    expect(hasAdDisclosure("おすすめです")).toBe(false);
  });
  it("誇大・効能断定の表現を指摘", () => {
    const r = lintContent("これを飲めば必ず痩せる！業界No.1");
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
  });
  it("テンプレートは全種類でPR表記入り・事実を書かない", () => {
    for (const t of ["blog_outline", "blog_draft", "comparison_outline", "instagram_post", "instagram_reel", "x_post", "tiktok_script", "youtube_script", "youtube_description", "cta"] as const) {
      const g = templateFor(t, contentInputsSchema.parse({ product: "テスト商品" }));
      expect(hasAdDisclosure(g.body)).toBe(true);
      expect(g.factCheckItems.length).toBeGreaterThan(0);
    }
  });
});

describe("CSV", () => {
  it("クォート・カンマ・改行・BOMを読める", () => {
    expect(parseCsv('﻿a,b\n"x,1","y""z"\n')).toEqual([["a", "b"], ["x,1", 'y"z']]);
  });
  it("タブ区切り（Excelからのコピー）も読める", () => {
    expect(parseCsv("日付\t報酬\n2026/10/01\t1500")).toEqual([["日付", "報酬"], ["2026/10/01", "1500"]]);
  });
  it("見出しの別名で列を対応づける", () => {
    const { rows, unknownHeaders } = csvObjects("案件名,報酬額,謎\nA,100,x", { name: ["案件名"], commission: ["報酬単価", "報酬額"] });
    expect(rows).toEqual([{ name: "A", commission: "100" }]);
    expect(unknownHeaders).toEqual(["謎"]);
  });
  it("数式インジェクションを無害化する", () => {
    expect(safeCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(safeCell("+1")).toBe("'+1");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell(-5)).toBe("-5");
    expect(safeCell(null)).toBe("");
    expect(toCsv(["a"], [["=1"]])).toContain("'=1");
  });
});

describe("その他", () => {
  it("二重集計防止キー", () => {
    const d = new Date("2026-10-18T15:00:00Z"); // JST 10/19
    expect(dedupeKey({ recordDate: d, platform: "x", affiliateOfferId: "o1" })).toBe("2026-10-19|x|-|o1|-");
  });
  it("ローカルAIの通信先はローカル・LANのみ", () => {
    expect(isAllowedOllamaUrl("http://127.0.0.1:11434")).toBe(true);
    expect(isAllowedOllamaUrl("http://192.168.1.5:11434")).toBe(true);
    expect(isAllowedOllamaUrl("https://example.com")).toBe(false);
    expect(isAllowedOllamaUrl("file:///etc/passwd")).toBe(false);
  });
  it("AI出力を Zod で検証する", () => {
    const s = z.object({ a: z.number() });
    expect(parseStructured('```json\n{"a":1}\n```', s)).toEqual({ a: 1 });
    expect(() => parseStructured('{"a":"x"}', s)).toThrow();
    expect(() => parseStructured("JSONなし", s)).toThrow();
  });
});
