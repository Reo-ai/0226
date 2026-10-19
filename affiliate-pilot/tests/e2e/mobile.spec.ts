import { expect, test } from "@playwright/test";

test("スマホ：下部ナビとメニューで各画面を開ける", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今日やること" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "下部メニュー" });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("complementary")).toBeHidden(); // サイドバーは隠れる
  await nav.getByRole("link", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "AIコンテンツ工房" })).toBeVisible();
  await nav.getByRole("button", { name: "メニュー" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "学ぶ" }).click();
  await expect(page.getByRole("heading", { name: "アフィリエイト攻略大学" })).toBeVisible();
  // 横スクロールが出ない
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("スマホ：収益分析と初月5万円チャレンジが表示できる", async ({ page }) => {
  for (const [path, heading] of [["/analytics", "収益分析センター"], ["/challenge", "初月5万円チャレンジ"], ["/offers/compare", "案件比較"], ["/settings", "設定"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} で横スクロール`).toBeLessThanOrEqual(1);
  }
});
