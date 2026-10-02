#!/bin/bash
# LINEログインのチャネルシークレットを、クリップボードから読み取って本番に登録する（値は画面に出さない）。
# 貼り付けミス（余分な空白・改行・別の質問欄への入力）を防ぐためのもの。
#   使い方: LINE Developers の「スキルコーチ ログイン」→「チャネル基本設定」でシークレットをコピーしてから実行
set -euo pipefail
cd "$(dirname "$0")/.."

# 見出しなど余計な文字ごとコピーしても、英数字32文字の部分だけを取り出す
pick() { grep -oE '[0-9a-f]{32}' | head -1 || true; }
SECRET="$(pbpaste 2>/dev/null | pick)"
# クリップボードに無ければ、その場で貼り付けてもらう（入力は画面に表示しない）
if ! [[ "$SECRET" =~ ^[0-9a-f]{32}$ ]]; then
  read -rsp "チャネルシークレットを貼り付けて Enter を押してください（画面には表示されません）: " INPUT
  echo
  SECRET="$(printf '%s' "$INPUT" | pick)"
  [ -z "$SECRET" ] && SECRET="$(printf '%s' "$INPUT" | tr -d '[:space:]')"
fi

if ! [[ "$SECRET" =~ ^[0-9a-f]{32}$ ]]; then
  echo "✗ チャネルシークレットの形（英数字32文字）ではありません（${#SECRET}文字でした）。登録はしていません。"
  echo "  「チャネル基本設定」のチャネルシークレットをコピーして、もう一度実行してください。"
  exit 1
fi

# 値は出さず、指紋（SHA-256の先頭8桁）だけを表示して、LINEの画面の値と同じか確かめる
FP="$(printf '%s' "$SECRET" | shasum -a 256 | cut -c1-8)"
EXPECTED="${EXPECTED_FP:-d33d42e1}"
echo "コピーした値の指紋: $FP"
if [ "$FP" != "$EXPECTED" ]; then
  echo "✗ LINEの「スキルコーチ ログイン」のシークレット（指紋 $EXPECTED）と一致しません。"
  echo "  ふだん使っている Chrome で https://developers.line.biz/console/channel/2011839894/basics を開き、"
  echo "  チャネルシークレットの横のコピーボタンでコピーしてから、もう一度実行してください。登録はしていません。"
  exit 1
fi
echo "✓ 一致しました。本番に登録します…"

vercel env rm LINE_LOGIN_CHANNEL_SECRET production -y >/dev/null 2>&1 || true
printf '%s' "$SECRET" | vercel env add LINE_LOGIN_CHANNEL_SECRET production >/dev/null
echo "✓ 登録しました。Claude に「できた」と伝えてください。"
