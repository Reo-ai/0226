# TikTok / Instagram Auto Pipeline
**自己啓発×アフィリエイト特化** — バズ動画分析 → AI画像/動画生成 → Instagramキャプション自動化

---

## テーマカテゴリ

| ID | テーマ | アフィリエイト商品例 |
|---|---|---|
| `fitness` | 💪 筋トレ・フィットネス | プロテイン、BCAA、トレーニング教材 |
| `sleep` | 😴 睡眠・回復 | 睡眠サプリ、スマートウォッチ、枕 |
| `money` | 💰 お金・資産形成 | 投資講座、副業教材、FXスクール |
| `supplements` | 💊 サプリ・栄養 | マルチビタミン、オメガ3、プロバイオティクス |
| `skills` | 📚 スキル・自己成長 | Udemy、英会話アプリ、資格教材 |

---

## セットアップ

```bash
cp .env.example .env   # APIキーを設定
npm install

# 外部依存（要インストール）
pip install yt-dlp     # TikTok動画ダウンロード
# ffmpeg もシステムにインストール必要
```

### 必要なAPIキー (.env)

```
GEMINI_API_KEY      # Google Gemini API（画像生成）
OPENAI_API_KEY      # OpenAI（GPT, Whisper, Sora）
KLING_ACCESS_KEY    # Kling AI
KLING_SECRET_KEY    # Kling AI
RUNWAY_API_KEY      # Runway ML
OPENAI_PROMPT_MODEL # デフォルト: gpt-4o
OPENAI_SORA_MODEL   # デフォルト: sora-2
```

---

## コマンド一覧

### 自己啓発コンテンツ向け（新機能）

```bash
# ── コンテンツ戦略プランニング ──────────────────────────────
npm start -- plan-content
  -w, --weeks <n>              # 何週間分のプランを作るか（デフォルト: 1）
  -t, --themes <themes>        # テーマ（カンマ区切り）例: fitness,money,sleep
  -a, --account <handle>       # Instagramハンドル名
  --affiliate-links <links>    # アフィリエイト商品リスト（カンマ区切り）

# 例: 2週間分の筋トレ×お金のコンテンツカレンダー作成
npm start -- plan-content -w 2 -t fitness,money -a my_account

# ── 動画コンセプト生成 ────────────────────────────────────────
npm start -- generate-concept <theme>
  --type <type>                # educational / hook / story / review
  --product <product>          # フィーチャーする商品名

# 例:
npm start -- generate-concept fitness --type hook --product "ホエイプロテイン"
npm start -- generate-concept money --type story

# ── Instagramキャプション生成 ────────────────────────────────
npm start -- generate-caption <theme>
  -c, --concept <text>         # 動画コンセプト説明
  --product <product>          # アフィリエイト商品
  --link <link>                # リンク説明
  --tone <tone>                # motivational / educational / story / review
  --account <handle>           # Instagramハンドル

# 例:
npm start -- generate-caption fitness -c "筋トレ3ヶ月変化" --product "プロテイン" --tone story

# ── 一発リール生成（コンセプト→画像→動画→キャプション） ────
npm start -- generate-reel <theme>
  --type <type>                # コンテンツタイプ
  --product <product>          # アフィリエイト商品
  --image-model <gemini|imagen>
  -s, --service <sora|kling|both>
  --skip-video                 # 画像のみ
  --duration <n>               # 動画の秒数（デフォルト: 30）
  --account <handle>

# 例:
npm start -- generate-reel fitness --type hook --product "BCAA" --service kling
npm start -- generate-reel money --type educational --skip-video
npm start -- generate-reel sleep --service both --duration 45
```

### TikTok分析・パイプライン（既存機能）

```bash
# バズ動画を深層分析（映像・音声・カット構成）
npm start -- deep-analyze <tiktok-url>

# 分析 → 画像 → 動画の一括パイプライン
npm start -- deep-pipeline <tiktok-url>
  -c, --count <n>              # バリエーション数
  --skip-video                 # 画像のみ
  --image-model <gemini|imagen>
  -s, --service <sora|kling|both>
  -t, --theme <theme>          # 自己啓発テーマ指定

# 生成動画の校閲・自己採点
npm start -- review <参考URL|パス> <生成動画パス...>

# TikTokトレンド分析
npm start -- analyze

# プロンプトファイルから一括画像生成
npm start -- generate-images-batch -f prompts.json
```

---

## 使い方フロー（アフィリエイト特化）

### パターンA: ゼロから作る

```bash
# 1. 1週間分のコンテンツカレンダー作成
npm start -- plan-content -w 1 -t fitness,sleep,money -a my_ig_account

# 2. 特定テーマでリール動画を一発生成
npm start -- generate-reel fitness --type hook --product "ホエイプロテイン" --service kling

# 3. キャプションを別途生成（詳細カスタマイズ）
npm start -- generate-caption fitness -c "筋トレ始めて変わった3つのこと" --product "プロテイン" --tone story
```

### パターンB: バズ動画を参考に作る

```bash
# 1. バズっているTikTok動画を分析
npm start -- deep-analyze https://www.tiktok.com/@xxx/video/xxx

# 2. 自己啓発テーマに変換してパイプライン実行
npm start -- deep-pipeline https://www.tiktok.com/@xxx/video/xxx -t fitness --service sora

# 3. 生成動画を校閲
npm start -- review https://www.tiktok.com/@xxx/video/xxx output/videos/video_xxx.mp4
```

---

## 出力ファイル

```
output/
  images/    — 生成された画像（9:16縦型）
  videos/    — 生成された動画（720x1280）
  reports/   — 分析レポート・キャプション・コンテンツカレンダー
```

---

## Instagramアカウント成長戦略

本ツールで推奨する投稿ルーティン：

| 曜日 | テーマ | 投稿時間 | コンテンツタイプ |
|---|---|---|---|
| 月 | 💪 筋トレ | 07:00 | 教育系（知識提供） |
| 火 | 💰 お金 | 12:00 | フック系（驚き・問い） |
| 水 | 😴 睡眠 | 21:00 | 教育系 |
| 木 | 💊 サプリ | 07:00 | レビュー系 |
| 金 | 📚 スキル | 19:00 | フック系 |
| 土 | 💪 筋トレ | 10:00 | チャレンジ系 |
| 日 | 💰 お金 | 20:00 | ストーリー系 |

**アフィリエイトリンクのCTA:** プロフィールのリンクツリーに各商品を設置し、キャプションでは「プロフリンクから」と案内。
