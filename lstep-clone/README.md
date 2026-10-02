# スキルステップ（公式LINE配信ツール・0円運用）

LINE公式アカウント向けのセルフホスト型マーケティングツール。
Lステップの主要機能＋有料プラン相当の機能を、**月額0円**で運用できるように設計しています。

## 0円で使えるしくみ

| コスト | どう0円にしているか |
|---|---|
| ツール利用料 | 自前で動かすので月額なし |
| サーバー | Oracle Cloud Always Free（永久無料VM）＋ sslip.io で独自ドメインなしの無料HTTPS。代替: Vercel Hobby＋Turso無料枠＋GitHub Actions |
| LINEの配信通数（無料プランは月200通） | 相手からの反応（友だち追加・メッセージ・ボタン）に返す「応答メッセージ」は**何通でも無料**。この仕組みを最大限使う配信エンジン（下記） |
| AI自動応答 | ここだけ従量課金（Claude API）。**OFFなら0円**。月間上限・最安モデル選択・プロンプトキャッシュでコストを抑制 |

### 無料通数を節約する配信エンジン

- **友だち追加のあいさつ・即時ステップ・キーワード応答・タグ起点の即時ステップ**は、すべて1回の応答メッセージにまとめて無料で返す
- **「反応時に無料で届ける」配信**: 一斉配信・ステップ配信・個別メッセージで選べる。相手が次にメッセージやボタン操作をした時に応答として届く（14日以内）
- **吹き出しの結合**: 「---」で区切った最大5つの吹き出し（画像含む）を1通として送る
- **月間上限ガード**: プッシュ上限（初期値200通）を超える配信はブロック。ステップ配信は上限に達すると自動で「反応時に無料」に切り替わる
- **リッチメニュー**のボタンは押されると応答扱いになるので、「メニューを押したら情報が届く」設計にすると0通で情報提供できる
- ダッシュボードで今月の消費通数（アプリ集計＋LINE公式集計）と、無料で届けた数を確認できる

## 機能一覧

| 機能 | 内容 |
|---|---|
| 友だち管理 | 自動登録、プロフィール、メモ、ブロック検知、トーク履歴、個別送信、CSVエクスポート |
| タグ | 手動／キーワード応答／リンククリック／フォーム回答／流入経路／リッチメニューのボタンで自動付与 |
| 一斉配信 | 全員 or タグ絞り込み、即時・予約、プッシュ or 反応時無料、`{{name}}` 差し込み、画像 |
| ステップ配信 | 友だち追加時・タグ付与時・手動で開始、「開始から◯日◯時間◯分後」または「◯日後の20:00」（時刻指定）、ステップごとにプッシュ／反応待ちを選択、ブロックや**停止タグ**（例: 購入済み）で停止 |
| キーワード自動応答 | 完全一致/部分一致、タグ付与、反応数 |
| AI自動応答 | キーワード不一致のメッセージにClaudeが会話履歴＋ナレッジで返信。友だち単位でON/OFF |
| リッチメニュー | 画像アップロード＋8種のレイアウト、ボタンごとにテキスト送信/URL/タグ付与/フォーム案内、**タグ別の自動切替**、デフォルト設定 |
| 回答フォーム | 簡易記法で項目作成、`{{form:ID}}` で回答者を特定、回答時タグ付与、CSV |
| 流入経路分析 | 経路ごとのURL/QR、訪問数・友だち数・ブロック数、追加時タグ付与（LIFF設定で個人まで特定） |
| クリック計測 | `{{link:CODE}}` で友だちごとの計測URL、クリック時タグ付与 |
| 分析 | 友だち推移、ブロック率、配信ごとの到達・クリック率・24hブロック、シナリオ離脱率、経路別成果、AIコスト |

### 本文の書き方

```
{{name}}さん、こんにちは！
---
image:https://example.com/banner.jpg
---
詳細はこちら → {{link:lp}}
アンケート → {{form:1}}
```

## 導線テンプレートの一括投入

タグ・シナリオ・キーワード応答・フォーム・計測リンク・流入経路を1ファイルで定義し、まとめて投入できます。

```bash
node scripts/seed-funnel.mjs funnels/claude-code-course/funnel.mjs --dry-run   # チェックのみ
node scripts/seed-funnel.mjs funnels/claude-code-course/funnel.mjs             # 投入
```

例: [Claude Code 講座の販売導線](funnels/claude-code-course/README.md)

## セットアップ

### 1. LINE側（無料）

