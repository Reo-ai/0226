#!/bin/bash
# ============================================================
# 1投稿目「成功者と普通の人の朝の違い」レンダリングスクリプト
# 使い方: bash scripts/render-post01.sh
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/output/videos/post01_morning_habits_$(date +%Y%m%d_%H%M).mp4"

echo ""
echo "═══════════════════════════════════════════"
echo "  成功の哲学 | Post #01 Remotion Render"
echo "═══════════════════════════════════════════"
echo "  出力先: $OUT"
echo ""

# 依存パッケージ確認
if ! command -v npx &> /dev/null; then
  echo "❌ npx が見つかりません。Node.js をインストールしてください。"
  exit 1
fi

if [ ! -d "$ROOT/node_modules" ]; then
  echo "📦 npm install を実行します..."
  cd "$ROOT" && npm install
fi

echo "🎬 レンダリング開始..."
echo ""

cd "$ROOT" && npx remotion render \
  src/remotion/index.tsx \
  Post01MorningHabits \
  "$OUT" \
  --width=720 \
  --height=1280 \
  --fps=30 \
  --log=info

echo ""
echo "✅ レンダリング完了！"
echo "   ファイル: $OUT"
echo ""
echo "次のステップ:"
echo "  1. CapCutでナレーション音声（Vrewから書き出し）を追加"
echo "  2. BGMを乗せて音量調整"
echo "  3. 平日21:00にInstagramに投稿"
echo "  4. 投稿後すぐストーリーズでシェア"
echo "  5. 3分以内にコメント欄に「1番から始める人〜？」と書き込む"
echo ""
