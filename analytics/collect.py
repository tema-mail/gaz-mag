"""Сбор разделов кабинета gaz-mag.ru (владелец 21.10.2026: «открыть ЛК все пункты, собрать актуальную информацию,
сделать все срезы кроме нейросетей»). Модули сбора – копии TEYES (providers/, без правок); здесь только подмена
констант сайта и выкладка файлов, которые отдаёт кабинету приёмник (server/lead.mjs, GET /api/admin/report/<раздел>).

Режимы (python3 collect.py <режим>):
  daily            – бесплатно, раз в день по cron: metrika + gsc-month + positions
  metrika          – «Метрика и каналы» (счётчик 97249745 + Search Console) → metrika.json в форме TEYES /api/metrika
  gsc-month        – месяц запросов Google из Search Console → months/google-0-<с>-<по>.json
  wm-import FILE   – месяц запросов Яндекса из кабинета Вебмастера (API Вебмастера не отвечает с 11.10) → months/
  serp --paid      – ПЛАТНО: снимок выдачи Новосибирска XMLRiver по phrases.json, Яндекс и Google до топ-20 → serp/<дата>.json
  positions        – собрать positions.json (форма TEYES /api/positions, без нейросетей) из months/ и serp/
  recommendations FILE – прогон агента улучшений (uluchsheniya.json) → recommendations.json
Ключи – SECRETS_DIR: yandex-token, gsc-sa.json, xmlriver.env. Ошибка доступа пишется в отчёт честной причиной.
"""
from __future__ import annotations

import datetime as dt
import glob
import json
import os
import pathlib
import re
import sys

from providers import gsc as gsc_mod
from providers import metrika as mk
from providers import metrika_report
from providers import xmlriver as xr_mod

HERE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ.get("OUT_DIR", HERE / "out"))
SECRETS = pathlib.Path(os.environ.get("SECRETS_DIR", HERE / "secrets"))
SITE_URL = "https://gaz-mag.ru/"  # ресурс Search Console – с префиксом в URL (создан 21.10.2026)
DOMAIN = "gaz-mag.ru"
mk.COUNTER = 97249745
# JS-цели сайта (src/lib/metrika.ts) → роли отчёта TEYES; номера целей берутся из счётчика по идентификатору
GOAL_ROLES = [("lead", "Отправка формы", "lead"), ("phone", "Клик по телефону", "phone_click"),
              ("messenger", "Переход в мессенджер", "messenger_click"), ("purchase", "Заказ из корзины", "order")]
gsc_mod.DOMAIN = xr_mod.DOMAIN = DOMAIN
REGIONS = {0: "Все", 65: "Новосибирск"}
BRAND = re.compile(r"газ[- ]?маг|gaz[- ]?mag|забабонова", re.I)
DIRECTIONS = [("Установка и монтаж", r"установ|монтаж|подключ|под ключ"), ("Котлы", r"котел|котёл|котл|навьен|navien|hubert|очаг"),
              ("Колонки, водонагреватели, бойлеры", r"колонк|водонагрев|бойлер"), ("Датчики, счётчики, дымоходы", r"счетчик|счётчик|датчик|дымоход")]