1. [LINE Developers](https://developers.line.biz/) でプロバイダーと **Messaging API チャネル** を作成
2. チャネルシークレット・チャネルアクセストークン（長期）を控える
3. LINE Official Account Manager の「応答設定」で **応答メッセージをOFF・Webhookを ON**（本アプリが応答するため）
4. 友だち追加URL（`https://line.me/R/ti/p/@xxxx`）を控える

### 2. サーバー（Oracle Cloud Always Free・おすすめ）

1. [Oracle Cloud](https://www.oracle.com/cloud/free/) に登録し、Always Free の VM（Ubuntu、Ampere A1 推奨）を作成
2. VCNのセキュリティリストで TCP 80, 443 の受信を許可
3. VMにSSHして、コードを取得してセットアップを実行:
   ```bash
   sudo apt-get update && sudo apt-get install -y git
   git clone -b <ブランチ> https://github.com/<you>/<repo>.git app
   cd app/lstep-clone        # リポジトリ直下にアプリがある場合は cd app
   bash deploy/setup-vm.sh
   ```
   非公開リポジトリの場合、clone 時のパスワードには GitHub の Personal Access Token（読み取り権限のみ）を入力します。
   スクリプトが管理パスワードとLINEの値を質問してくるので答えると、Docker導入・ポート開放・HTTPS化・起動まで自動で行います。
4. 表示された `https://xx-xx-xx-xx.sslip.io/api/line/webhook` を LINE Developers の Webhook URL に設定して「検証」

更新するときは `git pull && bash deploy/setup-vm.sh` を実行します。ステップ配信・予約配信はアプリ内蔵のタイマーで毎分処理され、データはDockerボリュームに保存されます。

### 2'. サーバー（代替: Vercel + Turso）

個人利用（非商用）なら Vercel Hobby でも動きます（Vercel Hobby は商用利用不可なのでお店・事業の運用には Oracle を推奨）。

1. [Turso](https://turso.tech/) で無料DBを作成し、`DATABASE_URL=libsql://...` と `DATABASE_AUTH_TOKEN` を取得
2. Vercel にリポジトリをインポートし、`.env.example` の値と `DISABLE_INTERNAL_CRON=1` を環境変数に設定
3. GitHub リポジトリの Actions シークレットに `APP_URL` と `CRON_SECRET` を登録（`.github/workflows/cron.yml` が5分ごとに `/api/cron` を実行）
   - 注意: GitHub は60日間更新がないリポジトリの定期実行を止めます。止まったら Actions 画面から再有効化してください

### 3. 流入経路で「誰がどこから来たか」まで計測する（任意・無料）

1. 同じプロバイダーに **LINEログインチャネル** を作成し、チャネルIDを `LINE_LOGIN_CHANNEL_ID` に設定
2. そのチャネルに **LIFFアプリ** を追加（サイズ Full、エンドポイントURL `https://<あなたのドメイン>/join`、スコープ `openid` `profile`）。LIFF ID を `LIFF_ID` に設定
3. `LINE_ADD_FRIEND_URL` を設定。流入経路画面のURL/QR（`https://liff.line.me/<LIFF_ID>/<コード>`）を各媒体に掲載

LIFF未設定でも訪問数は計測できます。

### 4. AI自動応答（任意・従量課金）

1. [Anthropic Console](https://console.anthropic.com/) で APIキーを発行し `ANTHROPIC_API_KEY` に設定（Console側で月の支払い上限も設定しておくと安心）
2. 管理画面「設定・AI」でONにし、モデル・月間上限・ナレッジ（営業時間・料金・FAQ）を入力

## ローカル開発

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSWORD / SESSION_SECRET を設定
npm run dev                  # http://localhost:3000
npm run build && npm run smoke   # 配信ロジックのスモークテスト
```

`LINE_CHANNEL_ACCESS_TOKEN` 未設定時は送信内容をログに出すだけのドライランになります。

## 構成

- Next.js (App Router, Server Actions) / TypeScript
- libSQL（ローカルSQLiteファイル or Turso）
- LINE Messaging API / LINEログイン(LIFF)（fetchで直接呼び出し）
- Claude API（`@anthropic-ai/sdk`）

```
app/(admin)/          管理画面
app/api/line/webhook  LINE Webhook
app/api/cron          定期ジョブ（予約配信・ステップ配信）
app/r/[code]          クリック計測リダイレクト
app/f/[id]            公開フォーム
app/join/[code]       流入経路の入口（LIFF）
lib/delivery.ts       無料応答を優先する配信エンジン
lib/                  DB・LINE・シナリオ・AIなど
deploy/               Docker Compose + Caddy（無料HTTPS）+ VMセットアップ
scripts/smoke.mjs     スモークテスト
```
