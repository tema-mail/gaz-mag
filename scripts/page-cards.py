#!/usr/bin/env python3
"""Карточки страниц для админки gaz-mag («Страницы сайта» → клик по странице) – как в кабинете EV SIBIR.

Перенос с кабинета-стандарта Milovini (scripts/page-cards.py): код карточки не переписан – это модуль эталона
scripts/admin/page_seo_ev.py (копия ~/Documents/ev-sibir/server/page_seo.py), обёртка только подменяет данные под gaz-mag:
  • кластеры – по адресам gaz-mag (каталоги, карточки товара, подключение газа, установка котла, HUBERT, акции);
  • картинки – /img/…, с учётом подпапки;
  • локальное SEO – Новосибирск и Болотное (владелец 18.10.2026: «работает по Новосибирску и Болотному»).
Открыты «Что стоит в SEO», сниппет и название кластера; AEO, GEO, локальное SEO и спрос по запросам – под замком.

Запуск – после `astro build`, до scripts/lock-admin.mjs: python3 scripts/page-cards.py dist
"""
import html
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent / "admin"))
import page_seo_ev as ev  # noqa: E402

BASE = (os.environ.get("PUBLIC_BASE") or "/").rstrip("/")
SITE_URL = (os.environ.get("PUBLIC_SITE_URL") or "https://gaz-mag.ru").rstrip("/")
DOMAIN = SITE_URL.split("//", 1)[-1].split("/", 1)[0]
CITY, CITY_STEM = "Новосибирск", "новосибирск"
CITY2, CITY2_STEM = "Болотное", "болотн"

CATALOG_NAMES = {
    "gazovye-kotly": "Газовые котлы", "gazovye-kolonki": "Газовые колонки и водонагреватели",
    "elektricheskie-vodonagrevateli": "Электрические водонагреватели", "boylery-kosvennogo-nagreva": "Бойлеры косвенного нагрева",
    "tovary-dlya-otopleniya": "Товары для отопления", "datchiki-i-schetchiki-gaza": "Датчики загазованности, счётчики газа и дымоходы",
}
PAGE_NAMES = {"about": "О компании", "hubert-dy": "Акция на котёл HUBERT + монтаж"}


def cluster_of(route: str) -> str:
    """Кластер запросов страницы – по адресу (ЧПУ 18.10.2026: структура разделов = структура кластеров)."""
    parts = [p for p in route.split("/") if p]
    if not parts:
        return "Общий спрос: газовое оборудование в Болотном и Новосибирске"
    if parts[0] == "katalog":
        if len(parts) == 1:
            return "Хаб каталога: газовое оборудование в Болотном и Новосибирске"
        name = CATALOG_NAMES.get(parts[1], parts[1])
        if len(parts) >= 3:
            return f"Карточка товара ({name.lower()}): запросы по конкретной модели, мощности и цене – Болотное"
        return f"Каталог «{name}»: {name.lower()} купить в Новосибирске и Болотном"
    if parts[0] == "uslugi":
        if len(parts) == 1:
            return "Хаб услуг: подключение газа, монтаж отопления, установка котла"
        return {"podklyuchenie-gaza-i-montazh-otopleniya": "Услуга: подключение газа к частному дому и монтаж отопления",
                "ustanovka-gazovogo-kotla": "Услуга: установка и замена газового котла"}.get(parts[1], "Услуга")
    if parts[0] == "kotly-hubert":
        return "Бренд: котлы HUBERT – купить, цены, подбор"
    if parts[0] == "akcii":
        return "Акции и скидки на газовое оборудование"
    if parts[0] in ("politika-konfidencialnosti", "soglasie-na-obrabotku-dannyh", "oferta", "politika-cookie", "rekvizity"):
        return "Юридические документы – вне поискового продвижения"
    if parts[0] in ("spasibo", "souz"):
        return "Служебная страница – из поиска закрыта"
    if parts[0] == "karta-sayta":
        return "Карта сайта – навигация, вне продвижения"
    if parts[0] == "o-kompanii":
        return "Страница «О компании»: доверие и коммерческие вопросы перед покупкой"
    return "Страница сайта"


ev.cluster_of = cluster_of  # read_page эталона зовёт cluster_of из своего модуля


