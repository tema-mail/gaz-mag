import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Product } from '../../lib/catalog';
import ProductEditor, { type AdmList, type AdmProduct } from './ProductEditor';
import CsvImport from './CsvImport';
import GhConnect from './GhConnect';
import { PRODUCTS_PATH, UPLOADS_DIR, buildOf, commit, humanError, fileToBase64, getToken, readJson, slugify, type FileChange } from './gh';

// Раздел «Товары» – перенос с кабинета-стандарта Milovini (эталон Elite Rose, магазин Тильды). С подключённым ключом
// GitHub изменения сохраняются в src/data/products.json одним коммитом «Админка: …», сайт пересобирается и выкладывается
// на Beget (~1–2 минуты). Без ключа – только просмотр.
// Отличия по данным gaz-mag: «разделы» – списки товара (6 каталогов, «Специальные предложения», «HUBERT»), они заданы
// в коде сайта, поэтому «+ Добавить раздел» нет; у товаров есть варианты и характеристики (см. ProductEditor).

const fmt = (n: number | null) => (n == null ? '–' : n.toLocaleString('ru-RU').replace(/[  ]/g, ' ') + ' ₽');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const htmlToText = (h: string) => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const toAdm = (p: Product): AdmProduct => ({
  id: p.id, title: p.title, brand: p.brand, sku: p.sku ?? '', price: p.price, priceOld: p.priceOld, mark: p.mark ?? '',
  descr: p.descr, text: htmlToText(p.text), images: p.images, lists: p.lists, path: p.path, visible: !p.hidden,
  seoTitle: p.seoTitle ?? '', seoDescr: p.seoDescr ?? '', options: p.options, editions: p.editions, chars: p.chars,
});
const minPrice = (p: AdmProduct) => Math.min(p.price ?? Infinity, ...p.editions.map((e) => e.price ?? Infinity));

/** CSV в формате выгрузки Тильды – собирается в браузере после входа (открытых файлов в кабинете нет). */
function csvHref(rows: Product[], lists: AdmList[], site: string) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const name = (id: string) => lists.find((l) => l.id === id)?.title ?? id;
  const head = ['SKU', 'Category', 'Title', 'Brand', 'Description', 'Text', 'Photo', 'Price', 'Price Old', 'Mark', 'Hidden', 'Url'];
  const body = rows.map((p) => [p.sku ?? '', p.lists.map(name).join(';'), p.title, p.brand, p.descr, p.text.replace(/<[^>]+>/g, ' ').trim(),
    p.images.map((im) => `${site}${im}-1000.webp`).join(' '), p.price ?? '', p.priceOld ?? '', p.mark ?? '', p.hidden ? 'yes' : '', `${site}${p.path}`].map(q).join(';'));
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + [head.join(';'), ...body].join('\r\n'));
}

type Status = { kind: 'idle' | 'saving' | 'building' | 'done' | 'error'; text: string; url?: string; sha?: string };

