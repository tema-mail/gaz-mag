#!/bin/bash
# Принимающая сторона ключа выкладки gaz-mag (authorized_keys пользователя gazmag-deploy, command=этот скрипт).
# Боевой режим (18.10.2026): сайт собирается на сервере (контейнер gaz-mag-builder), ключ умеет только поставить задание:
#   update <коммит> – забрать новый код с GitHub и пересобрать с данными сервера; rollback – предыдущая выкладка; status.
# Записывать файлы на сервер ключ не может (rsync убран).
set -euo pipefail
Q=/opt/gaz-mag/queue
cmd="${SSH_ORIGINAL_COMMAND:-}"
job() { printf '%s\n' "$2" > "$Q/$(date +%s%N)-$1"; }
case "$cmd" in
  update\ *)
    sha="${cmd#update }"
    [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || { echo "неверный коммит" >&2; exit 1; }
    job update "$sha"; echo "задание: забрать код $sha и пересобрать"
    ;;
  rollback) job rollback ""; echo "задание: откат на предыдущую выкладку" ;;
  status) cat /opt/gaz-mag/state/status.json 2>/dev/null || echo '{}'; echo; echo "текущая: $(readlink /opt/gaz-mag/releases/current)" ;;
  *) echo "команда запрещена" >&2; exit 1 ;;
esac