def read(site_root: str, route: str):
    """read_page эталона + подмена того, что у эталона зашито под EV (картинки и город)."""
    p = ev.read_page(site_root, route)
    if not p:
        return None
    rel = route.strip("/")
    src = (pathlib.Path(site_root) / rel / "index.html" if rel else pathlib.Path(site_root) / "index.html").read_text(encoding="utf-8", errors="ignore")
    imgs = []
    for tag in re.findall(r"<img\b[^>]*>", src):
        s = ev._attr(tag, "src")
        if "/img/" in s and not s.endswith(("no-photo.svg", "favicon.png")) and s not in [i["src"] for i in imgs]:
            imgs.append({"src": s, "alt": ev._attr(tag, "alt").strip()})
    p["images"] = imgs
    p["badge"] = next((i["src"] for i in imgs if "/img/p/" in i["src"]), imgs[0]["src"] if imgs else "")
    body = ev._text(re.sub(r"<(script|style)\b.*?</\1>", " ", src, flags=re.S)).lower()
    title, desc = p["title"].lower(), p["desc"].lower()
    local_ld = next((o for t, o in ev._ld_types(src) if t in ("Store", "LocalBusiness")), None)
    p["local"] = [
        ("Схема организации с адресом", bool(local_ld), "есть на странице" if local_ld else "разметка магазина – на главной"),
        (f"{CITY} в Title", CITY_STEM in title, "спрос по области – с «Новосибирск» (Вордстат 18.10.2026)"),
        (f"{CITY} в описании", CITY_STEM in desc, "показывается в выдаче"),
        (f"{CITY2} в тексте страницы", CITY2_STEM in body, f"адрес магазина; упоминаний: {body.count(CITY2_STEM)}"),
    ]
    return p


LOCK_CSS = """
.pd .lockzone{position:relative;border-radius:12px;overflow:hidden;margin-bottom:14px}
.pd .lockzone__blur{filter:blur(5px);opacity:.55;pointer-events:none;user-select:none}
.pd .lockzone__card{position:absolute;left:50%;top:70px;transform:translateX(-50%);width:min(520px,calc(100% - 28px));
 background:#fff;border:1px solid #e2e5e3;border-radius:16px;padding:24px 22px;box-shadow:0 20px 60px rgba(28,32,31,.14);text-align:center}
.pd .lockzone__card h2{margin:8px 0 6px;font-size:18px;font-weight:600}
.pd .lockzone__card p{margin:0 0 8px;font-size:14px;color:#1e1e1e}
.pd .lockzone__card ul{margin:0;padding-left:18px;text-align:left;font-size:13px;line-height:1.55;color:#55605d}
.pd .ghost{display:inline-block;height:10px;border-radius:5px;background:#d9dedc}
.pd .cluster-open{margin:0 0 6px}
.pd .snipchk{display:flex;gap:10px;font-size:13px;line-height:1.7}.pd .snipchk b{font-weight:600;min-width:200px}@media(max-width:700px){.pd .snipchk b{min-width:130px}}
.pd a.url{display:inline;border:0;padding:0;border-radius:0}
.pd .snip{display:grid;gap:3px;padding:14px 16px;border:1px solid #eceeed;border-radius:10px;background:#fafbfa}
.pd .snip__url{font-size:12px;color:#55605d}.pd .snip__t{font-size:18px;color:#1a0dab;line-height:1.3}.pd .snip__d{font-size:13.5px;color:#4d5156;line-height:1.5}
"""
LOCK_ICON = ('<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
             'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/>'
             '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.2" r="1.3"/><path d="M12 16.5v1.6"/></svg>')


def snippet_html(p) -> str:
    """Сниппет в поиске (как в редакторе товара): заголовок, адрес, описание – с длиной и местом, где обрежется.
    Владелец 18.10.2026: «важно, как отображается сниппет на всех страницах… SEO, дальше сниппет, а потом AEO, GEO»."""
    def cut(text: str, n: int) -> str:
        return text if len(text) <= n else text[: n - 1].rstrip() + "…"
    title, desc = p["title"] or "", p["desc"] or ""
    crumbs = " › ".join([DOMAIN] + [x for x in p["route"].split("/") if x][:2])
    def row(name, value, limit):
        n = len(value)
        state = ("пусто", "#b3261e") if not n else (f"{n} знаков – обрежется после {limit}", "#a86b00") if n > limit else (f"{n} знаков – помещается", "#136c2e")
        return f'<div class="snipchk"><b>{name}</b><span style="color:{state[1]}">{state[0]}</span></div>'
    return (f'<div class="panel"><h2>Как выглядит в поиске (сниппет)</h2>'
            f'<div class="snip"><span class="snip__url">{html.escape(crumbs)}</span>'
            f'<span class="snip__t">{html.escape(cut(title, 60)) or "<i>без заголовка</i>"}</span>'
            f'<span class="snip__d">{html.escape(cut(desc, 160)) or "<i>описание не задано – поисковик возьмёт кусок текста страницы</i>"}</span></div>'
            f'<div style="margin-top:10px">{row("Заголовок (Title)", title, 60)}{row("Описание (Description)", desc, 160)}</div>'
            f'<p style="margin:6px 0 0;font-size:12.5px;color:#77817e">Google показывает около 60 знаков заголовка и 160 – описания; Яндекс – до 70 и 160. '
            f'Поисковик может заменить описание фрагментом текста, если сочтёт его точнее.</p></div>')


