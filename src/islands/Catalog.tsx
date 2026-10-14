import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Card, FilterDef } from '../lib/catalog';
import ProductCard from './ProductCard';
import { IconClose, IconFilter, IconSearch } from './icons';

// Каталог с фильтрами – набор фильтров тот же, что владелец включил в Тильде для этого каталога.
// Десктоп: колонка фильтров слева. Телефон: кнопка «Фильтры» открывает шторку, две карточки в ряд.
// Выбор показывает только подходящие товары; внутри одного фильтра значения – «или», между фильтрами – «и».

type Sel = Record<string, string[]>;
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Значения фильтра у карточки. */
function valuesOf(c: Card, f: FilterDef): string[] {
  if (f.kind === 'brand') return c.brand ? [c.brand] : [];
  if (f.kind === 'power') return c.power;
  if (f.kind === 'char' && f.char) return c.ch[f.char] ? [c.ch[f.char]] : [];
  return [];
}
const byNum = (a: string, b: string) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b, 'ru');

export default function Catalog({ cards, filters, step = 12 }: { cards: Card[]; filters: FilterDef[]; step?: number }) {
  const [sel, setSel] = useState<Sel>({});
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [q, setQ] = useState('');
  const [order, setOrder] = useState<'default' | 'asc' | 'desc' | 'az'>('default');
  const [limit, setLimit] = useState(step);
  const [sheetOpen, setSheetOpen] = useState(false);

  const prices = cards.map((c) => c.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const priceDef = filters.find((f) => f.kind === 'price');
  const listDefs = filters.filter((f) => f.kind !== 'price');

  // Все значения каждого фильтра по каталогу (порядок: числа по возрастанию, текст по алфавиту).
  const options = useMemo(() => Object.fromEntries(listDefs.map((f) => {
    const set = new Set<string>();
    cards.forEach((c) => valuesOf(c, f).forEach((v) => set.add(v)));
    return [f.label, [...set].sort(byNum)];
  })), [cards]);

  const match = (c: Card, skip?: string) => {
    for (const f of listDefs) {
      if (f.label === skip) continue;
      const want = sel[f.label];
      if (want?.length && !valuesOf(c, f).some((v) => want.includes(v))) return false;
    }
    const a = parseInt(min, 10), b = parseInt(max, 10);
    if (!isNaN(a) && c.price < a) return false;
    if (!isNaN(b) && c.price > b) return false;
    if (q.trim().length >= 2) {
      const hay = norm(`${c.title} ${c.brand} ${Object.values(c.ch).join(' ')}`);
      if (!norm(q.trim()).split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };

  const list = useMemo(() => {
    const out = cards.filter((c) => match(c));
    if (order === 'asc') out.sort((a, b) => a.price - b.price);
    if (order === 'desc') out.sort((a, b) => b.price - a.price);
    if (order === 'az') out.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return out;
  }, [cards, sel, min, max, q, order]);

  // Сколько товаров даст значение при остальных выбранных фильтрах.
  const count = (f: FilterDef, v: string) => cards.filter((c) => match(c, f.label) && valuesOf(c, f).includes(v)).length;

  useEffect(() => setLimit(step), [sel, min, max, q, order]);

  const toggle = (label: string, v: string) => {
    const cur = sel[label] || [];
    setSel({ ...sel, [label]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const chosen = Object.values(sel).reduce((n, a) => n + a.length, 0) + (min || max ? 1 : 0);
  const reset = () => { setSel({}); setMin(''); setMax(''); setQ(''); };

  const panel = (
    <div class="flt">
      {priceDef && (
        <fieldset class="flt__group">
          <legend class="flt__title">{priceDef.label}</legend>
          <div class="flt__price">
            <input class="input" inputMode="numeric" placeholder={`от ${lo.toLocaleString('ru-RU')}`} value={min} aria-label="Цена от" onInput={(e) => setMin((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
            <span aria-hidden="true">–</span>
            <input class="input" inputMode="numeric" placeholder={`до ${hi.toLocaleString('ru-RU')}`} value={max} aria-label="Цена до" onInput={(e) => setMax((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
          </div>
        </fieldset>
      )}
      {listDefs.map((f) => options[f.label]?.length > 0 && (
        <fieldset class="flt__group">
          <legend class="flt__title">{f.label}</legend>
          {options[f.label].map((v) => {
            const n = count(f, v);
            const on = (sel[f.label] || []).includes(v);
            return (
              <label class={`flt__opt${!n && !on ? ' is-off' : ''}`}>
                <input type="checkbox" checked={on} disabled={!n && !on} onChange={() => toggle(f.label, v)} />
                <span>{f.char === 'Отапливаемая площадь, м2' && /^\d/.test(v) ? `${v} м²` : v}</span>
                <small>{n}</small>
              </label>
            );
          })}
        </fieldset>
      ))}
      {chosen > 0 && <button type="button" class="btn btn--outline btn--sm btn--block" onClick={reset}>Сбросить фильтры</button>}
    </div>
  );

  return (
    <div class="cat">
      <aside class="cat__side" aria-label="Фильтры">{panel}</aside>
      <div class="cat__main">
        <div class="cat__bar">
          <label class="cat__search">
            <IconSearch size={18} />
            <input type="search" placeholder="Поиск в каталоге" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Поиск в каталоге" />
          </label>
          <button type="button" class="chip cat__fbtn" onClick={() => setSheetOpen(true)}>
            <IconFilter /> Фильтры{chosen > 0 && <b>{chosen}</b>}
          </button>
          <label class="cat__sort">
            <span class="sr-only">Сортировка</span>
            <select value={order} onChange={(e) => setOrder((e.target as HTMLSelectElement).value as any)}>
              <option value="default">По умолчанию</option>
              <option value="asc">Сначала дешевле</option>
              <option value="desc">Сначала дороже</option>
              <option value="az">По названию</option>
            </select>
          </label>
        </div>
        <p class="cat__found">Найдено: {list.length} из {cards.length}</p>

        <div class="grid" data-products>
          {list.slice(0, limit).map((p, i) => <ProductCard p={p} eager={i < 3} key={p.id} />)}
        </div>
        {list.length === 0 && (
          <p class="cat__empty">По выбранным фильтрам товаров нет. <button type="button" class="link" onClick={reset}>Сбросить фильтры</button> или <button type="button" class="link" data-lead="Подбор оборудования">оставьте заявку</button> – подберём под ваш дом.</p>
        )}
        {list.length > limit && (
          <div class="cat__more">
            <button type="button" class="btn btn--outline" onClick={() => setLimit(limit + step)}>
              Показать ещё <span class="cat__left">{Math.min(step, list.length - limit)} из {list.length - limit}</span>
            </button>
          </div>
        )}
      </div>

      <div class={`dr dr--right${sheetOpen ? ' is-open' : ''}`} aria-hidden={!sheetOpen}>
        <div class="dr__bg" onClick={() => setSheetOpen(false)} />
        <div class="dr__panel" role="dialog" aria-modal="true" aria-label="Фильтры">
          <div class="dr__head">
            <div class="dr__title">Фильтры</div>
            <button type="button" class="dr__close" aria-label="Закрыть" onClick={() => setSheetOpen(false)}><IconClose /></button>
          </div>
          <div class="dr__body">{panel}</div>
          <div class="dr__foot">
            <button type="button" class="btn btn--navy btn--block" onClick={() => setSheetOpen(false)}>Показать {list.length}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
