# アフィリエイト攻略

案件えらび → 投稿づくり → クリック計測 → 成果分析 を1つにまとめた、アフィリエイター向けの管理アプリ（Next.js）。

## 機能

| 画面 | 内容 |
|---|---|
| ダッシュボード | 今月のクリック・成果・確定報酬・承認率・EPC、30日のクリック推移、案件／媒体／リンク別の実績、「次にやること」 |
| 攻略ガイド | 初心者向け13ステップ（ジャンル選び → ASP登録 → 規制確認 → 案件比較 → 発信 → 計測 → 特単交渉）。データから自動でチェック |
| 案件リサーチ | 案件を登録すると **想定EPC = 報酬 × CVR × 承認率** でランキング。実績が貯まるほど実績値に寄せて再評価。AIが登録案件と実績から「集中すべき案件・止める案件・切り口・今週やること」を提案 |
| AI投稿生成 | 案件×媒体（TikTok / Instagram / X / YouTubeショート / ブログ / LINE）×型（レビュー・比較・ハウツー等）で台本・キャプションを生成。**PR表記・薬機法・誇大表現NG** をプロンプトで強制。計測リンクを自動で差し込み |
| 計測リンク | `/go/コード?ch=tiktok` 形式のリダイレクトでクリックを媒体別に記録（SNSのリンクプレビュー用クローラーは除外） |
| 成果 | 手入力、またはASP管理画面の表をCSV/Excelから貼り付けて一括取込（「承認/確定」「否認/キャンセル」を自動判定） |
| 動画にする | 生成した台本を、リポジトリ直下のTikTok/Instagramパイプラインに渡して画像→動画を自動生成（下記） |
| 設定 | AIモデル・月間利用上限・発信者プロフィール（AI生成に反映） |

## ローカルで動かす

```bash
cd affiliate-hub
cp .env.example .env.local   # 下の環境変数を設定
npm install
npm run dev                     # http://localhost:3000
```

| 環境変数 | 必須 | 内容 |
|---|---|---|
| `ADMIN_PASSWORD` | ○ | 管理画面のパスワード |
| `SESSION_SECRET` | ○ | ランダムな文字列（`openssl rand -hex 32`） |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Vercelでは○ | Turso（無料枠）の接続先。未設定ならローカルの `data/app.db` |
| `ANTHROPIC_API_KEY` | | AIリサーチ・投稿生成に使用。なくてもAI以外は動く |
| `BASE_URL` | | 計測リンクの公開URL。未設定ならVercelの本番URL |
| `PIPELINE_TOKEN` | 動画連携するなら○ | 動画パイプライン連携用の合言葉（`openssl rand -hex 32`） |

## 動画パイプライン連携

動画生成は時間がかかり ffmpeg も必要なため、Vercelではなく **手元のPC** で動かします。PC側がアプリに「待ちジョブ」を取りに来る方式なので、PCを公開する必要はありません。

```
[affiliate-hub] 投稿を「生成待ちに入れる」
      ↓  GET /api/pipeline（PCから5分ごと）
[PC] npm start -- hub-sync  → コンセプト → 画像 → 動画（Kling/Sora）
      ↓  POST /api/pipeline
[affiliate-hub] 「完了」＋動画ファイルのパスを表示
```

1. affiliate-hub に `PIPELINE_TOKEN` を設定
2. リポジトリ直下の `.env` に `HUB_URL`（アプリのURL）と `HUB_TOKEN`（同じ値）を設定
3. PCで `npm start -- hub-sync --loop 5`（1回だけなら `--loop` なし）

動画ファイルはPCの `output/videos/` に保存されます。3時間以上「生成中」のまま止まったジョブは自動で取り直します。

## Vercel にデプロイ

リポジトリ直下の `vercel.json` は `lstep-clone` 用なので、Vercelで **新しいプロジェクト** を作り、Root Directory を `affiliate-hub` にしてください。DBは Turso を使います（Vercelのファイルは消えるため）。

## テスト

```bash
npm run typecheck
npm run build && npm run smoke
```
