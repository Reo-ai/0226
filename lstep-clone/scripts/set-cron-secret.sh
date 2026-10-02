#!/bin/bash
# 定期実行用の合言葉 CRON_SECRET を新しく作り、本番（Vercel）と GitHub の両方に同じ値で登録する（値は画面に出さない）
set -euo pipefail
cd "$(dirname "$0")/.."

SECRET="$(openssl rand -hex 24)"

# 手元の控え（.env.vercel・git 管理外）も新しい値に置き換える
if grep -q '^CRON_SECRET=' .env.vercel 2>/dev/null; then
  sed -i '' "s/^CRON_SECRET=.*/CRON_SECRET=${SECRET}/" .env.vercel
else
  echo "CRON_SECRET=${SECRET}" >> .env.vercel
fi

vercel env rm CRON_SECRET production -y >/dev/null 2>&1 || true
printf '%s' "$SECRET" | vercel env add CRON_SECRET production >/dev/null
printf '%s' "$SECRET" | gh secret set CRON_SECRET --repo reo-ai/0226
echo "✓ 本番と GitHub の両方に登録しました。Claude に「できた」と伝えてください。"
