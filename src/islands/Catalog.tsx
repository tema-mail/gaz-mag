import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Card, Chip } from '../lib/catalog';
import ProductCard from './ProductCard';

// Сетка товаров с фильтром. Стандарт владельца: чип «Все» первым, выбор показывает только подходящие;
// на телефоне две карточки в ряд. Раздел можно задать ссылкой: /catalog?part=<id>.

const PRICES = [
  { id: 'all', title: 'Любая цена', test: () => true },
  { id: 'p1', title: 'до 3 000 ₽', test: (n: number) => n < 3000 },
  { id: 'p2', title: '3 000–5 000 ₽', test: (n: number) => n >= 3000 && n < 5000 },
  { id: 'p3', title: '5 000–7 000 ₽', test: (n: number) => n >= 5000 && n < 7000 },
  { id: 'p4', title: 'от 7 000 ₽', test: (n: number) => n >= 7000 },
];

export default function Catalog({ cards, chips, step = 16, sort: showSort = true, prices = true }: {
  cards: Card[]; chips?: Chip[]; step?: number; sort?: boolean; prices?: boolean;
}) {
  const [chip, setChip] = useState<string>('all');
  const [sub, setSub] = useState<string>('all');
  const [price, setPrice] = useState('all');
  const [order, setOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [limit, setLimit] = useState(step);

  // ?part=<id> – открыть сразу нужный раздел или подраздел.
  useEffect(() => {
    const part = new URLSearchParams(location.search).get('part');
    if (!part || !chips) return;
    for (const c of chips) {
      if (c.id === part) { setChip(c.id); return; }
      const s = c.children?.find((x) => x.id === part);
      if (s) { setChip(c.id); setSub(s.id); return; }
    }
  }, []);

  const active = chips?.find((c) => c.id === chip);
  const activeSub = active?.children?.find((c) => c.id === sub);

  const list = useMemo(() => {
    const want = activeSub?.ids ?? active?.ids;
    const test = PRICES.find((x) => x.id === price)!.test;
    const out = cards.filter((p) => (!want || p.parts.some((x) => want.includes(x))) && test(p.price));
    if (order === 'asc') out.sort((a, b) => a.price - b.price);
    if (order === 'desc') out.sort((a, b) => b.price - a.price);
    return out;
  }, [cards, chip, sub, price, order]);

  useEffect(() => setLimit(step), [chip, sub, price, order]);

  const pick = (id: string) => { setChip(id); setSub('all'); };

  return (
    <div class="cat">
      {chips && chips.length > 0 && (
        <div class="cat__chips hscroll-m" role="group" aria-label="Разделы каталога">
          <button type="button" class={`chip${chip === 'all' ? ' is-active' : ''}`} onClick={() => pick('all')}>Все</button>
          {chips.map((c) => (
            <button type="button" class={`chip${chip === c.id ? ' is-active' : ''}`} onClick={() => pick(c.id)}>{c.title}</button>
          ))}
        </div>
      )}
      {active?.children && active.children.length > 0 && (
        <div class="cat__chips cat__chips--sub hscroll-m" role="group" aria-label="Подразделы">
          <button type="button" class={`chip chip--sm${sub === 'all' ? ' is-active' : ''}`} onClick={() => setSub('all')}>Все {active.title.toLowerCase()}</button>
          {active.children.map((c) => (
            <button type="button" class={`chip chip--sm${sub === c.id ? ' is-active' : ''}`} onClick={() => setSub(c.id)}>{c.title}</button>
          ))}
        </div>
      )}
      {(prices || showSort) && (
        <div class="cat__bar">
          {prices && (
            <div class="cat__prices hscroll-m" role="group" aria-label="Цена">
              {PRICES.map((p) => (
                <button type="button" class={`chip chip--ghost${price === p.id ? ' is-active' : ''}`} onClick={() => setPrice(p.id)}>{p.title}</button>
              ))}
            </div>
          )}
          {showSort && (
            <label class="cat__sort">
              <span class="sr-only">Сортировка</span>
              <select value={order} onChange={(e) => setOrder((e.target as HTMLSelectElement).value as any)}>
                <option value="default">По популярности</option>
                <option value="asc">Сначала дешевле</option>
                <option value="desc">Сначала дороже</option>
              </select>
            </label>
          )}
        </div>
      )}

      <div class="grid" data-products>
        {list.slice(0, limit).map((p, i) => <ProductCard p={p} eager={i < 4} key={p.id} />)}
      </div>
      {list.length === 0 && (
        <p class="cat__empty">В этом разделе сейчас нет букетов по выбранной цене. <button type="button" class="link" onClick={() => setPrice('all')}>Показать все цены</button> или <button type="button" class="link" data-lead>попросите флориста собрать</button>.</p>
      )}
      {list.length > limit && (
        <div class="cat__more">
          <button type="button" class="btn btn--outline" onClick={() => setLimit(limit + step)}>
            Показать ещё <span class="cat__left">{Math.min(step, list.length - limit)} из {list.length - limit}</span>
          </button>
        </div>
      )}
    </div>
  );
}
