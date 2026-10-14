import { useEffect, useState } from 'preact/hooks';
import { addToCart, cart, favs, sheet, toggleFav } from '../lib/store';
import { u } from '../lib/url';
import { IconBag, IconHeart, IconMinus, IconPlus } from './icons';

// Блок покупки на карточке товара: количество, «В корзину», «Оформить сразу», избранное.
interface P { id: string; title: string; price: number; img: string; path: string; descr: string; stock: number | null }

export default function ProductBuy({ p }: { p: P }) {
  const [qty, setQty] = useState(1);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fav = ready && favs.value.some((x) => x.id === p.id);
  const inCart = ready ? cart.value.find((x) => x.id === p.id) : undefined;
  const max = p.stock ?? 99;
  const item = { id: p.id, title: p.title, price: p.price, img: p.img, path: p.path, max: p.stock };

  return (
    <div class="pb">
      <div class="pb__row">
        <div class="qty qty--lg" aria-label="Количество">
          <button type="button" aria-label="Меньше" disabled={qty <= 1} onClick={() => setQty(Math.max(1, qty - 1))}><IconMinus /></button>
          <span>{qty}</span>
          <button type="button" aria-label="Больше" disabled={qty >= max} onClick={() => setQty(Math.min(max, qty + 1))}><IconPlus /></button>
        </div>
        <button type="button" class="btn btn--mauve pb__add" onClick={() => addToCart(item, qty)}>
          <IconBag size={18} /> В корзину
        </button>
        <button
          type="button" class={`pb__fav${fav ? ' is-on' : ''}`} aria-pressed={fav}
          aria-label={fav ? 'Убрать из избранного' : 'В избранное'}
          onClick={() => toggleFav({ id: p.id, title: p.title, price: p.price, img: p.img, path: p.path, descr: p.descr })}
        >
          <IconHeart filled={fav} size={22} />
        </button>
      </div>
      <a
        class="btn btn--outline btn--block" href={u('/order')}
        onClick={() => { if (!inCart) addToCart(item, qty); }}
      >
        Оформить сразу
      </a>
      {inCart && (
        <p class="pb__note">
          В корзине: {inCart.qty} шт. <button type="button" class="link" onClick={() => (sheet.value = 'cart')}>Открыть корзину</button>
        </p>
      )}
      {p.stock !== null && p.stock <= 5 && <p class="pb__note">Осталось {p.stock} шт.</p>}
    </div>
  );
}
