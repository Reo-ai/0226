import { expect, test } from "@playwright/test";
import asp from "../../content/academy/asp";

test.describe.configure({ mode: "serial" });

test("1-3. アプリを開き、初期設定を完了してダッシュボードを表示", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("アフィリエイト経験").selectOption("none");
  await page.getByLabel("1日の作業可能時間（分）").selectOption("90");
  await page.getByLabel("ジャンル").fill("筋トレ");
  await page.getByText("すでに運用中のブログ・SNSアカウントがある").click();
  await page.getByRole("button", { name: "ロードマップを作って始める" }).click();
  await expect(page.getByRole("heading", { name: "今日やること" })).toBeVisible();
  await expect(page.getByText("90日ロードマップ").first()).toBeVisible();
});

test("4-5. アカウントを登録して戦闘力診断を実行", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByLabel("アカウント名・ブログ名").fill("筋トレ記録");
  await page.getByLabel("直近30日の表示回数・閲覧数").fill("60000");
  await page.getByLabel("直近30日の投稿数").fill("12");
  await page.getByLabel("直近30日の反応数").fill("2400");
  await page.getByLabel("直近30日のリンククリック数").fill("300");
  await page.getByLabel("直近30日の成約数（発生）").fill("3");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "筋トレ記録" })).toBeVisible();
  await page.getByRole("link", { name: "診断する" }).click();
  await page.getByRole("button", { name: "診断する" }).click();
  await expect(page.getByText("優先すべき改善 3つ")).toBeVisible();
  await expect(page.getByText("データの信頼度")).toBeVisible();
});

test("7. 案件を登録する", async ({ page }) => {
  await page.goto("/offers");
  await page.getByLabel("案件名").fill("E2Eテスト案件");
  await page.getByLabel("ジャンル", { exact: true }).last().fill("筋トレ");
  await page.getByLabel("報酬単価（円・定額のとき）").fill("3000");
  await page.getByLabel("承認率（%）").fill("80");
  await page.getByLabel("提携状態").last().selectOption("approved");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "E2Eテスト案件" })).toBeVisible();
  await page.getByRole("button", { name: "適合性を評価" }).first().click();
  await expect(page.getByText(/適合 \d+点/)).toBeVisible();
});

test("6. 初月5万円チャレンジを開始する", async ({ page }) => {
  await page.goto("/challenge");
  await page.getByLabel("直近30日の表示回数").fill("60000");
  await page.getByLabel("直近30日のリンククリック数").fill("300");
  await page.getByLabel("直近30日の成約実績（件）").fill("3");
  await page.getByLabel("紹介予定の案件").selectOption({ label: "E2Eテスト案件" });
  await page.getByRole("button", { name: "診断してチャレンジを始める" }).click();
  await expect(page.getByText("必要数（計算）と実績")).toBeVisible();
  await expect(page.getByText("30日間の行動計画")).toBeVisible();
  // CTR 0.5%・CVR 1%・承認率80%・報酬3000円 → 必要承認17件・発生22件・クリック2200回
  await expect(page.getByRole("cell", { name: "2,200" })).toBeVisible();
});

test("8. コンテンツを作成し、チェックして保存・公開記録する", async ({ page }) => {
  await page.goto("/content");
  await page.getByLabel("作るもの").selectOption("x_post");
  await page.getByLabel("紹介する案件").selectOption({ label: "E2Eテスト案件" });
  await page.getByLabel("ターゲット").fill("在宅勤務の30代");
  await page.getByRole("button", { name: "下書きを作る" }).click();
  await expect(page.getByLabel("本文", { exact: true })).toContainText("PR");
  await expect(page.getByText("AIに接続していないため、穴埋めテンプレートで作りました")).toBeVisible();
  // 未チェックのままでは公開OKにできない
  await page.getByLabel("状態", { exact: true }).selectOption("approved");
  await page.getByRole("button", { name: "状態を変更" }).click();
  await expect(page.getByText(/公開OKにできません/)).toBeVisible();
  const unchecked = page.getByRole("checkbox", { checked: false });
  for (let n = await unchecked.count(); n > 0; n--) {
    await unchecked.first().click();
    await expect(unchecked).toHaveCount(n - 1);
  }
  await expect(page.getByRole("checkbox", { checked: false })).toHaveCount(0);
  await page.getByLabel("状態", { exact: true }).selectOption("approved");
  await page.getByRole("button", { name: "状態を変更" }).click();
  await expect(page.getByText("公開OK").first()).toBeVisible();
  await page.getByLabel("公開URL").fill("https://example.com/post/1");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByRole("link", { name: "https://example.com/post/1" })).toBeVisible();
});

