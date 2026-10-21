#!/bin/zsh
# Установка gaz-mag.ru на VPS Beget (повторный запуск безопасен, им же обновляется приёмник заявок server/lead.mjs):
# пользователь выкладки с ограниченным ключом, папки, контейнеры сайта и заявок, блок в общем Caddy (с проверкой и откатом).
# Токен Telegram сюда не попадает: он лежит только на сервере в /opt/gaz-mag/lead.env (600).
# Сами выкладки делает GitHub Actions (.github/workflows/deploy.yml) – этот скрипт их не запускает.
set -euo pipefail
HOST="root@45.12.72.227"
KEY="$HOME/.ssh/seo_factory_tunnel_ed25519"
DEPLOY_PUB="${DEPLOY_PUB:?нужен путь к открытому ключу выкладки}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

# 1. Пользователь и папки; ключ выкладки может только то, что разрешает receive.sh
"${SSH[@]}" "id gazmag-deploy >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash gazmag-deploy
  getent group 10501 >/dev/null || groupadd --system --gid 10501 gazmag-api
  id gazmag-api >/dev/null 2>&1 || useradd --system --uid 10501 --gid 10501 --no-create-home --shell /usr/sbin/nologin gazmag-api
  mkdir -p /opt/gaz-mag/releases /opt/gaz-mag/server /opt/gaz-mag/data /home/gazmag-deploy/.ssh
  chown gazmag-deploy:gazmag-deploy /opt/gaz-mag /opt/gaz-mag/releases
  chown -R 10501:10501 /opt/gaz-mag/data && chmod 700 /opt/gaz-mag/data
  # боевой режим (18.10.2026): сайт собирает gaz-mag-builder (uid 10501) – ему принадлежат выкладки, код, данные, кэш;
  # очередь заданий – «почтовый ящик» (1733): ключ выкладки и приёмник кладут задания, читать и удалять может только сборщик
  mkdir -p /opt/gaz-mag/repo /opt/gaz-mag/content /opt/gaz-mag/queue /opt/gaz-mag/state /opt/gaz-mag/work /opt/gaz-mag/cache /opt/gaz-mag/builder
  chown -R 10501:10501 /opt/gaz-mag/releases /opt/gaz-mag/repo /opt/gaz-mag/content /opt/gaz-mag/state /opt/gaz-mag/work /opt/gaz-mag/cache
  chown 10501:10501 /opt/gaz-mag/queue && chmod 1733 /opt/gaz-mag/queue && chmod 755 /opt/gaz-mag/state
  chmod 755 /opt/gaz-mag /opt/gaz-mag/releases /opt/gaz-mag/server
  # разделы аналитики кабинета (21.10.2026): отчёты – analytics (читает приёмник), ключи – secrets (только сборщик аналитики)
  mkdir -p /opt/gaz-mag/analytics /opt/gaz-mag/secrets /opt/gaz-mag/analytics-app
  chown 10501:10501 /opt/gaz-mag/analytics /opt/gaz-mag/secrets && chmod 750 /opt/gaz-mag/analytics && chmod 700 /opt/gaz-mag/secrets
  [ -f /opt/gaz-mag/lead.env ] || { printf 'TG_TOKEN=\nTG_CHAT=\n' > /opt/gaz-mag/lead.env; }
  chmod 600 /opt/gaz-mag/lead.env"
scp -q -i "$KEY" "$HERE/receive.sh" "$HOST:/usr/local/bin/gazmag-receive"
scp -q -i "$KEY" "$HERE/compose.yml" "$HERE/nginx.conf" "$HOST:/opt/gaz-mag/"
scp -q -i "$KEY" "$HERE/builder/Dockerfile" "$HERE/builder/builder.mjs" "$HOST:/opt/gaz-mag/builder/"
scp -q -i "$KEY" "$HERE/../server/lead.mjs" "$HOST:/opt/gaz-mag/server/lead.mjs"
# только код сборщика – без локальных out/ и secrets/
scp -q -r -i "$KEY" "$HERE/../analytics/collect.py" "$HERE/../analytics/phrases.json" "$HERE/../analytics/Dockerfile" "$HERE/../analytics/providers" "$HOST:/opt/gaz-mag/analytics-app/"
"${SSH[@]}" "chmod 755 /usr/local/bin/gazmag-receive && chown root:root /usr/local/bin/gazmag-receive
  chmod 644 /opt/gaz-mag/server/lead.mjs
  printf 'command=\"/usr/local/bin/gazmag-receive\",restrict %s\n' \"$(cat "$DEPLOY_PUB")\" > /home/gazmag-deploy/.ssh/authorized_keys
  chown -R gazmag-deploy:gazmag-deploy /home/gazmag-deploy/.ssh && chmod 700 /home/gazmag-deploy/.ssh && chmod 600 /home/gazmag-deploy/.ssh/authorized_keys
  cd /opt/gaz-mag && docker compose build -q gaz-mag-builder && { [ ! -f analytics-app/Dockerfile ] || docker compose --profile jobs build -q gaz-mag-analytics; } && 
  # сбор аналитики раз в день в 07:15 НСК (00:15 UTC); журнал – /var/log/gaz-mag-analytics.log
  printf '15 0 * * * root cd /opt/gaz-mag && docker compose --profile jobs run --rm gaz-mag-analytics python3 collect.py daily >> /var/log/gaz-mag-analytics.log 2>&1\n' > /etc/cron.d/gaz-mag-analytics && chmod 644 /etc/cron.d/gaz-mag-analytics && docker compose up -d --remove-orphans >/dev/null && docker restart gaz-mag-api gaz-mag-web >/dev/null && docker ps --filter name=gaz-mag --format '{{.Names}} {{.Status}}'"

# 2. Блок в общем Caddy: только при парных метках, с проверкой конфигурации и откатом при неудачной перезагрузке
cat "$HERE/gaz-mag.caddy" | "${SSH[@]}" '
  set -e
  F=/opt/dzenbot/Caddyfile
  BAK="$F.bak-gaz-mag-$(date +%Y%m%d%H%M%S)"
  cp "$F" "$BAK"
  [ "$(grep -c "^# >>> gaz-mag" "$F")" = "$(grep -c "^# <<< gaz-mag" "$F")" ] || { echo "Caddy: метки без пары, файл не изменён" >&2; exit 1; }
  awk "/^# >>> gaz-mag/{skip=1} !skip{print} /^# <<< gaz-mag/{skip=0}" "$F" > /tmp/Caddyfile.gazmag
  cat >> /tmp/Caddyfile.gazmag
  if docker exec -i dzenbot-caddy-1 caddy validate --adapter caddyfile --config /dev/stdin < /tmp/Caddyfile.gazmag >/tmp/caddy-validate-gazmag.log 2>&1; then
    cat /tmp/Caddyfile.gazmag > "$F"
    if docker exec dzenbot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
      echo "Caddy: блок gaz-mag применён"
    else
      cat "$BAK" > "$F"; docker exec dzenbot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
      echo "Caddy: перезагрузка не прошла, прежний файл возвращён" >&2; exit 1
    fi
  else
    echo "Caddy: проверка не прошла, файл не изменён" >&2; tail -5 /tmp/caddy-validate-gazmag.log >&2; exit 1
  fi'
