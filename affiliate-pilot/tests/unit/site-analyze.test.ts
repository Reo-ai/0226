import { describe, expect, it } from "vitest";
import { classify, detectAffiliateLinks, detectPlatform, extractFromHtml, extractedFromText, recommend } from "@/lib/site-analyze";

describe("site-analyze", () => {
  it("URLから媒体を判定する", () => {
    expect(detectPlatform("https://www.instagram.com/foo/")).toBe("instagram");
    expect(detectPlatform("https://x.com/foo")).toBe("x");
    expect(detectPlatform("https://twitter.com/foo")).toBe("x");
    expect(detectPlatform("https://www.youtube.com/@foo")).toBe("youtube");
    expect(detectPlatform("https://example.com/blog")).toBe("website");
    expect(detectPlatform("example.com")).toBe("unknown");
  });

  it("HTMLからタイトル・説明・見出し・本文を抜き出す", () => {
    const ex = extractFromHtml(`<html><head><title>宅トレ日記 &amp; 記録</title><meta name="description" content="自宅で筋トレ"><script>var x=1;</script></head><body><h1>今日のトレーニング</h1><p>プロテインを飲んでダイエット中。</p><a href="https://px.a8.net/svt/ejp?a8mat=1">リンク</a></body></html>`);
    expect(ex.title).toBe("宅トレ日記 & 記録");
    expect(ex.description).toBe("自宅で筋トレ");
    expect(ex.headings).toEqual(["今日のトレーニング"]);
    expect(ex.body).toContain("プロテイン");
    expect(ex.body).not.toContain("var x");
    expect(detectAffiliateLinks(ex.links)).toEqual(["A8.net"]);
  });

  it("フィットネス系の内容はフィットネスが1位になる", () => {
    const g = classify({ title: "宅トレで10kg痩せた記録", description: "筋トレとプロテインの話", body: "ダイエット 筋トレ ジム プロテイン 体脂肪 ".repeat(5) });
    expect(g[0].id).toBe("fitness");
    expect(g[0].share).toBeGreaterThan(0.4);
  });

  it("転職系の内容は転職が1位になり、確からしさが付く", () => {
    const text = "30代未経験から転職。転職エージェントに登録して面接対策をした記録。職務経歴書の書き方や、年収交渉の流れをまとめています。".repeat(8);
    const r = recommend(extractedFromText(text, "転職ブログ"), "website", [{ id: "o1", name: "転職エージェント無料相談", category: "転職" }, { id: "o2", name: "ドッグフード定期", category: "ペット" }]);
    expect(r.genres[0].id).toBe("career");
    expect(["high", "medium"]).toContain(r.confidence);
    expect(r.picks[0].asps.length).toBeGreaterThan(0);
    expect(r.matchedOffers.map((o) => o.id)).toEqual(["o1"]);
  });

  it("文章が少ないと確からしさは低く、注意書きが出る", () => {
    const r = recommend(extractedFromText("コスメ"), "instagram");
    expect(r.confidence).toBe("low");
    expect(r.notes.length).toBeGreaterThan(0);
  });
});
