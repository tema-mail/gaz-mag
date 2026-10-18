# Сборщик gaz-mag в боевом режиме: собирает сайт на сервере из кода (GitHub, только чтение) + данных сервера (админка).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 git rsync ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY builder.mjs /app/builder.mjs
CMD ["node", "/app/builder.mjs"]
