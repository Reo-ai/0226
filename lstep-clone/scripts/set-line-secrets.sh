#!/bin/bash
# LINE のチャネルシークレット（と、必要ならアクセストークン）を Vercel 本番に登録し直して再デプロイする。
# 入力した値は画面に表示されず、チャットやファイルにも残らない。
#   bash scripts/set-line-secrets.sh          … シークレットだけ登録し直す
#   bash scripts/set-line-secrets.sh --token  … アクセストークンも登録し直す
set -euo pipefail
cd "$(dirname "$0")/.."

put_env() {
  vercel env rm "$1" production -y >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production >/dev/null
}

read -r -s -p "「チャネル基本設定」の Channel secret を貼り付けて Enter: " SECRET </dev/tty
echo
SECRET=$(printf '%s' "$SECRET" | tr -d '[:space:]')
# チャネルシークレットは16進数32文字
if ! printf '%s' "$SECRET" | grep -Eq '^[0-9a-f]{32}$'; then
  echo "❌ Channel secret の形ではありません（英数字32文字のはず。いま ${#SECRET} 文字）。コピーし直してもう一度実行してください"
  exit 1
fi

if [ "${1:-}" = "--token" ]; then
  read -r -s -p "「Messaging API設定」のチャネルアクセストークン（長期）を貼り付けて Enter: " TOKEN </dev/tty
  echo
  TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
  [ ${#TOKEN} -gt 100 ] || { echo "❌ アクセストークンにしては短すぎます（${#TOKEN} 文字）"; exit 1; }
fi

put_env LINE_CHANNEL_SECRET "$SECRET"
unset SECRET
if [ -n "${TOKEN:-}" ]; then put_env LINE_CHANNEL_ACCESS_TOKEN "$TOKEN"; unset TOKEN; fi
echo "✅ 登録しました。本番に反映します（1分ほど）"
vercel --prod --yes >/dev/null
echo "🎉 反映しました。Claude に「終わった」と伝えてください"
