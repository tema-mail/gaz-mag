"""Клиент XMLRiver: Wordstat, выдача Яндекса и Google по Новосибирску, баланс и цены.

Платные вызовы (wordstat, serp) идут строго в один поток: flock на файле канала, иначе
провайдер отвечает ошибкой 110. Баланс и цена – бесплатные. Ключ и user никогда не попадают
в сообщения об ошибках. Ошибка или пустой ответ – исключение ProviderError, а не ноль.
Параметры выдачи Google (loc 1011984, country 2643, страницы с 1) – как в SEO-пульсе (app.py:1486-1502).
"""

from __future__ import annotations

import fcntl
import http.client
import json
import math
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Callable

BASE_URL = "https://xmlriver.com/"
DOMAIN = "teyes-sibir.ru"
PAGE_SIZE = 10
TIMEOUT_SECONDS = 45
RESPONSE_LIMIT = 8_000_000
DEMAND_REGIONS = {"demand_all": None, "demand_rf": 225, "demand_nsk": 65}
ENGINES = ("wordstat", "yandex", "google")

Fetch = Callable[[str, int], bytes]


class ProviderError(Exception):
    """code: «110» (канал занят), «no_funds», «empty», «bad_response», «http_<код>», «network», «timeout»."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code, self.message = code, message


def default_fetch(url: str, timeout: int) -> bytes:
    context = ssl.create_default_context()
    request = urllib.request.Request(url, headers={"User-Agent": "TEYES-SEO-Admin/1"})
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        raw = response.read(RESPONSE_LIMIT + 1)
    if len(raw) > RESPONSE_LIMIT:
        raise ProviderError("bad_response", "ответ больше допустимого размера")
    return raw


def number(value) -> int:
    return int(float(str(value if value is not None else "").replace(" ", "").replace(" ", "") or "nan"))


def recent_full_quarter(today: date) -> tuple[date, date]:
    """Три последних полных календарных месяца (как в сборщике августа)."""
    first_this_month = today.replace(day=1)
    end = date.fromordinal(first_this_month.toordinal() - 1)
    month, year = end.month - 2, end.year
    if month <= 0:
        month, year = month + 12, year - 1
    return date(year, month, 1), end


def classify_error(code, text: str) -> str:
    code = str(code or "").strip()
    lowered = (text or "").lower()
    if "средств" in lowered or "баланс" in lowered or "funds" in lowered:
        return "no_funds"
    return code or "provider"


class XMLRiver:
    def __init__(self, user: str, key: str, lock_path: str | Path, fetch: Fetch = default_fetch,
                 domain: str = DOMAIN, timeout: int = TIMEOUT_SECONDS):
        if not user or not key:
            raise ValueError("Нет реквизитов XMLRiver (XMLRIVER_USER, XMLRIVER_KEY)")
        self._user, self._key = user, key
        self._fetch, self._timeout = fetch, timeout
        self.lock_path = Path(lock_path)
        self.domain = domain.lower().removeprefix("www.")

    @classmethod
    def from_env(cls, fetch: Fetch = default_fetch) -> "XMLRiver":
        return cls(os.environ.get("XMLRIVER_USER", ""), os.environ.get("XMLRIVER_KEY", ""),
                   os.environ.get("XMLRIVER_LOCK", "data/xmlriver.lock"), fetch)

    def _scrub(self, text: str) -> str:
        for secret in (self._key, urllib.parse.quote(self._key), urllib.parse.quote_plus(self._key), self._user):
            if secret:
                text = text.replace(secret, "***")
        return text

    def _get(self, path: str, params: dict) -> bytes:
        query = urllib.parse.urlencode({"user": self._user, "key": self._key, **params})
        # Исключение собирается внутри except, а бросается после него: так исходная ошибка с URL
        # (а в нём ключ) не прицепится к нашему исключению даже через __context__.
        error = None
        try:
            return self._fetch(f"{BASE_URL}{path}?{query}", self._timeout)
        except ProviderError as exc:
            error = ProviderError(exc.code, self._scrub(exc.message))
        except urllib.error.HTTPError as exc:
            error = ProviderError(f"http_{exc.code}", self._scrub(str(exc.reason)))
        except TimeoutError:
            error = ProviderError("timeout", "провайдер не ответил вовремя; исход запроса неизвестен")
        except (urllib.error.URLError, OSError, http.client.HTTPException) as exc:
            error = ProviderError("network", self._scrub(str(getattr(exc, "reason", exc)) or type(exc).__name__))
        raise error

    @contextmanager
    def _channel(self):
        """Один платный запрос за раз на весь сервер (между раном и ручными вызовами)."""
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        with self.lock_path.open("a+") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)

    def account(self) -> dict:
        """Бесплатно: баланс и цена за 1000 запросов по движкам."""
        try:
            balance = float(self._get("api/get_balance/", {}).decode("utf-8").strip().replace(",", "."))
            costs = {engine: float(self._get(f"api/get_cost/{engine}/", {}).decode("utf-8").strip().replace(",", "."))
                     for engine in ENGINES}
        except ValueError:
            raise ProviderError("bad_response", "баланс или цена пришли не числом") from None
        if not math.isfinite(balance) or any(not math.isfinite(c) or c <= 0 for c in costs.values()):
            raise ProviderError("bad_response", f"непригодный баланс или цена: {balance}, {costs}")
        return {"balance_rub": balance, "cost_per_1000": costs}

    def wordstat(self, phrase: str, metric: str, today: date) -> dict:
        """Платно: широкая частотность Wordstat в регионе метрики и помесячная история за квартал."""
        start, end = recent_full_quarter(today)
        params = {"query": phrase, "pagetype": "history", "period": "month",
                  "start": start.strftime("%d.%m.%Y"), "end": end.strftime("%d.%m.%Y")}
        if DEMAND_REGIONS[metric] is not None:
            params["regions"] = DEMAND_REGIONS[metric]
        with self._channel():
            raw = self._get("wordstat/new/json", params)
        try:
            data = json.loads(raw)
        except ValueError:  # не JSON или не UTF-8
            raise ProviderError("bad_response", "Wordstat вернул не JSON") from None
        if not isinstance(data, dict) or data.get("error") or "totalValue" not in data:
            text = str(data.get("error") or "нет totalValue") if isinstance(data, dict) else "неожиданный ответ"
            raise ProviderError(classify_error(data.get("code") if isinstance(data, dict) else "", text),
                                self._scrub(text))
        try:
            total = number(data["totalValue"])
            months = [{"label": point.get("text"), "value": number(point.get("absoluteValue"))}
                      for point in (data.get("graph") or {}).get("tableData") or []]
        except (ValueError, TypeError, AttributeError, OverflowError):
            raise ProviderError("bad_response", "числа Wordstat не разобраны") from None
        if total < 0:
            raise ProviderError("bad_response", "отрицательная частотность")
        return {"status": "measured", "value": total, "total_value_raw": total, "months": months,
                "request_params": {"provider": "xmlriver_wordstat", "regions": DEMAND_REGIONS[metric],
                                   "pagetype": "history", "period": "month", "start": start.isoformat(),
                                   "end": end.isoformat(), "match_type": "broad"}}

    def serp(self, phrase: str, engine: str, page: int) -> dict:
        """Платно: одна страница органической выдачи (10 позиций) Новосибирска, desktop."""
        if engine == "yandex":
            path = "search_yandex/xml"
            params = {"query": phrase, "lr": 65, "groupby": PAGE_SIZE, "page": page, "device": "desktop",
                      "domain": "ru", "lang": "ru"}
        elif engine == "google":
            path = "search/xml"
            params = {"query": phrase, "loc": 1011984, "country": 2643, "lr": "RU", "domain": 10,
                      "groupby": PAGE_SIZE, "page": page + 1, "device": "desktop"}
        else:
            raise ValueError(f"Неизвестный поисковик: {engine}")
        with self._channel():
            raw = self._get(path, params)
        try:
            root = ET.fromstring(raw)
        except (ET.ParseError, ValueError):
            raise ProviderError("bad_response", "выдача пришла не XML") from None
        error = root.find(".//error")
        if error is not None:
            text = (error.text or "ошибка без текста").strip()
            raise ProviderError(classify_error(error.get("code"), text), self._scrub(text))
        offset, organic = page * PAGE_SIZE, 0
        for group in root.findall(".//group"):
            for doc in group.findall("./doc"):
                if (doc.findtext("contenttype") or "organic").strip().lower() != "organic":
                    continue
                organic += 1
                url = (doc.findtext("url") or "").strip()
                host = (urllib.parse.urlparse(url).hostname or "").lower().removeprefix("www.")
                if host == self.domain or host.endswith("." + self.domain):
                    # value – абсолютная позиция (страница × 10 + номер); checked_depth – сколько органики
                    # проверено на ЭТОЙ странице (глубину по всем страницам суммирует runs.complete_item).
                    return {"status": "measured", "value": offset + organic, "checked_depth": organic, "url": url,
                            "request_params": {"provider": f"xmlriver_{engine}", "page_index": page, **params}}
        if organic == 0:
            raise ProviderError("empty", "в выдаче нет органических результатов")
        return {"status": "not_found", "checked_depth": organic,
                "request_params": {"provider": f"xmlriver_{engine}", "page_index": page, **params}}
