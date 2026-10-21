"""Отчёт «Метрика и каналы» (макет утверждён владельцем 14.10.2026: claude.ai/artifact/WtEehZNxGbygqodQbHDUFL).

build() опрашивает Метрику и Search Console и возвращает весь отчёт одним словарём (worker кладёт его в БД,
страница читает готовое). Вкладка «Показатели» – неделя, месяц, квартал, год без сравнения; «Сравнение» –
год к году (минус 364 дня – те же дни недели), месяц к месяцу и квартал к кварталу (полные), неделя к неделе.
Каждый блок в своём try: сбой блока – None и строка в errors, остальное работает; Search Console – отдельно
по каждой вкладке, его сбой не трогает цифры Метрики.
"""
from __future__ import annotations

import datetime as dt
import statistics
from zoneinfo import ZoneInfo

from . import metrika as mk
from .gsc import Gsc, GscError

PERIODS = [("week", "Неделя", 7), ("month", "Месяц", 30), ("quarter", "Квартал", 91), ("year", "Год", 365)]
MODES = [("yoy", "Год к году", "Год назад"), ("mom", "Месяц к месяцу", "Месяц назад"),
         ("qoq", "Квартал к кварталу", "Квартал назад"), ("wow", "Неделя к неделе", "Неделя назад")]
LAG_MIN_MEDIAN = 20  # маленький сайт: провал в один день – норма, отставание не ищем
GSC_LAG_DAYS = 3  # последние 2–3 дня Google ещё досчитывает
TOP_QUERIES = 20
D = dt.date


def last_full_day(m: mk.Metrika, today: D) -> tuple[D, list[str]]:
    """Последний полный день: день меньше трети медианы прошлых 7 дней – недосчитан, конец уходит назад."""
    start = today - dt.timedelta(days=21)
    data = m.stat(start.isoformat(), (today - dt.timedelta(days=1)).isoformat(), ["ym:s:visits"], ["ym:s:date"],
                  sort="ym:s:date", limit=40)
    by_day = {d[0].get("name"): v[0] for d, v in mk.rows(data)}
    visits = [by_day.get((start + dt.timedelta(days=i)).isoformat(), 0) for i in range(21)]
    end, lagged = today - dt.timedelta(days=1), []
    while len(visits) > 7:
        med = statistics.median(visits[-8:-1])
        if med < LAG_MIN_MEDIAN or visits[-1] >= med / 3:
            break
        lagged.append(end.isoformat())
        visits.pop()
        end -= dt.timedelta(days=1)
    return end, lagged


def _month(d: D) -> tuple[D, D]:
    first = d.replace(day=1)
    return first, (first + dt.timedelta(days=32)).replace(day=1) - dt.timedelta(days=1)


