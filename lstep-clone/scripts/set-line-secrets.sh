#!/bin/bash
# LINE のチャネルシークレットとアクセストークンを Vercel の本番環境変数に登録する。
# 入力した値は画面に表示されず、チャットやファイルにも残らない。
set -euo pipefail
cd "$(dirname "$0")/.."

read_secret() {
  local label="$1" value
  read -r -s -p "$label を貼り付けて Enter: " value
  echo
  if [ -z "$value" ]; then echo "空なので中止します"; exit 1; fi
  printf '%s' "$value"
}

SECRET=$(read_secret "Channel secret（チャネルシークレット）")
TOKEN=$(read_secret "チャネルアクセストークン（長期）")

for NAME in LINE_CHANNEL_SECRET LINE_CHANNEL_ACCESS_TOKEN; do
  # 既にあれば置き換える
  vercel env rm "$NAME" production -y >/dev/null 2>&1 || true
done
printf '%s' "$SECRET" | vercel env add LINE_CHANNEL_SECRET production >/dev/null
printf '%s' "$TOKEN" | vercel env add LINE_CHANNEL_ACCESS_TOKEN production >/dev/null
unset SECRET TOKEN

echo "✅ 登録しました。Claude に「登録した」と伝えてください（再デプロイはClaudeが行います）。"
