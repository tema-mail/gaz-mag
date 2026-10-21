"""Клиент Google Search Console: запросы сайта – показы, клики, CTR, средняя позиция.

Бесплатно. Доступ – сервисный аккаунт (JSON-ключ, подключён владельцем 12.10.2026, свойство
sc-domain:teyes-sibir.ru, права «ограниченные»). Токен – JWT RS256 → oauth2 (срок 1 час).
Окна: день, 7, 30, 90 дней от последнего дня, за который Google уже отдал данные (задержка 2–3 дня).
CTR приводится к процентам, как в выгрузках и у Вебмастера. Отказ – GscError, а не нули.
"""

from __future__ import annotations

import base64
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Callable

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

API = "https://www.googleapis.com/webmasters/v3"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
DOMAIN = "teyes-sibir.ru"
ROW_LIMIT = 25000
MAX_ROWS = 50000
TIMEOUT_SECONDS = 30
WINDOW_DAYS = {"day": 1, "week": 7, "month": 30, "quarter": 90}

Fetch = Callable[[str, bytes | None, dict, int], bytes]


class GscError(Exception):
    """code: token_rejected | no_access | http_<код> | network | bad_response."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code, self.message = code, message


def default_fetch(url: str, data: bytes | None, headers: dict, timeout: int) -> bytes:
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
        return response.read()


def _b64(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


class Gsc:
    def __init__(self, service_account: dict, site_url: str = "", domain: str = DOMAIN, fetch: Fetch = default_fetch,
                 clock: Callable[[], float] = time.time):
        if service_account.get("type") != "service_account" or not service_account.get("private_key"):
            raise ValueError("Ключ GSC не похож на ключ сервисного аккаунта")
        self._sa, self._fetch, self._clock = service_account, fetch, clock
        self.site_url, self.domain = site_url.strip(), domain
        self._token: tuple[str, float] | None = None

    @classmethod
    def from_env(cls, fetch: Fetch = default_fetch) -> "Gsc":
        path = os.environ.get("GSC_SERVICE_ACCOUNT_FILE", "")
        if not path or not Path(path).is_file():
            raise ValueError("Нет ключа сервисного аккаунта GSC (GSC_SERVICE_ACCOUNT_FILE)")
        return cls(json.loads(Path(path).read_text()), os.environ.get("GSC_SITE_URL", ""), fetch=fetch)

    def _call(self, url: str, data: bytes | None, headers: dict) -> dict:
        error = None
        try:
            raw = self._fetch(url, data, headers, TIMEOUT_SECONDS)
        except urllib.error.HTTPError as exc:
            code = {401: "token_rejected", 403: "no_access"}.get(exc.code, f"http_{exc.code}")
            error = GscError(code, "Google отклонил ключ или доступа к сайту нет" if exc.code in (401, 403)
                             else f"Google вернул HTTP {exc.code}")
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            error = GscError("network", f"нет связи с Google: {type(exc).__name__}")
        if error:
            raise error  # вне except: исходная ошибка с заголовками не цепляется
        try:
            return json.loads(raw)
        except ValueError:
            raise GscError("bad_response", "Google ответил не JSON") from None

    def token(self) -> str:
        now = self._clock()
        if self._token and self._token[1] - 60 > now:
            return self._token[0]
        header = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
        claims = _b64(json.dumps({"iss": self._sa["client_email"], "scope": SCOPE, "aud": self._sa["token_uri"],
                                  "iat": int(now), "exp": int(now) + 3600}).encode())
        try:
            key = serialization.load_pem_private_key(self._sa["private_key"].encode(), password=None)
        except ValueError:
            raise GscError("token_rejected", "закрытый ключ сервисного аккаунта не читается") from None
        signature = _b64(key.sign(header + b"." + claims, padding.PKCS1v15(), hashes.SHA256()))
        body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                       "assertion": (header + b"." + claims + b"." + signature).decode()}).encode()
        payload = self._call(self._sa["token_uri"], body, {"Content-Type": "application/x-www-form-urlencoded"})
        if "access_token" not in payload:
            raise GscError("token_rejected", "Google не выдал токен")
        self._token = (payload["access_token"], now + float(payload.get("expires_in", 3600)))
        return self._token[0]

    def _api(self, path: str, body: dict | None = None) -> dict:
        headers = {"Authorization": f"Bearer {self.token()}", "Accept": "application/json"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        return self._call(f"{API}{path}", data, headers)

    def resolve_site(self) -> str:
        """Свойство сайта: заданное в окружении или найденное по домену (предпочтительно sc-domain:)."""
        if self.site_url:
            return self.site_url
        sites = [s.get("siteUrl", "") for s in self._api("/sites").get("siteEntry", [])]
        ours = [s for s in sites if self.domain in s]
        if not ours:
            raise GscError("no_access", f"сайт {self.domain} не найден среди свойств сервисного аккаунта")
        self.site_url = next((s for s in ours if s.startswith("sc-domain:")), ours[0])
        return self.site_url

    def _query(self, body: dict) -> list[dict]:
        path = f"/sites/{urllib.parse.quote(self.resolve_site(), safe='')}/searchAnalytics/query"
        return self._api(path, body).get("rows") or []

    def latest_day(self, today: date) -> date:
        rows = self._query({"startDate": (today - timedelta(days=10)).isoformat(), "endDate": today.isoformat(),
                            "dimensions": ["date"], "rowLimit": 20})
        days = sorted(r["keys"][0] for r in rows if r.get("keys"))
        try:
            return date.fromisoformat(days[-1]) if days else today - timedelta(days=3)
        except ValueError:
            raise GscError("bad_response", f"непонятная дата в ответе: {days[-1]!r}") from None

    def queries(self, date_from: date, date_to: date) -> dict:
        rows, start = [], 0
        while start < MAX_ROWS:
            page = self._query({"startDate": date_from.isoformat(), "endDate": date_to.isoformat(),
                                "dimensions": ["query"], "rowLimit": ROW_LIMIT, "startRow": start})
            for item in page:
                try:
                    shows, clicks = int(item["impressions"]), int(item["clicks"])
                    rows.append({"query": item["keys"][0].strip(), "impressions": shows, "clicks": clicks,
                                 "ctr": round(float(item.get("ctr", 0)) * 100, 2),
                                 "position": round(float(item["position"]), 2)})
                except (KeyError, IndexError, TypeError, ValueError):
                    raise GscError("bad_response", "строка запроса не разобрана") from None
            start += len(page)
            if len(page) < ROW_LIMIT:
                break
        return {"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "rows": rows}

    def windows(self, today: date) -> dict[str, dict]:
        """Все окна от последнего дня с данными. Отказ доступа прерывает всё; сбой окна – только это окно."""
        anchor = self.latest_day(today)
        result: dict[str, dict] = {}
        for window, days in WINDOW_DAYS.items():
            try:
                result[window] = self.queries(anchor - timedelta(days=days - 1), anchor)
            except GscError as exc:
                if exc.code in ("token_rejected", "no_access"):
                    raise
                result[window] = {"error": exc.code, "message": exc.message}
        return result