export default function ProductsAdmin({ items, lists, base }: { items: Product[]; lists: AdmList[]; base: string }) {
  const [raw, setRaw] = useState<Product[]>(items);
  const [connected, setConnected] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [part, setPart] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('site');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<AdmProduct | null>(null);
  const [csv, setCsv] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });

  // С ключом – свежие данные прямо из репозитория: собранный сайт отстаёт на время сборки.
  // Счётчик сохранений: подгрузка, начатая до сохранения, не затирает его результат (грабли стенда Milovini 18.10.2026).
  const saves = useRef(0);
  const reload = async () => {
    const mark = saves.current;
    const p = await readJson<Product[]>(PRODUCTS_PATH);
    if (mark === saves.current) setRaw(p);
  };
  useEffect(() => { if (getToken()) { setConnected(true); reload().catch(() => setStatus({ kind: 'error', text: 'Не удалось загрузить данные из GitHub – проверьте ключ' })); } }, []);

  // Следим за сборкой сайта, которую запустил именно наш коммит.
  useEffect(() => {
    if (status.kind !== 'building' || !status.sha) return;
    const sha = status.sha;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const b = await buildOf(sha);
        if (b && b.status === 'completed') {
          setStatus(b.conclusion === 'success' ? { kind: 'done', text: 'Сайт обновлён – изменения уже на сайте', url: b.url } : { kind: 'error', text: 'Сборка сайта упала – откройте журнал', url: b.url });
          return;
        }
        if (b) setStatus((s) => ({ ...s, url: b.url }));
      } catch {}
      setTimeout(tick, 6000);
    };
    const t = setTimeout(tick, 8000);
    return () => { stop = true; clearTimeout(t); };
  }, [status.kind, status.sha]);

  const list = useMemo(() => raw.map(toAdm), [raw]);
  const title = (id: string) => lists.find((l) => l.id === id)?.title ?? id;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = list.filter((p) => (part === 'all' || (part === 'hidden' ? !p.visible : p.lists.includes(part)))
      && (!s || p.title.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s)));
    if (sort === 'price-asc') out = [...out].sort((a, b) => minPrice(a) - minPrice(b));
    if (sort === 'price-desc') out = [...out].sort((a, b) => minPrice(b) - minPrice(a));
    if (sort === 'name') out = [...out].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return out;
  }, [list, part, q, sort]);

  /** Сохранить изменение одним коммитом. Изменение – правило над списком товаров, а не готовый список: перед записью
   *  данные читаются из репозитория заново, и правило накладывается на них (не откатывает чужие и ранние правки). */
  const persist = async (mut: (list: Product[]) => Product[], message: string, extra: FileChange[] = []) => {
    saves.current++;
    setRaw((r) => mut(r));
    if (!connected) { setStatus({ kind: 'error', text: 'Изменение видно только у вас – подключите сохранение, чтобы оно попало на сайт' }); return; }
    setStatus({ kind: 'saving', text: 'Сохраняем…' });
    try {
      const fresh = await readJson<Product[]>(PRODUCTS_PATH);
      const next = mut(fresh);
      if (JSON.stringify(next) === JSON.stringify(fresh) && !extra.length) return setStatus({ kind: 'done', text: 'Изменений нет – сохранять нечего' });
      const sha = await commit([{ path: PRODUCTS_PATH, text: JSON.stringify(next, null, 1).replace(/—/g, '–') + '\n' }, ...extra], `Админка: ${message}`);
      saves.current++;
      setRaw(next);
      setStatus({ kind: 'building', text: 'Сохранено. Сайт обновляется – обычно 1–2 минуты', sha });
    } catch (e: any) {
      setStatus({ kind: 'error', text: `Не сохранилось: ${humanError(e)}` });
    }
  };

  const save = async (p: AdmProduct, files: File[]) => {
    if (!p.title.trim()) return setStatus({ kind: 'error', text: 'Укажите название товара' });
    if (!p.lists.some((l) => !['specials', 'hubert'].includes(l))) return setStatus({ kind: 'error', text: 'Отметьте хотя бы один каталог во вкладке «Разделы»' });
    const isNew = !p.id;
    const id = isNew ? String(Date.now()) : p.id;
    const old = raw.find((x) => x.id === id);
    const uploads: FileChange[] = [];
    const images = [...p.images];
    let n = images.reduce((m, im) => Math.max(m, Number(im.match(/-(\d+)$/)?.[1] ?? -1) + 1), 0);
    for (const f of files) {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      uploads.push({ path: `${UPLOADS_DIR}/${id}-${n}.${ext}`, base64: await fileToBase64(f) });
      images.push(`/img/up/${id}-${n}`);
      n++;
    }
    const firstCatalog = p.lists.find((l) => !['specials', 'hubert'].includes(l))!;
    const build = (o: Product | undefined): Product => ({
      ...(o ?? { sort: 0, options: [], editions: [] }),
      id, path: o?.path ?? `/${firstCatalog}/tproduct/${id}-${slugify(p.title)}`,
      // описание не трогали – сохраняем исходную разметку; правили – текст построчно
      title: p.title.trim(), brand: p.brand.trim(), descr: p.descr.trim(),
      text: o && p.text === htmlToText(o.text) ? o.text : esc(p.text.trim()).replace(/\n/g, '<br />'),
      price: p.price, priceOld: p.priceOld, lists: p.lists, images, hidden: !p.visible,
      chars: p.chars.filter((c) => c.t.trim() && c.v.trim()).map((c) => ({ t: c.t.trim(), v: c.v.trim() })),
      editions: p.editions,
      ...(p.sku.trim() ? { sku: p.sku.trim() } : {}), ...(p.mark.trim() ? { mark: p.mark.trim() } : {}),
      ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}), ...(p.seoDescr ? { seoDescr: p.seoDescr } : {}),
    } as Product);
    setEdit(null);
    const next = build(old);
    if (!isNew && !uploads.length && JSON.stringify(old) === JSON.stringify(next)) return setStatus({ kind: 'done', text: 'Изменений нет – сохранять нечего' });
    await persist((l) => (isNew ? [build(undefined), ...l] : l.map((x) => (x.id === id ? build(x) : x))), `${isNew ? 'новый товар' : 'товар'} «${next.title}»`, uploads);
  };

  const remove = async (p: AdmProduct) => {
    if (!confirm(`Удалить товар «${p.title}» с сайта насовсем? Скрыть его можно переключателем «На сайте».`)) return;
    setEdit(null);
    await persist((l) => l.filter((x) => x.id !== p.id), `удалён товар «${p.title}»`);
  };

  const setVisible = (ids: string[], visible: boolean) =>
    persist((l) => l.map((x) => (ids.includes(x.id) ? { ...x, hidden: !visible } : x)), `${visible ? 'показано' : 'скрыто'} на сайте: ${ids.length} шт.`);

  const addToList = (ids: string[], lid: string) =>
    persist((l) => l.map((x) => (ids.includes(x.id) && !x.lists.includes(lid) ? { ...x, lists: [...x.lists, lid] } : x)), `в раздел «${title(lid)}»: ${ids.length} шт.`);

  const allOn = shown.length > 0 && shown.every((p) => sel.has(p.id));
  const toggle = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const blank = (): AdmProduct => ({ id: '', title: '', brand: '', sku: `GM-${String(raw.length + 1).padStart(4, '0')}`, price: null, priceOld: null, mark: '', descr: '', text: '', images: [], lists: part !== 'all' && part !== 'hidden' ? [part] : [], path: '', visible: true, seoTitle: '', seoDescr: '', options: [], editions: [], chars: [] });

  return (
    <div>
      <div class={`sync sync--${connected ? 'on' : 'off'}`}>
        {connected ? (
          <>
            <span class="sync__dot" />
            <span>Сохранение подключено – изменения попадают на сайт</span>
            {status.kind !== 'idle' && <span class={`sync__st sync__st--${status.kind}`}>{status.text}{status.url && <> · <a href={status.url} target="_blank" rel="noopener">журнал сборки</a></>}</span>}
            <button class="btn ghost" onClick={() => setShowConnect(true)}>Ключ</button>
          </>
        ) : (
          <>
            <span class="sync__dot" />
            <span>Режим просмотра: изменения не сохраняются.</span>
            {status.kind === 'error' && <span class="sync__st sync__st--error">{status.text}</span>}
            <button class="btn primary" onClick={() => setShowConnect(true)}>Подключить сохранение</button>
          </>
        )}
      </div>

      <div class="pa">
        <aside class="pa__side">
          <p class="pa__cap">Разделы</p>
          <button class={part === 'all' ? 'on' : ''} onClick={() => setPart('all')}>Все товары<span>{list.length}</span></button>
          {lists.map((l) => (
            <button class={part === l.id ? 'on' : ''} onClick={() => setPart(l.id)}>{l.title}<span>{list.filter((p) => p.lists.includes(l.id)).length}</span></button>
          ))}
          <button class={part === 'hidden' ? 'on' : ''} onClick={() => setPart('hidden')}>Скрытые<span>{list.filter((p) => !p.visible).length}</span></button>
        </aside>

        <section class="pa__main">
          <div class="tools">
            <h1>{part === 'all' ? 'Все товары' : part === 'hidden' ? 'Скрытые товары' : title(part)} <span class="muted" style="font-size:15px;font-weight:400">{shown.length}</span></h1>
            <input type="search" placeholder="Название, марка или артикул" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
            <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value)} aria-label="Сортировка">
              <option value="site">Как на сайте</option><option value="name">По названию</option>
              <option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option>
            </select>
            <button class="btn" onClick={() => setCsv(true)}>⇪ Импорт CSV</button>
            <a class="btn" href={csvHref(raw, lists, (typeof location !== 'undefined' ? location.origin : '') + base)} download="gaz-mag-products.csv">⇩ Экспорт CSV</a>
            <button class="btn primary" onClick={() => setEdit(blank())}>+ Добавить товар</button>
          </div>

          {sel.size > 0 && (
            <div class="pa__bulk">
              <b>Выбрано: {sel.size}</b>
              <button class="btn" onClick={() => { setVisible([...sel], false); setSel(new Set()); }}>Скрыть с сайта</button>
              <button class="btn" onClick={() => { setVisible([...sel], true); setSel(new Set()); }}>Показать на сайте</button>
              <select class="btn" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) { addToList([...sel], v); setSel(new Set()); } }}>
                <option value="">Добавить в раздел…</option>{lists.map((l) => <option value={l.id}>{l.title}</option>)}
              </select>
              <button class="btn ghost" onClick={() => setSel(new Set())}>Снять выбор</button>
            </div>
          )}

          <div class="pt">
            <div class="pt__head">
              <label><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((p) => p.id)))} aria-label="Выбрать все" /></label>
              <span></span><span>Товар</span><span>Разделы</span><span>Цена</span><span>Варианты</span><span>На сайте</span>
            </div>
            {shown.map((p) => (
              <div class={`pt__row${sel.has(p.id) ? ' is-sel' : ''}${p.visible ? '' : ' is-off'}`} onClick={() => setEdit(p)}>
                <label onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Выбрать ${p.title}`} /></label>
                {p.images[0] ? <img class="thumb" src={`${base}${p.images[0]}-480.webp`} alt="" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <span class="thumb" title="Нет фото" />}
                <div><span class="pname">{p.title}</span><span class="muted pt__sku">{p.brand || 'без марки'}{p.sku && ` · ${p.sku}`}{p.mark && <i class="pt__mark">{p.mark}</i>}{!p.visible && <i class="pt__off">скрыт</i>}{!p.images.length && <i class="pt__off">нет фото</i>}</span></div>
                <div>{p.lists.map((id) => <span class="chip">{title(id)}</span>)}</div>
                <div class="pt__price"><b>{p.editions.length > 1 ? `от ${fmt(minPrice(p))}` : fmt(p.price)}</b>{p.priceOld && <s>{fmt(p.priceOld)}</s>}</div>
                <span class="muted">{p.editions.length > 1 ? p.editions.length : '–'}</span>
                <label class="sw" onClick={(e) => e.stopPropagation()} title={p.visible ? 'Скрыть с сайта' : 'Показать на сайте'}>
                  <input type="checkbox" checked={p.visible} onChange={() => setVisible([p.id], !p.visible)} /><span />
                </label>
              </div>
            ))}
            {shown.length === 0 && <p class="muted" style="padding:28px;text-align:center">Ничего не найдено</p>}
          </div>
        </section>
      </div>

      {edit && <ProductEditor product={edit} lists={lists} base={base} onClose={() => setEdit(null)} onSave={save} onDelete={remove} />}
      {csv && <CsvImport base={base} onClose={() => setCsv(false)} />}
      {showConnect && <GhConnect onClose={() => setShowConnect(false)} onConnected={(ok) => { setConnected(ok); setShowConnect(false); if (ok) reload(); }} />}
    </div>
  );
}