def card_html(p) -> str:
    """Карточка эталона, разрезанная по панелям: «Что стоит в SEO» – открыта, кластер – открыт названием,
    остальное – под замком (размыто, без цифр)."""
    body = ev.detail_body(p, SITE_URL)
    panels = re.split(r'(?=<div class="panel">)', body)
    head, seo = panels[0], panels[1]
    locked = "".join(panels[2:-1] + [re.sub(r"</div></main>\s*$", "", panels[-1])])
    # таблица спроса и показов – без цифр и без пустых «—»: в размытом виде показываем каркас строк
    locked = re.sub(r"<table class=\"kwt\">.*?</table>", lambda m: re.sub(r"<td[^>]*>.*?</td>", '<td><span class="ghost" style="width:70%"></span></td>', m.group(0), flags=re.S), locked, flags=re.S)
    cluster = html.escape(p["cluster"])
    head = head.replace('href="/admin"', f'href="{BASE}/admin/"')
    open_cluster = (f'<div class="panel"><h2>Кластер и запросы</h2>'
                    f'<div class="fld cluster-open"><div class="k">Кластер</div><div class="v">{cluster}</div></div>'
                    f'<p style="margin:6px 0 0;font-size:13px;color:#55605d">Запросы кластера, спрос в Яндексе по Новосибирску и показы в Яндексе и Google за месяц – в расширенном разборе ниже.</p></div>')
    lock = (f'<div class="lockzone"><div class="lockzone__blur" aria-hidden="true">{locked}</div>'
            f'<div class="lockzone__card">{LOCK_ICON}<h2>Расширенный SEO-разбор страницы: раздел закрыт</h2>'
            f'<p>Доступно клиентам на постоянном SEO-ведении.</p><ul>'
            f'<li>Запросы кластера: спрос в Яндексе по Новосибирской области и показы в Яндексе и Google за месяц</li>'
            f'<li>Прямые ответы поисковика (AEO): быстрый ответ, расширенный сниппет, «люди спрашивают»</li>'
            f'<li>Цитируемость в ответах нейросетей (GEO): Яндекс Нейро, Google AI Overviews, ChatGPT, Perplexity</li>'
            f'<li>Локальное SEO: привязка страницы к Новосибирску и Болотному</li></ul></div></div>')
    out = head + seo + snippet_html(p) + open_cluster + lock + "</div></main>"
    # город эталона EV – Новосибирск – совпадает с городом gaz-mag: замен не нужно
    return out.replace("—", "–")


def routes(site_root: pathlib.Path):
    for f in sorted(site_root.rglob("index.html")):
        rel = f.parent.relative_to(site_root).as_posix()
        if rel.startswith("admin") or rel.startswith("_astro"):
            continue
        yield "/" if rel == "." else f"/{rel}/"


def main(site_root: str) -> int:
    root = pathlib.Path(site_root)
    tpl_file = root / "admin" / "index.html"
    tpl = tpl_file.read_text(encoding="utf-8")
    if 'id="lock-form"' in tpl:
        sys.exit("page-cards: админка уже закрыта замком – запускать до lock-admin.mjs")
    m0, m1 = tpl.index("<main>"), tpl.index("</main>") + len("</main>")
    style = f"<style>{ev.CSS}{LOCK_CSS}</style>"
    done = 0
    for route in routes(root):
        p = read(site_root, route)
        if not p:
            continue
        page = tpl[:m0] + card_html(p) + tpl[m1:]
        page = re.sub(r"<title>.*?</title>", f"<title>{html.escape(p['title'] or route)} – разбор страницы</title>", page, count=1, flags=re.S)
        page = page.replace("</head>", style + "</head>", 1)
        out = root / "admin" / "page" / route.strip("/") / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page, encoding="utf-8")
        done += 1
    print(f"page-cards: карточек страниц – {done}")
    return done


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Использование: python3 scripts/page-cards.py dist")
    if not main(sys.argv[1]):
        sys.exit("page-cards: в сборке нет страниц")
