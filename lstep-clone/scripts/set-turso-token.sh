#!/bin/bash
# 招待した人の専用データベースを自動で作るための Turso の鍵（API トークン）を発行して、本番に登録する（値は画面に出さない）
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN="$(~/.turso/turso auth api-tokens mint "skill-coach-step-$(date +%Y%m%d%H%M)" 2>/dev/null | tail -1 | tr -d '[:space:]')"
if [ -z "$TOKEN" ]; then
  echo "✗ Turso の鍵を発行できませんでした。「~/.turso/turso auth login」でログインしてから、もう一度実行してください。"
  exit 1
fi
vercel env rm TURSO_API_TOKEN production -y >/dev/null 2>&1 || true
printf '%s' "$TOKEN" | vercel env add TURSO_API_TOKEN production >/dev/null
echo "✓ 本番に登録しました。Claude に「できた」と伝えてください。"
