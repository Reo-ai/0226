#!/bin/bash
# Mac用: ダブルクリックで Affiliate Pilot AI を起動します
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js が見つかりません。https://nodejs.org/ja から LTS 版をインストールしてから、もう一度開いてください。"
  read -r -p "Enter を押すと閉じます"
  exit 1
fi
node scripts/start.mjs