test("9. 攻略大学のレッスンを受講して完了する", async ({ page }) => {
  const lesson = asp.lessons[0];
  await page.goto(`/academy/asp/${lesson.id}`);
  await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
  for (const [i, q] of lesson.quiz.entries()) {
    await page.getByRole("group", { name: `Q${i + 1}. ${q.question}` }).getByLabel(q.choices[q.answer], { exact: true }).check();
  }
  await page.getByRole("button", { name: "採点する" }).click();
  await expect(page.getByText("正答率 100%")).toBeVisible();
  await page.getByRole("button", { name: "レッスンを完了にする" }).click();
  await expect(page.getByText("このレッスンは完了しています")).toBeVisible();
  await page.goto("/academy");
  await expect(page.getByText(/^1 \/ \d+ レッスン$/).first()).toBeVisible();
});

test("10. タスクを完了する", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("button", { name: /を完了にする$/ }).first();
  const label = await first.getAttribute("aria-label");
  await first.click();
  await expect(page.getByRole("button", { name: label!.replace("を完了にする", "を未完了に戻す") })).toBeVisible();
});

test("11-12. 収益を記録し、グラフと改善提案を確認する", async ({ page }) => {
  await page.goto("/analytics");
  await page.getByLabel("媒体", { exact: true }).selectOption("instagram");
  await page.getByLabel("案件", { exact: true }).selectOption({ label: "E2Eテスト案件" });
  await page.getByLabel("表示回数").fill("2000");
  await page.getByLabel("クリック数").fill("40");
  await page.getByLabel("発生成約数").fill("1");
  await page.getByLabel("発生報酬").fill("3000");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: /報酬の推移/ }).first()).toBeVisible();
  await expect(page.getByText("2.00%").first()).toBeVisible(); // CTR = 40 / 2000
  await expect(page.getByText("未計測").first()).toBeVisible(); // 確定報酬は未入力

  await page.goto("/automation");
  await page.getByRole("button", { name: "実行する" }).nth(2).click(); // 改善案生成
  await expect(page.getByText(/を開始しました/)).toBeVisible();
  // バックグラウンドで終わると自動で画面が更新され、確認待ちになる
  await expect(page.getByRole("button", { name: "承認して反映" }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "承認して反映" }).first().click();
  await expect(page.getByRole("heading", { name: "改善提案" }).locator("..").locator("..").getByRole("button", { name: "対応した" }).first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("次のアクション提案")).toBeVisible();
});

test("収益データをCSVエクスポートできる", async ({ request }) => {
  const res = await request.get("/api/analytics/export");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain("日付,媒体");
});

