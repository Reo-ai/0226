# LINE配信管理（Lステップ風・自分専用）

LINE公式アカウント向けのセルフホスト型マーケティングツール。
Lステップの主要機能を **月額無料** で自前運用でき、**AI自動応答** と **分析ダッシュボード** を強化しています。

## 機能

| 機能 | 内容 |
|---|---|
| 友だち管理 | Webhookで自動登録、プロフィール取得、メモ、ブロック検知、トーク履歴、個別送信 |
| タグ | 手動付与 / キーワード応答で付与 / リンククリックで付与 / ポストバック `tag=ID` で付与 |
| 一斉配信 | 全員 or タグ絞り込み、即時・予約配信、`{{name}}` 差し込み |
| ステップ配信 | 友だち追加時・タグ付与時・手動で開始、「開始から◯日◯時間◯分後」に配信、ブロックで自動停止 |
| キーワード自動応答 | 完全一致/部分一致、タグ付与、反応数カウント |
| **AI自動応答** | キーワードに一致しないメッセージにClaudeが会話履歴＋ナレッジをもとに返信。友だち単位でON/OFF（有人対応切替） |
| **クリック計測** | `{{link:コード}}` が友だちごとの計測URLに展開。誰がクリックしたか記録 |
| **分析** | 友だち推移、ブロック率、配信ごとのクリック率・24hブロック数、シナリオ離脱率、無料応答/有料プッシュの内訳 |

> 自動応答・AI応答は LINE の「応答メッセージ（reply）」で送るため、配信数（従量課金）にカウントされません。

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を設定
npm run build && npm start   # http://localhost:3000
```

1. [LINE Developers](https://developers.line.biz/) で Messaging API チャネルを作成し、チャネルシークレットとアクセストークンを `.env.local` に設定
2. Webhook URL に `https://<あなたのドメイン>/api/line/webhook` を設定し「Webhookの利用」をON
3. LINE Official Account Manager で「応答メッセージ」をOFF（本アプリが応答するため）
4. AI応答を使う場合は `ANTHROPIC_API_KEY` を設定し、管理画面「AI設定」でONにする

`LINE_CHANNEL_ACCESS_TOKEN` 未設定時は送信をログ出力するだけのドライランになります（ローカル確認用）。

## 運用（デプロイ）

SQLite を使うため、**永続ディスクのあるサーバー** で動かしてください（VPS、Railway、Fly.io、Render など）。
Vercel 等のサーバーレスはDBファイルが消えるため不向きです。

- ステップ配信・予約配信はサーバー内蔵のタイマーで1分ごとに処理されます
- 外部cronを使う場合は `DISABLE_INTERNAL_CRON=1` にして `GET /api/cron` を `Authorization: Bearer $CRON_SECRET` 付きで毎分呼び出してください

## 構成

- Next.js (App Router, Server Actions) / TypeScript
- better-sqlite3（`data/app.db`）
- LINE Messaging API（fetchで直接呼び出し）
- Claude API（`@anthropic-ai/sdk`）

```
app/(admin)/        管理画面
app/api/line/webhook  LINE Webhook
app/api/cron        定期ジョブ
app/r/[code]        クリック計測リダイレクト
lib/                DB・LINE・配信ロジック・AI
```

## 今後の拡張候補

- リッチメニューの作成・タグ別切替
- 回答フォーム、流入経路分析（LIFF）
- 画像・Flexメッセージ送信
- 複数アカウント・複数スタッフ
