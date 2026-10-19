# Affiliate Pilot かんたん版（ブラウザ版・静的サイト）

このフォルダをそのまま静的ホスティングに置くだけで動きます（ビルド不要）。

## Cloudflare Pages で公開する
1. Cloudflare ダッシュボード → Workers & Pages → Create → Pages → **Connect to Git**
2. リポジトリ `Reo-ai/0226`、ブランチ `claude/tiktok-auto-pipeline-JXaiW`（または main）
3. Build command: 空欄 ／ Build output directory: `affiliate-pilot/web`
4. Deploy → `https://<project>.pages.dev` が公開URL

CLI の場合: `npx wrangler pages deploy affiliate-pilot/web --project-name affiliate-pilot`
