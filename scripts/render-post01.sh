#!/bin/bash
# ============================================================
# 1投稿目「成功者と普通の人の朝の違い」完全パイプライン
# 使い方: bash scripts/render-post01.sh [--voice onyx] [--speed 1.1]
#
# 実行内容:
#   1. OpenAI TTS でナレーション音声を生成
#   2. 音声を public/audio/ にコピー（Remotion が参照できるように）
#   3. Remotion で動画をレンダリング（音声込みで MP4 出力）
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/output/videos/post01_morning_habits_$(date +%Y%m%d_%H%M).mp4"

# オプション解析（デフォルト値）
VOICE="onyx"
SPEED="1.1"

while [[ $# -gt 0 ]]; do
  case $1 in
    --voice) VOICE="$2"; shift 2 ;;
    --speed) SPEED="$2"; shift 2 ;;
    *) echo "不明なオプション: $1"; exit 1 ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════"
echo "  成功の哲学 | Post #01 完全パイプライン"
echo "═══════════════════════════════════════════"
echo "  voice: $VOICE, speed: ${SPEED}x"
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

# OpenAI API キー確認
if [ -z "$OPENAI_API_KEY" ]; then
  if [ -f "$ROOT/.env" ]; then
    export $(grep -v '^#' "$ROOT/.env" | xargs)
  fi
  if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY が設定されていません。"
    echo "   .env ファイルに OPENAI_API_KEY=sk-... を追加してください。"
    exit 1
  fi
fi

# ── Step 1: ナレーション音声生成 ──────────────────────────────
echo "🎙️  Step 1/2: ナレーション音声を生成中..."
echo ""

cd "$ROOT" && node scripts/generate-narration.js --voice "$VOICE" --speed "$SPEED"

echo ""

# ── Step 2: Remotion レンダリング ────────────────────────────
echo "🎬 Step 2/2: Remotion でレンダリング中..."
echo ""

mkdir -p "$ROOT/output/videos"

cd "$ROOT" && npx remotion render \
  src/remotion/index.tsx \
  Post01MorningHabits \
  "$OUT" \
  --width=720 \
  --height=1280 \
  --fps=30 \
  --log=info

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  ✅ 完成！動画ファイルを確認してください  ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  ファイル: $OUT"
echo ""
echo "投稿チェックリスト:"
echo "  □ 動画を再生して音声・字幕・映像を確認"
echo "  □ Instagram キャプション（post_01_script.md 参照）をコピー"
echo "  □ ハッシュタグを追加（同ファイル参照）"
echo "  □ 平日21:00に投稿"
echo "  □ 投稿後すぐストーリーズでシェア"
echo "  □ 3分以内にコメント欄に「1番から始める人〜？」と書き込む"
echo ""
