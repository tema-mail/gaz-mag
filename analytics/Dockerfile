# Сбор разделов кабинета gaz-mag (collect.py): Python + cryptography для ключа Search Console. Запускается cron'ом
# (deploy/install.sh), отчёты пишет в /out, ключи читает из /secrets.
FROM python:3.12-slim
RUN pip install --no-cache-dir cryptography==43.0.3
WORKDIR /app
COPY collect.py phrases.json /app/
COPY providers /app/providers
ENV PYTHONDONTWRITEBYTECODE=1
CMD ["python3", "collect.py", "daily"]
