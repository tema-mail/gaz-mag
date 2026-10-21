"""Яндекс Метрика для раздела «Метрика и каналы» (по эталону EV SIBIR, скилл «метрика-для-админки-на-вайбкоде»).

Доступ к API отчётов: токен только на чтение (YANDEX_METRIKA_TOKEN в secrets/worker.env), повторы на 429
(квота с IP сервера, он общий с другими проектами), фильтр «только люди» во всех запросах. Здесь же –
блоки за один период: сводка, каналы (поиск разделён на Яндекс и Google, нейросети – по домену источника),
визиты из поиска по дням/неделям, страницы входа, фразы Яндекса. Сравнение периодов и сборка отчёта –
metrika_report.py.

Своей базы заявок у teyes-sibir.ru нет (формы уходят в Tilda), поэтому «заявки» здесь – цель Метрики
«Автоцель: отправка формы»; на экране так и подписано.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable

API = "https://api-metrika.yandex.net"
COUNTER = 99532918
TIMEOUT_SECONDS = 40
RETRY_429 = (2, 4, 8)  # паузы перед повтором, когда Метрика ответила «превышена квота»
# Цели счётчика teyes-sibir.ru (сверены по API 14.10.2026). Несколько id – сумма достижений.
GOALS = {
    "lead": ("Отправка формы", (356775667,)),
    "phone": ("Клик по телефону", (357093507,)),
    "messenger": ("Переход в мессенджер", (357560733,)),
    "ybiz": ("Заявка из Яндекс Бизнеса", (544988909, 544988910, 558143910, 558143911)),
    "purchase": ("Покупка в корзине", (371259483,)),
}
SUMMARY = [("visits", "ym:s:visits"), ("users", "ym:s:users"), ("new_pct", "ym:s:percentNewVisitors"),
           ("bounce", "ym:s:bounceRate"), ("depth", "ym:s:pageDepth"), ("duration", "ym:s:avgVisitDurationSeconds")]
DIM_SOURCE, DIM_ENGINE = "ym:s:lastsignTrafficSource", "ym:s:lastsignSearchEngineRoot"
DIM_REFERER, DIM_START, PHRASE = "ym:s:lastsignReferalSource", "ym:s:startURLPath", "ym:s:lastsignSearchPhrase"
HUMANS = "ym:s:isRobot=='No'"
ORGANIC = f"{DIM_SOURCE}=='organic'"
HIDDEN = "(адрес скрыт Метрикой)"
SOURCE_NAMES = {"direct": "Прямые заходы", "referral": "Переходы с сайтов", "social": "Соцсети",
                "messenger": "Мессенджеры", "ad": "Реклама", "internal": "Внутренние переходы",
                "recommend": "Рекомендательные системы", "email": "Почтовые рассылки", "saved": "Сохранённые страницы"}
ENGINE_NAMES = {"yandex": "Поиск Яндекса", "google": "Поиск Google"}
AI_DOMAINS = ("chatgpt.com", "openai.com", "perplexity.ai", "gemini.google.com", "copilot.microsoft.com", "claude.ai",
              "deepseek.com", "alice.yandex.ru", "giga.chat", "grok.com", "poe.com", "you.com", "chat.mistral.ai")
AI_ROW = "Нейросети"
ORDER = ["Поиск Яндекса", "Поиск Google", "Другие поисковики", "Прямые заходы", "Реклама", "Мессенджеры", "Соцсети",
         "Переходы с сайтов", AI_ROW]

Fetch = Callable[[str, dict, int], bytes]


class MetrikaError(Exception):
    """Ошибка Метрики понятным текстом – без токена внутри."""


class _Quota(Exception):
    pass


def default_fetch(url: str, headers: dict, timeout: int) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout,
                                context=ssl.create_default_context()) as response:
        return response.read()


class Metrika:
    def __init__(self, token: str, fetch: Fetch = default_fetch, sleep: Callable[[float], None] = time.sleep):
        if not token:
            raise MetrikaError("Нет токена Метрики (YANDEX_METRIKA_TOKEN)")
        self._token, self._fetch, self._sleep = token, fetch, sleep

    @classmethod
    def from_env(cls, fetch: Fetch = default_fetch) -> "Metrika":
        return cls(os.environ.get("YANDEX_METRIKA_TOKEN", "").strip(), fetch)

    def api(self, path: str, params: dict | None = None) -> dict:
        for pause in RETRY_429 + (None,):
            try:
                return self._once(path, params)
            except _Quota as exc:
                if pause is None:
                    raise MetrikaError(str(exc)) from None
                self._sleep(pause)
        raise MetrikaError("Метрика не ответила")  # недостижимо: цикл всегда возвращает или бросает

    def _once(self, path: str, params: dict | None) -> dict:
        url = f"{API}{path}" + (f"?{urllib.parse.urlencode(params)}" if params else "")
        error = None
        try:
            raw = self._fetch(url, {"Authorization": f"OAuth {self._token}", "Accept": "application/json"}, TIMEOUT_SECONDS)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise _Quota("Метрика ответила 429: превышена квота запросов") from None
            error = MetrikaError("Метрика: доступ не выдан или токен устарел" if exc.code in (401, 403)
                                 else f"Метрика ответила HTTP {exc.code}")
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            error = MetrikaError(f"Метрика не отвечает: {type(exc).__name__}")
        if error:
            raise error  # вне except: исходная ошибка с заголовками (и токеном) не цепляется
        try:
            return json.loads(raw)
        except ValueError:
            raise MetrikaError("Метрика ответила не JSON") from None

    def timezone(self) -> str:
        return self.api(f"/management/v1/counter/{COUNTER}").get("counter", {}).get("time_zone_name") or "Asia/Novosibirsk"

    def stat(self, date1: str, date2: str, metrics: list[str], dimensions=(), sort=None, limit=100, filters=None) -> dict:
        params = {"ids": COUNTER, "date1": date1, "date2": date2, "metrics": ",".join(metrics), "accuracy": "full",
                  "lang": "ru", "limit": limit, "filters": f"({filters}) AND {HUMANS}" if filters else HUMANS}
        if dimensions:
            params["dimensions"] = ",".join(dimensions)
        if sort:
            params["sort"] = sort
        return self.api("/stat/v1/data", params)


def rows(data: dict) -> list[tuple[list[dict], list[float]]]:
    return [(r.get("dimensions", []), r.get("metrics", [])) for r in data.get("data", [])]


def lead_metric() -> list[str]:
    return [f"ym:s:goal{g}reaches" for g in GOALS["lead"][1]]


def summary(m: Metrika, p: dict) -> dict:
    metrics = [x for _, x in SUMMARY] + lead_metric()
    tot = m.stat(p["date1"], p["date2"], metrics).get("totals", [])
    row = {k: (tot[i] if i < len(tot) else 0) for i, (k, _) in enumerate(SUMMARY)}
    row["lead_goal"] = tot[len(SUMMARY)] if len(tot) > len(SUMMARY) else None
    return row


def _add(buckets: dict, name: str, values: list[float]) -> None:
    v, l = buckets.get(name, (0, 0))
    buckets[name] = (v + (values[0] if values else 0), l + (values[1] if len(values) > 1 else 0))


def channels(m: Metrika, p: dict) -> list[dict]:
    metrics = ["ym:s:visits"] + lead_metric()
    buckets: dict = {}
    for dims, vals in rows(m.stat(p["date1"], p["date2"], metrics, [DIM_SOURCE, DIM_ENGINE])):
        src = (dims[0].get("id") or "").lower()
        if src == "organic":
            _add(buckets, ENGINE_NAMES.get((dims[1].get("id") or "").lower() if len(dims) > 1 else "", "Другие поисковики"), vals)
        else:
            _add(buckets, SOURCE_NAMES.get(src, "Остальное"), vals)
    for dims, vals in rows(m.stat(p["date1"], p["date2"], metrics, [DIM_REFERER], limit=1000, filters=f"{DIM_SOURCE}=='referral'")):
        domain = (dims[0].get("name") or "").lower()
        if any(domain == d or domain.endswith("." + d) for d in AI_DOMAINS):
            _add(buckets, AI_ROW, vals)
            _add(buckets, SOURCE_NAMES["referral"], [-x for x in vals])
    names = ORDER + sorted(n for n in buckets if n not in ORDER)
    out = [{"name": n, "visits": buckets[n][0], "leads": buckets[n][1]} for n in names if n in buckets and buckets[n][0] > 0]
    if not any(r["name"] == AI_ROW for r in out):
        out.append({"name": AI_ROW, "visits": 0, "leads": 0})
    return out


def search_series(m: Metrika, p: dict) -> dict:
    """Визиты из поиска Яндекса и Google: по дням до 31 дня, дальше – по 7 дней от конца периода."""
    data = m.stat(p["date1"], p["date2"], ["ym:s:visits"] + lead_metric(), ["ym:s:date", DIM_ENGINE], limit=2000, filters=ORGANIC)
    by_day: dict = {}
    for dims, vals in rows(data):
        acc = by_day.setdefault(dims[0].get("name"), {"yandex": 0, "google": 0, "leads": 0})
        eng = (dims[1].get("id") or "").lower()
        if eng in ("yandex", "google"):
            acc[eng] += vals[0]
        acc["leads"] += vals[1] if len(vals) > 1 else 0
    start, end = dt.date.fromisoformat(p["date1"]), dt.date.fromisoformat(p["date2"])
    n = (end - start).days + 1
    step = 1 if n <= 31 else 7
    out = {"unit": "day" if step == 1 else "week", "starts": [], "yandex": [], "google": [], "leads": []}
    for i in range(n % step if step > 1 else 0, n, step):
        days = [(start + dt.timedelta(days=i + j)).isoformat() for j in range(step)]
        out["starts"].append(days[0])
        for key in ("yandex", "google", "leads"):
            out[key].append(sum(by_day.get(d, {}).get(key, 0) for d in days))
    return out


def search_pages(m: Metrika, p: dict) -> list[dict]:
    """Страницы входа из поиска: Яндекс и Google отдельно, отправки форм; недостающее до итога – «адрес скрыт»."""
    data = m.stat(p["date1"], p["date2"], ["ym:s:visits"] + lead_metric(), [DIM_START, DIM_ENGINE],
                  sort="-ym:s:visits", limit=500, filters=ORGANIC)
    out: dict = {}
    for dims, vals in rows(data):
        path, eng = dims[0].get("name") or "/", (dims[1].get("id") or "").lower()
        r = out.setdefault(path, {"path": path, "yandex": 0, "google": 0, "other": 0, "leads": 0})
        r[eng if eng in ("yandex", "google") else "other"] += vals[0]
        r["leads"] += vals[1] if len(vals) > 1 else 0
    tot = data.get("totals") or [0, 0]
    shown = sum(r["yandex"] + r["google"] + r["other"] for r in out.values())
    top = sorted(out.values(), key=lambda r: -(r["yandex"] + r["google"] + r["other"]))[:10]
    if tot[0] - shown >= 1:
        top.append({"path": HIDDEN, "yandex": None, "google": None, "other": tot[0] - shown,
                    "leads": max(0, (tot[1] if len(tot) > 1 else 0) - sum(r["leads"] for r in out.values()))})
    return top


def yandex_phrases(m: Metrika, p: dict) -> dict:
    """Фразы Яндекса. Итог с группировкой не включает скрытые фразы – все визиты из Яндекса отдельным запросом."""
    engine = f"{DIM_ENGINE}=='yandex'"
    metrics = ["ym:s:visits", "ym:s:bounceRate"] + lead_metric()
    tot = m.stat(p["date1"], p["date2"], metrics, filters=engine).get("totals") or [0, 0]
    data = m.stat(p["date1"], p["date2"], metrics, [PHRASE], sort="-ym:s:visits", limit=100, filters=engine)
    found = [{"phrase": d[0].get("name") or "", "visits": v[0], "bounce": v[1], "leads": v[2] if len(v) > 2 else 0}
             for d, v in rows(data) if d and d[0].get("name")]
    return {"total": tot[0], "bounce": tot[1] if len(tot) > 1 else 0, "leads": tot[2] if len(tot) > 2 else 0,
            "hidden": max(0, tot[0] - sum(r["visits"] for r in found)), "rows": found[:20]}


def heat(m: Metrika, p: dict, min_visits: int = 30) -> dict:
    """Цели × источники: конверсия источника в каждую цель (несколько id цели – сумма)."""
    ids = [(key, gid) for key, (_, gids) in GOALS.items() for gid in gids]
    data = m.stat(p["date1"], p["date2"], ["ym:s:visits"] + [f"ym:s:goal{gid}reaches" for _, gid in ids], [DIM_SOURCE, DIM_ENGINE])
    buckets: dict = {}
    for dims, vals in rows(data):
        src = (dims[0].get("id") or "").lower()
        name = (ENGINE_NAMES.get((dims[1].get("id") or "").lower() if len(dims) > 1 else "", "Другие поисковики")
                if src == "organic" else SOURCE_NAMES.get(src, "Остальное"))
        acc = buckets.setdefault(name, {"visits": 0.0} | {k: 0.0 for k in GOALS})
        acc["visits"] += vals[0] if vals else 0
        for (key, _), value in zip(ids, vals[1:]):
            acc[key] += value
    sources = [n for n, a in sorted(buckets.items(), key=lambda x: -x[1]["visits"]) if a["visits"] >= min_visits]
    return {"goals": [GOALS[k][0] for k in GOALS], "sources": sources,
            "cells": [[buckets[s][k] / buckets[s]["visits"] * 100 if buckets[s]["visits"] else 0 for s in sources] for k in GOALS]}