MONTH_GAP = dt.timedelta(days=28)
MAX_PAGES = 2  # топ-20, как в эталоне TEYES (экран «Позиции» считает топ-20)


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def read(path: pathlib.Path, fallback=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback


def write(path: pathlib.Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def secret(name: str) -> str:
    try:
        return (SECRETS / name).read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def direction(q: str) -> str:
    return next((name for name, rx in DIRECTIONS if re.search(rx, q, re.I)), "Прочее")


def gsc_client():
    raw = secret("gsc-sa.json")
    return gsc_mod.Gsc(json.loads(raw), SITE_URL) if raw else None


# --- Метрика и каналы --------------------------------------------------------------------------------------------
def metrika() -> None:
    path = OUT / "metrika.json"
    prev = read(path, {}) or {}
    try:
        m = mk.Metrika(secret("yandex-token"))
        goals = m.api(f"/management/v1/counter/{mk.COUNTER}/goals").get("goals", [])
        by_ident = {c.get("url"): g["id"] for g in goals for c in g.get("conditions", []) if g.get("type") == "action"}
        mk.GOALS = {role: (label, tuple(i for i in [by_ident.get(ident)] if i)) for role, label, ident in GOAL_ROLES}
        report = metrika_report.build(m, gsc_client())
        report = metrika_report.merge_previous(report, prev.get("report"))
        write(path, {"report": report, "saved_at": now(), "last_try": {"created_at": now(), "status": "ok", "error": None}})
        print("metrika: собран, ошибок блоков", len(report["errors"]))
    except Exception as exc:  # прежний отчёт остаётся, причина – в last_try (как db.save_metrika у TEYES)
        reason = str(exc) if isinstance(exc, (mk.MetrikaError, gsc_mod.GscError)) else f"сбой сборки ({type(exc).__name__})"
        write(path, {"report": prev.get("report"), "saved_at": prev.get("saved_at"),
                     "last_try": {"created_at": now(), "status": "error", "error": reason}})
        print("metrika: не собран –", reason)


# --- Позиции: месяцы Вебмастера и Search Console, снимок выдачи -------------------------------------------------
def save_month(engine: str, region: int, d1: str, d2: str, rows: list) -> None:
    clean = [[str(q).strip(), float(p), int(s), int(c)] for q, p, s, c in rows if str(q).strip() and float(p) > 0]
    write(OUT / "months" / f"{engine}-{region}-{d1}-{d2}.json",
          {"engine": engine, "region": region, "date_from": d1, "date_to": d2, "collected_at": now(), "rows": clean})
    print(f"месяц {engine} {region} {d1}…{d2}: {len(clean)} запросов")


def gsc_month() -> None:
    g = gsc_client()
    if g is None:
        return print("gsc-month: нет ключа")
    try:
        end = g.latest_day(dt.date.today())
        data = g.queries(end - dt.timedelta(days=29), end)
    except gsc_mod.GscError as exc:
        return print("gsc-month: не собран –", exc.message)
    if data["rows"]:
        save_month("google", 0, data["date_from"], data["date_to"],
                   [[r["query"], r["position"], r["impressions"], r["clicks"]] for r in data["rows"]])
    else:
        print("gsc-month: запросов за месяц нет")


def wm_import(file: str) -> None:
    d = json.loads(pathlib.Path(file).read_text(encoding="utf-8"))
    save_month("yandex", int(d.get("region", 0)), d["date_from"], d["date_to"], d["rows"])


def month_view(files: list[dict]) -> dict:
    """Последний месяц поисковика по региону и прошлый (кончился до начала текущего) – как positions.wm_months TEYES."""
    files.sort(key=lambda m: m["date_to"], reverse=True)
    cur = files[0]
    prev = next((m for m in files[1:] if m["date_to"] < cur["date_from"]), None)
    before = {r[0]: r for r in prev["rows"]} if prev else {}
    rows = []
    for q, p, shows, clicks in cur["rows"]:
        b = before.get(q)
        rows.append({"query": q, "position": p, "impressions": shows, "clicks": clicks, "prev_position": b[1] if b else None,
                     "prev_impressions": b[2] if b else None, "prev_clicks": b[3] if b else None,
                     "direction": direction(q), "brand": bool(BRAND.search(q))})
    have = {r["query"] for r in rows}
    gone = [{"query": q, "position": p, "impressions": s, "clicks": c, "brand": bool(BRAND.search(q))}
            for q, p, s, c in before.values() if q not in have]
    period = lambda m: {"date_from": m["date_from"], "date_to": m["date_to"], "collected_at": m["collected_at"]}
    return {"engine": cur["engine"], "region": cur["region"], "name": REGIONS.get(cur["region"], f"регион {cur['region']}"),
            **period(cur), "prev": period(prev) if prev else None, "rows": rows, "gone": gone}


def serp(paid: bool) -> None:
    if not paid:
        return print("serp: платный режим – только с флагом --paid (по слову владельца)")
    env = dict(line.split("=", 1) for line in secret("xmlriver.env").splitlines() if "=" in line)
    river = xr_mod.XMLRiver(env.get("XMLRIVER_USER", "").strip(), env.get("XMLRIVER_KEY", "").strip(), "/tmp/xmlriver.lock", domain=DOMAIN)
    phrases = read(HERE / "phrases.json", {})["rows"]
    out, spent, stop = [], 0, None
    for ph in phrases:
        row = {"query": ph["q"], "demand": round(ph["nso_quarter"] / 3) if ph.get("nso_quarter") is not None else None}
        for engine in ("yandex", "google"):
            spot, depth = None, 0
            for page in range(MAX_PAGES):
                if stop:
                    break
                try:
                    r = river.serp(ph["q"], engine, page)
                    spent += 1
                except xr_mod.ProviderError as exc:  # без повторов: ошибка – «нет данных», не 0
                    spent += 1
                    if exc.code in ("no_funds", "110"):
                        stop = f"{exc.code}: {exc.message}"
                    spot = {"error": exc.code}
                    break
                depth += r.get("checked_depth", 0)
                if r["status"] == "measured":
                    spot = {"position": r["value"], "depth": depth, "url": r.get("url"), "at": now()}
                    break
            if spot is None and not stop:
                spot = {"position": None, "depth": depth, "url": None, "at": now()}
            row[engine] = spot
        out.append(row)
    write(OUT / "serp" / f"{dt.date.today().isoformat()}.json", {"taken": now(), "requests": spent, "stopped": stop, "rows": out})
    print(f"serp: {len(out)} фраз, запросов {spent}{', остановлен: ' + stop if stop else ''}")


def nsk_view() -> dict:
    shots = [read(pathlib.Path(f)) for f in sorted(glob.glob(str(OUT / "serp" / "*.json")), reverse=True)]
    shots = [s for s in shots if s]
    if not shots:
        return {"rows": [], "measured_from": None, "measured_to": None}
    cur = shots[0]
    at = lambda s: dt.datetime.fromisoformat(s["taken"][:10])
    prev = next((s for s in shots[1:] if at(s) <= at(cur) - MONTH_GAP), None)
    old = {r["query"]: r for r in prev["rows"]} if prev else {}
    rows, dates = [], []
    for r in cur["rows"]:
        item = {"query": r["query"], "demand": r["demand"], "direction": direction(r["query"])}
        for e in ("yandex", "google"):
            s = r.get(e) or {}
            if "error" in s or not s:
                item[e] = None
                continue
            if s["position"] and s["position"] > 20:  # снимок 21.10 смотрел топ-30 – экран считает топ-20
                s = {**s, "position": None, "depth": 20}
            p = (old.get(r["query"]) or {}).get(e) or {}
            item[e] = {"position": s["position"], "depth": s["depth"], "url": s["url"], "at": s["at"],
                       "prev": p.get("position") if prev and "error" not in p else None, "had_prev": bool(prev and p and "error" not in p)}
            dates.append(s["at"])
        rows.append(item)
    rows.sort(key=lambda x: -(x["demand"] or 0))
    return {"rows": rows, "measured_from": min(dates) if dates else None, "measured_to": max(dates) if dates else None}


def positions() -> None:
    groups: dict = {}
    for f in glob.glob(str(OUT / "months" / "*.json")):
        m = read(pathlib.Path(f))
        if m and m["region"] in REGIONS:
            groups.setdefault((m["engine"], m["region"]), []).append(m)
    order = list(REGIONS)
    months = [month_view(groups[k]) for k in sorted(groups, key=lambda k: (order.index(k[1]), k[0]))]
    write(OUT / "positions.json", {"nsk": nsk_view(), "months": months, "google": None, "yandex": None, "ai": None, "built_at": now()})
    print("positions: месяцев", len(months))


def recommendations(file: str) -> None:
    d = json.loads(pathlib.Path(file).read_text(encoding="utf-8"))
    if not isinstance(d.get("items"), list):
        raise SystemExit("ожидается uluchsheniya.json с items")
    write(OUT / "recommendations.json", d)
    print("recommendations:", len(d["items"]))


def main(argv: list[str]) -> None:
    mode = argv[0] if argv else "daily"
    if mode == "daily":
        metrika(); gsc_month(); positions()
    elif mode == "metrika":
        metrika()
    elif mode == "gsc-month":
        gsc_month(); positions()
    elif mode == "wm-import":
        wm_import(argv[1]); positions()
    elif mode == "serp":
        serp("--paid" in argv); positions()
    elif mode == "positions":
        positions()
    elif mode == "recommendations":
        recommendations(argv[1])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