def _quarter_start(d: D) -> D:
    return D(d.year, 3 * ((d.month - 1) // 3) + 1, 1)


def compare_ranges(end: D) -> dict:
    out = {"yoy": (end - dt.timedelta(days=27), end, end - dt.timedelta(days=27 + 364), end - dt.timedelta(days=364))}
    m1, m2 = _month(end)
    if m2 != end:
        m1, m2 = _month(m1 - dt.timedelta(days=1))
    p1, p2 = _month(m1 - dt.timedelta(days=1))
    out["mom"] = (m1, m2, p1, p2)
    q1 = _quarter_start(end)
    q2 = _month(D(q1.year, q1.month + 2, 1))[1]
    if q2 != end:
        q2 = q1 - dt.timedelta(days=1)
        q1 = _quarter_start(q2)
    pq2 = q1 - dt.timedelta(days=1)
    out["qoq"] = (q1, q2, _quarter_start(pq2), pq2)
    out["wow"] = (end - dt.timedelta(days=6), end, end - dt.timedelta(days=13), end - dt.timedelta(days=7))
    return {k: {"date1": a.isoformat(), "date2": b.isoformat(), "prev1": c.isoformat(), "prev2": d.isoformat()}
            for k, (a, b, c, d) in out.items()}


def period_ranges(end: D) -> dict:
    return {k: {"label": label, "date1": (end - dt.timedelta(days=n - 1)).isoformat(), "date2": end.isoformat()}
            for k, label, n in PERIODS}


def _both(p: dict) -> tuple[dict, dict]:
    return {"date1": p["date1"], "date2": p["date2"]}, {"date1": p["prev1"], "date2": p["prev2"]}


def cmp_summary(m: mk.Metrika, p: dict) -> dict:
    now, prev = _both(p)
    return {"now": mk.summary(m, now), "prev": mk.summary(m, prev)}


def cmp_channels(m: mk.Metrika, p: dict) -> list[dict]:
    now, prev = _both(p)
    rows_now = mk.channels(m, now)
    before = {r["name"]: r["visits"] for r in mk.channels(m, prev)}
    names = [r["name"] for r in rows_now] + [n for n in before if n not in {r["name"] for r in rows_now}]
    by = {r["name"]: r for r in rows_now}
    return [{"name": n, "visits": by.get(n, {}).get("visits", 0), "leads": by.get(n, {}).get("leads", 0),
             "prev_visits": before.get(n, 0)} for n in names]


def cmp_series(m: mk.Metrika, p: dict) -> dict:
    now, prev = _both(p)
    return {"now": mk.search_series(m, now), "prev": mk.search_series(m, prev)}


def cmp_pages(m: mk.Metrika, p: dict) -> dict:
    now, prev = _both(p)
    a = {r["path"]: (r["yandex"] or 0) + (r["google"] or 0) + (r["other"] or 0) for r in mk.search_pages(m, now)}
    b = {r["path"]: (r["yandex"] or 0) + (r["google"] or 0) + (r["other"] or 0) for r in mk.search_pages(m, prev)}
    diff = [{"path": k, "diff": a.get(k, 0) - b.get(k, 0)} for k in (set(a) | set(b)) - {mk.HIDDEN}]
    return {"entry": [{"path": k, "visits": v, "prev": b.get(k, 0)} for k, v in sorted(a.items(), key=lambda x: -x[1])[:10]],
            "lost": sorted([d for d in diff if d["diff"] < 0], key=lambda d: d["diff"])[:8],
            "won": sorted([d for d in diff if d["diff"] > 0], key=lambda d: -d["diff"])[:8]}


def cmp_heat(m: mk.Metrika, p: dict) -> dict:
    return mk.heat(m, {"date1": p["date1"], "date2": p["date2"]})


PERIOD_BLOCKS = [("summary", mk.summary), ("channels", mk.channels), ("series", mk.search_series),
                 ("pages", mk.search_pages), ("phrases", mk.yandex_phrases), ("heat", mk.heat)]
CMP_BLOCKS = [("summary", cmp_summary), ("channels", cmp_channels), ("series", cmp_series), ("pages", cmp_pages),
              ("heat", cmp_heat)]


def _gsc_totals(gsc: Gsc, a: str, b: str) -> dict:
    r = (gsc._query({"startDate": a, "endDate": b, "dataState": "all"}) or [{}])[0]  # итоги без группировки
    return {"clicks": r.get("clicks", 0), "impressions": r.get("impressions", 0), "ctr": r.get("ctr", 0) * 100,
            "position": r.get("position")}


def gsc_report(gsc: Gsc, ranges: dict, today: D) -> dict:
    """Итоги и топ запросов Google; если период заходит на недосчитанные дни – оба периода сдвигаются назад."""
    out = {}
    for key, p in ranges.items():
        over = (D.fromisoformat(p["date2"]) - (today - dt.timedelta(days=GSC_LAG_DAYS))).days
        p = {k: (D.fromisoformat(p[k]) - dt.timedelta(days=max(over, 0))).isoformat()
             for k in ("date1", "date2", "prev1", "prev2") if k in p}
        compare = "prev1" in p
        q_now = gsc._query({"startDate": p["date1"], "endDate": p["date2"], "dimensions": ["query"], "rowLimit": 250,
                            "dataState": "all"})  # как у итогов, иначе цифры разойдутся
        q_prev = ({r["keys"][0]: r["position"] for r in gsc._query({"startDate": p["prev1"], "endDate": p["prev2"],
                                                                     "dimensions": ["query"], "rowLimit": 1000,
                                                                     "dataState": "all"})}
                  if compare else {})
        top = sorted(q_now, key=lambda r: (-r["clicks"], -r["impressions"]))[:TOP_QUERIES]
        out[key] = {"dates": p, "now": _gsc_totals(gsc, p["date1"], p["date2"]),
                    "prev": _gsc_totals(gsc, p["prev1"], p["prev2"]) if compare else None,
                    "queries": [{"query": r["keys"][0], "clicks": r["clicks"], "impressions": r["impressions"],
                                 "ctr": r["ctr"] * 100, "position": r["position"], "prev_position": q_prev.get(r["keys"][0])}
                                for r in top]}
    return out


def build(m: mk.Metrika, gsc: Gsc | None, now: dt.datetime | None = None) -> dict:
    """Весь отчёт. Если не пришёл ни один блок Метрики – исключение (старый отчёт в БД остаётся)."""
    tz = m.timezone()
    started = now or dt.datetime.now(dt.timezone.utc)
    today = started.astimezone(ZoneInfo(tz)).date()
    end, lagged = last_full_day(m, today)
    cmp = compare_ranges(end)
    if lagged:  # месяц и квартал не двигаем – только год к году и неделю
        normal = compare_ranges(today - dt.timedelta(days=1))
        cmp["mom"], cmp["qoq"] = normal["mom"], normal["qoq"]
    ind = period_ranges(end)
    report = {"fetched_at": started.isoformat(timespec="seconds"), "tz": tz, "counter": mk.COUNTER,
              "lead_label": mk.GOALS["lead"][0], "lag_days": lagged, "periods": {}, "modes": {}, "errors": []}
    for key, r in ind.items():
        report["periods"][key] = dict(r)
        for name, fn in PERIOD_BLOCKS:
            try:
                report["periods"][key][name] = fn(m, r)
            except mk.MetrikaError as exc:
                report["periods"][key][name] = None
                report["errors"].append(f"{r['label']}, {name}: {exc}")
    for key, label, prev_label in MODES:
        p = cmp[key]
        report["modes"][key] = dict(p, label=label, prev_label=prev_label)
        for name, fn in CMP_BLOCKS:
            try:
                report["modes"][key][name] = fn(m, p)
            except mk.MetrikaError as exc:
                report["modes"][key][name] = None
                report["errors"].append(f"{label}, {name}: {exc}")
    for out_key, ranges, tab in (("gsc_periods", ind, "показатели"), ("gsc", cmp, "сравнение")):
        try:
            if gsc is None:
                raise GscError("no_key", "нет ключа Search Console")
            report[out_key] = gsc_report(gsc, ranges, today)
        except (GscError, KeyError, ValueError) as exc:
            report[out_key] = None
            report["errors"].append(f"Search Console ({tab}): {getattr(exc, 'message', None) or type(exc).__name__}")
    blocks = [v.get(n) for v in list(report["periods"].values()) + list(report["modes"].values()) for n in ("summary", "channels")]
    if all(b is None for b in blocks):
        raise mk.MetrikaError(report["errors"][0] if report["errors"] else "Метрика не отдала данные")
    return report


def merge_previous(report: dict, prev: dict | None) -> dict:
    """Частичный сбой (429 посреди сбора, сбой Google) не подменяет полный отчёт почти пустым: не пришедший
    блок берётся из прошлого удачного отчёта, в stale – путь блока и дата отчёта, откуда он взят (страница
    помечает такой блок). partial – были пропуски: расписание повторит сбор в тот же день."""
    prev = prev or {}
    old_stale = prev.get("stale") or {}
    missing, stale = [], {}

    def fill(path: str, old):
        missing.append(path)
        if old is not None:
            stale[path] = old_stale.get(path, prev.get("fetched_at"))
        return old

    for part in ("periods", "modes"):
        for key, blocks in report[part].items():
            old = (prev.get(part) or {}).get(key) or {}
            for name in [n for n, v in blocks.items() if v is None]:
                blocks[name] = fill(f"{part}.{key}.{name}", old.get(name))
    for name in ("gsc_periods", "gsc"):
        if report.get(name) is None:
            report[name] = fill(name, prev.get(name))
    report["partial"], report["stale"] = bool(missing), stale
    return report
