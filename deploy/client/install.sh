#!/bin/zsh
# Установка gaz-mag.ru на сервер заказчика (FirstVDS 62.109.0.63, переезд с Beget 02.11.2026). Повторный запуск безопасен.
# Отличия от deploy/install.sh (Beget): Docker ставится при необходимости, своп 2 ГБ (в сервере 1 ГБ, сборщику нужно до 1,5),
# снаружи nginx хоста вместо общего Caddy, сертификат – certbot по webroot /var/www/certbot (как у соседа kruvassan.ru).
# Ключ выкладки тот же (~/.config/gaz-mag/deploy_ed25519), меняется только адрес в workflow.
set -euo pipefail
HOST="${CLIENT_HOST:-root@62.109.0.63}"
KEY="${CLIENT_KEY:-$HOME/.ssh/gazmag_client_ed25519}"
DEPLOY_PUB="${DEPLOY_PUB:-$HOME/.config/gaz-mag/deploy_ed25519.pub}"
HERE="$(cd "$(dirname "$0")" && pwd)"
D="$HERE/.."
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST")
SCP=(scp -q -i "$KEY" -o IdentitiesOnly=yes)

# 1. Своп и Docker
"${SSH[@]}" 'set -e
  if ! grep -q "^/swapfile" /proc/swaps; then
    [ -f /swapfile ] || { fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap -q /swapfile; }
    swapon /swapfile; grep -q "^/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
  if ! command -v docker >/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq ca-certificates curl >/dev/null
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq && apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
    systemctl enable --now docker >/dev/null 2>&1
  fi
  docker network inspect gaz-mag >/dev/null 2>&1 || docker network create gaz-mag >/dev/null'

# 2. Пользователи, папки, права – как в deploy/install.sh
"${SSH[@]}" "id gazmag-deploy >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash gazmag-deploy
  getent group 10501 >/dev/null || groupadd --system --gid 10501 gazmag-api
  id gazmag-api >/dev/null 2>&1 || useradd --system --uid 10501 --gid 10501 --no-create-home --shell /usr/sbin/nologin gazmag-api
  mkdir -p /opt/gaz-mag/releases /opt/gaz-mag/server /opt/gaz-mag/data /home/gazmag-deploy/.ssh
  mkdir -p /opt/gaz-mag/repo /opt/gaz-mag/content /opt/gaz-mag/queue /opt/gaz-mag/state /opt/gaz-mag/work /opt/gaz-mag/cache /opt/gaz-mag/builder
  mkdir -p /opt/gaz-mag/analytics /opt/gaz-mag/secrets /opt/gaz-mag/analytics-app
  chown -R 10501:10501 /opt/gaz-mag/data /opt/gaz-mag/releases /opt/gaz-mag/repo /opt/gaz-mag/content /opt/gaz-mag/state /opt/gaz-mag/work /opt/gaz-mag/cache
  chmod 700 /opt/gaz-mag/data
  chown 10501:10501 /opt/gaz-mag/queue && chmod 1733 /opt/gaz-mag/queue && chmod 755 /opt/gaz-mag/state
  chmod 755 /opt/gaz-mag /opt/gaz-mag/releases /opt/gaz-mag/server
  chown 10501:10501 /opt/gaz-mag/analytics /opt/gaz-mag/secrets && chmod 750 /opt/gaz-mag/analytics && chmod 700 /opt/gaz-mag/secrets
  [ -f /opt/gaz-mag/lead.env ] || printf 'TG_TOKEN=\nTG_CHAT=\n' > /opt/gaz-mag/lead.env
  chmod 600 /opt/gaz-mag/lead.env
  mkdir -p /var/www/certbot"
"${SCP[@]}" "$HERE/../receive.sh" "$HOST:/usr/local/bin/gazmag-receive"
"${SCP[@]}" "$HERE/../compose.yml" "$HERE/../nginx.conf" "$HOST:/opt/gaz-mag/"
"${SCP[@]}" "$HERE/compose.override.yml" "$HOST:/opt/gaz-mag/compose.override.yml"
"${SCP[@]}" "$HERE/../builder/Dockerfile" "$HERE/../builder/builder.mjs" "$HOST:/opt/gaz-mag/builder/"
"${SCP[@]}" "$D/../server/lead.mjs" "$HOST:/opt/gaz-mag/server/lead.mjs"
"${SCP[@]}" -r "$D/../analytics/collect.py" "$D/../analytics/phrases.json" "$D/../analytics/Dockerfile" "$D/../analytics/providers" "$HOST:/opt/gaz-mag/analytics-app/"
"${SSH[@]}" "chmod 755 /usr/local/bin/gazmag-receive && chown root:root /usr/local/bin/gazmag-receive
  chmod 644 /opt/gaz-mag/server/lead.mjs
  printf 'command=\"/usr/local/bin/gazmag-receive\",restrict %s\n' \"$(cat "$DEPLOY_PUB")\" > /home/gazmag-deploy/.ssh/authorized_keys
  chown -R gazmag-deploy:gazmag-deploy /home/gazmag-deploy/.ssh && chmod 700 /home/gazmag-deploy/.ssh && chmod 600 /home/gazmag-deploy/.ssh/authorized_keys
  printf '15 0 * * * root cd /opt/gaz-mag && docker compose --profile jobs run --rm gaz-mag-analytics python3 collect.py daily >> /var/log/gaz-mag-analytics.log 2>&1\n' > /etc/cron.d/gaz-mag-analytics && chmod 644 /etc/cron.d/gaz-mag-analytics"

# 3. Образы и контейнеры (сборка образов долгая – на сервере через nohup, чтобы обрыв SSH её не убил)
"${SSH[@]}" 'cd /opt/gaz-mag && nohup sh -c "docker compose build -q gaz-mag-builder && docker compose --profile jobs build -q gaz-mag-analytics; docker compose up -d --remove-orphans && docker restart gaz-mag-api gaz-mag-web" > /var/log/gaz-mag-install.log 2>&1 &
  echo "образы собираются: /var/log/gaz-mag-install.log"'

# 4. nginx хоста: до сертификата – только http (проверка по Host и выпуск certbot), после – полный конфиг с 301 на https
"${SSH[@]}" 'set -e
  F=/etc/nginx/sites-enabled/gaz-mag.ru
  BAK=/root/gaz-mag.nginx.bak-$(date +%Y%m%d%H%M%S); [ -f "$F" ] && cp "$F" "$BAK" || BAK=""
  if [ -f /etc/letsencrypt/live/gaz-mag.ru/fullchain.pem ]; then cat > "$F"; else
    cat > /dev/null
    cat > "$F" <<EOF
# gaz-mag.ru до выпуска сертификата (deploy/client/install.sh)
server {
    listen 80;
    listen [::]:80;
    server_name gaz-mag.ru www.gaz-mag.ru;
    location ^~ /.well-known/acme-challenge/ { alias /var/www/certbot/; default_type "text/plain"; try_files \$uri =404; }
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    client_max_body_size 16m;
    location /api/ { proxy_pass http://127.0.0.1:18090; }
    location / { proxy_pass http://127.0.0.1:18080; }
}
EOF
  fi
  if nginx -t >/tmp/gaz-mag-nginx-test.log 2>&1; then systemctl reload nginx; echo "nginx: gaz-mag.ru применён"
  else
    if [ -n "$BAK" ]; then cp "$BAK" "$F"; else rm -f "$F"; fi
    echo "nginx: проверка не прошла, прежнее состояние возвращено" >&2; tail -5 /tmp/gaz-mag-nginx-test.log >&2; exit 1
  fi' < "$HERE/gaz-mag.nginx"
