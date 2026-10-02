#!/bin/bash
# スキルステップを Vercel 本番で動かすための初回セットアップ（本人が1回実行する）。
#   1. LINE の鍵（チャネルシークレット・アクセストークン）を登録
#   2. Turso（無料DB）を作って接続
#   3. 定期配信用の合言葉（CRON_SECRET）を Vercel と GitHub に登録
#   4. 本番デプロイ → 配信内容（funnel.mjs）を本番DBへ投入
# 鍵やトークンは画面に表示せず、ファイルにも残さない。途中で止まっても、もう一度実行すれば続きからやり直せる。
set -euo pipefail
cd "$(dirname "$0")/.."

APP_URL="https://skill-step-hazel.vercel.app"
DB_NAME="skill-step"
GH_REPO="reo-ai/0226"
FUNNEL="funnels/claude-code-course/funnel.mjs"

has_env() { vercel env ls production 2>/dev/null | grep -q "^ $1 "; }
put_env() { # 既存を置き換えて登録
  vercel env rm "$1" production -y >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production >/dev/null
}
read_secret() {
  local value
  read -r -s -p "$1 を貼り付けて Enter: " value </dev/tty
  echo >&2
  [ -n "$value" ] || { echo "空なので中止します" >&2; exit 1; }
  printf '%s' "$value"
}

echo "== 1/4 LINE の鍵 =="
if has_env LINE_CHANNEL_SECRET && has_env LINE_CHANNEL_ACCESS_TOKEN; then
  echo "登録済みなのでスキップ"
else
  echo "LINE Developers の画面からコピーして貼ってください（貼った文字は表示されません）"
  put_env LINE_CHANNEL_SECRET "$(read_secret '「チャネル基本設定」の Channel secret')"
  put_env LINE_CHANNEL_ACCESS_TOKEN "$(read_secret '「Messaging API設定」のチャネルアクセストークン（長期）')"
  echo "✅ 登録しました"
fi

echo "== 2/4 Turso（無料DB） =="
export PATH="$HOME/.turso:$PATH"
if ! command -v turso >/dev/null; then
  curl -sSfL https://get.tur.so/install.sh | bash # Turso 公式のインストーラー
fi
# whoami は未ログインでも終了コード0を返すので、出力の文言で判定する
if turso auth whoami 2>&1 | grep -qi "not logged in"; then
  echo "ブラウザが開きます。「Continue with GitHub」でログイン（初回は登録）してください"
  turso auth login
fi
if turso auth whoami 2>&1 | grep -qi "not logged in"; then
  echo "Turso にログインできていないので中止します。もう一度実行してください"; exit 1
fi
turso db show "$DB_NAME" >/dev/null 2>&1 || turso db create "$DB_NAME"
DB_URL=$(turso db show "$DB_NAME" --url)
case "$DB_URL" in
  libsql://*) ;;
  *) echo "DBのURLを取得できませんでした: $DB_URL"; exit 1 ;;
esac
DB_TOKEN=$(turso db tokens create "$DB_NAME")
[ ${#DB_TOKEN} -gt 40 ] || { echo "DBのトークンを取得できませんでした"; exit 1; }
put_env DATABASE_URL "$DB_URL"
put_env DATABASE_AUTH_TOKEN "$DB_TOKEN"
echo "✅ $DB_NAME を接続しました"

echo "== 3/4 定期配信の合言葉 =="
CRON=$(openssl rand -hex 24)
put_env CRON_SECRET "$CRON"
put_env DISABLE_INTERNAL_CRON "1"
printf '%s' "$CRON" | gh secret set CRON_SECRET -R "$GH_REPO"
printf '%s' "$APP_URL" | gh secret set APP_URL -R "$GH_REPO"
echo "✅ Vercel と GitHub に登録しました"

echo "== 4/4 本番デプロイと配信内容の投入 =="
vercel --prod --yes >/dev/null
# 定期処理を1回呼んで、本番DBに表を作らせる
curl -fsS -o /dev/null -H "Authorization: Bearer $CRON" "$APP_URL/api/cron"
unset CRON
DATABASE_URL="$DB_URL" DATABASE_AUTH_TOKEN="$DB_TOKEN" BASE_URL="$APP_URL" \
  node scripts/seed-funnel.mjs "$FUNNEL"
unset DB_TOKEN

echo
echo "🎉 完了しました。Claude に「終わった」と伝えてください（Webhook の検証と動作確認に進みます）。"
