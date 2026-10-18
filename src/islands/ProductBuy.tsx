import { catalogKeyOf } from '../lib/routes';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Edition } from '../lib/catalog';
import { addToCart, cart, favs, fmt, sheet, toggleFav } from '../lib/store';
import { IconBag, IconHeart, IconMinus, IconPlus } from './icons';

// Блок покупки на карточке товара: выбор варианта (мощность, объём бака), цена варианта,
// количество, «В корзину», «Заказать в один клик» (попап заявки), избранное.
interface P {
  id: string; title: string; price: number; priceOld: number | null; img: string; path: string;
  options: { title: string; values: string[] }[]; editions: Edition[];
}

export default function ProductBuy({ p }: { p: P }) {
  const [qty, setQty] = useState(1);
  const [pick, setPick] = useState<Record<string, string>>(() => p.editions[0]?.opts ?? {});
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const ed = useMemo(
    () => p.editions.find((e) => Object.entries(pick).every(([k, v]) => e.opts[k] === v)),
    [pick],
  );
  const price = ed?.price ?? p.price;
  const priceOld = ed ? ed.priceOld : p.priceOld;
  const variant = p.options.length ? p.options.map((o) => `${o.title}: ${pick[o.title]}`).join(', ') : undefined;
  const id = ed?.id ?? p.id;
  const item = { id, title: p.title, price, img: p.img, path: p.path, variant };
  const inCart = ready ? cart.value.find((x) => x.id === id) : undefined;
  const fav = ready && favs.value.some((x) => x.id === p.id);

  return (
    <div class="pb">
      <div class="pb__price">
        <b>{fmt(price)}</b>
        {priceOld && <s>{fmt(priceOld)}</s>}
      </div>
      {p.options.map((o) => (
        <div class="pb__opt" role="group" aria-label={o.title}>
          <span class="pb__opt-title">{o.title}</span>
          <div class="pb__opt-values">
            {o.values.map((v) => {
              const exists = p.editions.some((e) => e.opts[o.title] === v);
              return (
                <button
                  type="button" class={`chip${pick[o.title] === v ? ' is-active' : ''}`} disabled={!exists}
                  aria-pressed={pick[o.title] === v} onClick={() => setPick({ ...pick, [o.title]: v })}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div class="pb__row">
        <div class="qty qty--lg" aria-label="Количество">
          <button type="button" aria-label="Меньше" disabled={qty <= 1} onClick={() => setQty(Math.max(1, qty - 1))}><IconMinus /></button>
          <span>{qty}</span>
          <button type="button" aria-label="Больше" onClick={() => setQty(qty + 1)}><IconPlus /></button>
        </div>
        <button type="button" class="btn btn--navy pb__add" disabled={p.options.length > 0 && !ed} onClick={() => addToCart(item, qty)}>
          <IconBag size={18} /> В корзину
        </button>
        <button
          type="button" class={`pb__fav${fav ? ' is-on' : ''}`} aria-pressed={fav}
          aria-label={fav ? 'Убрать из избранного' : 'В избранное'}
          onClick={() => toggleFav({ id: p.id, title: p.title, price, img: p.img, path: p.path })}
        >
          <IconHeart filled={fav} size={22} />
        </button>
      </div>
      <button
        type="button" class="btn btn--outline btn--block" data-lead={`Заказ в один клик: ${p.title}${variant ? ` (${variant})` : ''}`}
        data-lead-item={JSON.stringify([{ uid: id, title: p.title, variant, category: catalogKeyOf(p.path), qty, price }])}
      >
        Заказать в один клик
      </button>
      {inCart && (
        <p class="pb__note">
          В корзине: {inCart.qty} шт. <button type="button" class="link" onClick={() => (sheet.value = 'cart')}>Открыть корзину</button>
        </p>
      )}
    </div>
  );
}
