#!/usr/bin/env bash
# Oracle Cloud Always Free (Ubuntu) 用セットアップ。
# リポジトリを clone したあと、このフォルダの親（アプリのフォルダ）で実行:
#   bash deploy/setup-vm.sh
# 質問に答えると、Docker の導入・ポート開放・HTTPS 化・起動まで自動で行います。
# 2回目以降（更新時）に実行すると、最新コードで作り直して再起動します。
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "== 1/4 Docker を準備 =="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi

echo "== 2/4 80/443番ポートを開放 =="
# Oracle の Ubuntu イメージは iptables で 80/443 が閉じている
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null ||
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
done
if ! command -v netfilter-persistent >/dev/null; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null
fi
sudo netfilter-persistent save >/dev/null

echo "== 3/4 設定 =="
if [ ! -f .env ]; then
  IP=$(curl -fsS https://api.ipify.org)
  DOMAIN="${IP//./-}.sslip.io" # 独自ドメインなしで無料HTTPS
  read -rp "管理画面のログインパスワードを決めてください: " ADMIN_PASSWORD </dev/tty
  echo "LINE Developers の Messaging API チャネルの値を入力（後で .env を編集しても可。空欄でEnter）"
  read -rp "  チャネルシークレット: " LINE_SECRET </dev/tty
  read -rp "  チャネルアクセストークン（長期）: " LINE_TOKEN </dev/tty
  read -rp "  友だち追加URL（https://line.me/R/ti/p/@xxxx）: " ADD_URL </dev/tty
  cp .env.example .env
  set_env() {
    local v
    v=$(printf '%s' "$2" | sed -e 's/[\\#&]/\\&/g') # sed 用にエスケープ
    sed -i "s#^$1=.*#$1=$v#" .env
  }
  set_env ADMIN_PASSWORD "$ADMIN_PASSWORD"
  set_env SESSION_SECRET "$(openssl rand -hex 32)"
  set_env CRON_SECRET "$(openssl rand -hex 16)"
  set_env BASE_URL "https://$DOMAIN"
  set_env LINE_CHANNEL_SECRET "$LINE_SECRET"
  set_env LINE_CHANNEL_ACCESS_TOKEN "$LINE_TOKEN"
  set_env LINE_ADD_FRIEND_URL "$ADD_URL"
  echo "DOMAIN=$DOMAIN" >deploy/.env
  chmod 600 .env deploy/.env
fi

echo "== 4/4 ビルドして起動（初回は5〜10分かかります） =="
cd deploy
sudo docker compose up -d --build

BASE_URL=$(grep ^BASE_URL= "$APP_DIR/.env" | cut -d= -f2)
echo
echo "起動しました！"
echo "  管理画面:    $BASE_URL"
echo "  Webhook URL: $BASE_URL/api/line/webhook  ← LINE Developers に設定"
echo "（HTTPS証明書の取得に1〜2分かかることがあります）"
