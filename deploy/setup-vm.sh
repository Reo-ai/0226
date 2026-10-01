#!/usr/bin/env bash
# Oracle Cloud Always Free (Ubuntu) 用セットアップ。VM上で実行:
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-vm.sh | bash -s -- https://github.com/<you>/<repo>.git
set -euo pipefail
REPO="${1:?使い方: setup-vm.sh <GitリポジトリURL>}"
DIR="$HOME/line-app"

# Docker
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

# Oracle の Ubuntu イメージは iptables で 80/443 が閉じているので開ける
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo sh -c 'command -v netfilter-persistent >/dev/null && netfilter-persistent save' || true

[ -d "$DIR" ] || git clone "$REPO" "$DIR"
cd "$DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  IP=$(curl -fsS https://api.ipify.org)
  DOMAIN="${IP//./-}.sslip.io"   # 独自ドメインが無くても無料でHTTPSが使える
  sed -i "s#^BASE_URL=.*#BASE_URL=https://$DOMAIN#" .env
  sed -i "s#^SESSION_SECRET=.*#SESSION_SECRET=$(openssl rand -hex 32)#" .env
  sed -i "s#^CRON_SECRET=.*#CRON_SECRET=$(openssl rand -hex 16)#" .env
  echo "DOMAIN=$DOMAIN" > deploy/.env
  echo ".env を作成しました。ADMIN_PASSWORD と LINE の値を設定してから再実行してください:"
  echo "  nano $DIR/.env && bash $DIR/deploy/setup-vm.sh $REPO"
  exit 0
fi

cd deploy
sudo docker compose up -d --build
echo "起動しました: $(grep ^BASE_URL ../.env | cut -d= -f2)"