test("ASP一覧と攻略ページ、最終確認日の記録", async ({ page }) => {
  await page.goto("/offers/asp");
  for (const name of ["A8.net", "もしもアフィリエイト", "afb（アフィb）", "バリューコマース", "Amazonアソシエイト", "楽天アフィリエイト", "アクセストレード"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "A8.net", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A8.net 攻略" })).toBeVisible();
  await expect(page.getByText("最終確認日：未確認")).toBeVisible();
  await page.getByRole("button", { name: "今日、公式サイトで確認した" }).click();
  await expect(page.getByText("最終確認日：未確認")).toBeHidden();
  await expect(page.getByRole("link", { name: /A8\.net攻略 →/ })).toBeVisible();
});

test("案件をCSVエクスポートできる", async ({ request }) => {
  const res = await request.get("/api/offers/export");
  const text = await res.text();
  expect(text).toContain("ASP名,案件名");
  expect(text).toContain("E2Eテスト案件");
});

test("自動化ジョブの再実行と実行履歴", async ({ page }) => {
  await page.goto("/automation");
  await page.getByRole("button", { name: "実行する" }).first().click(); // 日次タスク生成
  await expect(page.getByText("「日次タスク生成」が完了しました")).toBeVisible();
  const jobs = page.locator("details");
  const before = await jobs.count();
  await jobs.first().locator("summary").click(); // 最新のジョブを開く
  await expect(jobs.first()).toContainText("日次タスク生成");
  await expect(jobs.first()).toContainText("開始");
  await jobs.first().getByRole("button", { name: "再実行" }).click();
  await expect(jobs).toHaveCount(before + 1);
});

test("サンプルデータは「サンプル」と表示され、削除できる", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "サンプルデータを入れる" }).click();
  await expect(page.getByRole("note")).toContainText("サンプルデータを表示中");
  await page.goto("/offers");
  await expect(page.getByText("サンプル", { exact: true }).first()).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "サンプルデータを削除" }).click();
  await expect(page.getByRole("note")).toBeHidden();
});

test("目標月収を変更できる", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: "目標と条件を設定し直す" }).click();
  await page.getByLabel("目標月収（確定報酬・円）").fill("80000");
  await page.getByRole("button", { name: "ロードマップを作って始める" }).click();
  await expect(page.getByText("目標 ¥80,000").first()).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("¥80,000")).toBeVisible();
});

test("下書きを編集して保存し、コピーできる", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/content");
  await page.getByRole("link", { name: /E2Eテスト案件/ }).first().click();
  const body = page.getByLabel("本文", { exact: true });
  await body.fill("【PR】編集した本文です。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(/保存しました/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("本文", { exact: true })).toHaveValue("【PR】編集した本文です。");
  await page.getByRole("button", { name: "本文をコピー" }).click();
  await expect(page.getByText("コピーしました")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("【PR】編集した本文です。");
});

test("定期実行の設定を保存できる", async ({ page }) => {
  await page.goto("/settings");
  const card = page.locator("#schedule");
  await card.getByLabel("毎日の実行時刻").fill("06:30");
  await card.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(/定期実行の設定を保存しました/)).toBeVisible();
  await page.reload();
  await expect(page.locator("#schedule").getByLabel("毎日の実行時刻")).toHaveValue("06:30");
});

test("キーボード操作とヘルプ：g→a で収益分析へ、? でヘルプ", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/\/analytics/);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "使い方" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("エディタ：文字数とPR表記をその場で表示し、プレビューできる", async ({ page }) => {
  await page.goto("/content");
  await page.getByRole("link", { name: /E2Eテスト案件/ }).first().click();
  const body = page.getByLabel("本文", { exact: true });
  await body.fill("必ず痩せる！最高の商品");
  await expect(page.getByText("PR表記なし")).toBeVisible();
  await expect(page.getByText(/注意表現 \d+件/)).toBeVisible();
  await body.fill("【PR】**太字**のテスト");
  await expect(page.getByText("PR表記あり")).toBeVisible();
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(page.getByLabel("プレビュー").locator("strong", { hasText: "太字" })).toBeVisible();
});

test("レッスンに目次があり、見出しへ移動できる", async ({ page }) => {
  await page.goto("/academy/asp/asp-01");
  const toc = page.getByRole("navigation", { name: "目次" });
  await expect(toc).toContainText("読了目安");
  const first = toc.getByRole("link").first();
  const text = await first.textContent();
  await first.click();
  await expect(page.locator("h3", { hasText: text! })).toBeInViewport();
});
