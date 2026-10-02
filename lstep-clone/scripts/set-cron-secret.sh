#!/bin/bash
# 定期実行（GitHub Actions）用の合言葉 CRON_SECRET を、手元の .env.vercel から GitHub に登録する（値は画面に出さない）
set -euo pipefail
cd "$(dirname "$0")/.."

SECRET="$(grep -E '^CRON_SECRET=' .env.vercel | cut -d= -f2-)"
if [ -z "$SECRET" ]; then
  echo "✗ .env.vercel に CRON_SECRET がありません。登録はしていません。"
  exit 1
fi
printf '%s' "$SECRET" | gh secret set CRON_SECRET --repo reo-ai/0226
echo "✓ GitHub に登録しました。Claude に「できた」と伝えてください。"
